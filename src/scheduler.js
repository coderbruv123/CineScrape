/**
 * Scheduler for periodic refreshes.
 *
 * Uses `node-cron` (cron syntax). Default: nightly at 06:00.
 */

import cron from 'node-cron';
import { TFNScraper } from './scraper/tfn.js';
import { ensureSource, saveMovie, saveTheater, saveShowtime } from './db/database.js';

let running = false;

export function scheduleRefresh() {
  const schedule = process.env.SCHEDULE || '0 6 * * *'; // daily 06:00
  cron.schedule(schedule, async () => {
    if (running) {
      console.log('[scheduler] already running; skipping');
      return;
    }
    running = true;
    try {
      const scraper = new TFNScraper(Number(process.env.TFN_CONCURRENCY || 8));
      const source = ensureSource({
        name: 'The Film Nepal',
        baseUrl: scraper.baseUrl,
        config: { concurrency: Number(process.env.TFN_CONCURRENCY || 8) },
        status: 'active',
        reliabilityScore: 1.0,
      });
      console.log(`[scheduler] ${new Date().toISOString()} - starting scrape for ${source.name}`);

      const movies = await scraper.scrapeNowShowingMovies(30);
      for (const m of movies) {
        saveMovie({
          sourceId: source.id, slug: m.slug, title: m.title,
          year: m.year, runtimeMinutes: m.runtimeMinutes, genre: m.genre,
          cast: m.cast, trailerUrl: m.trailerUrl, posterUrl: m.posterUrl,
          certificate: m.certificate, synopsis: m.synopsis,
        });
      }
      console.log(`[scheduler] movies saved: ${movies.length}`);

      const theaters = await scraper.scrapeTheaters();
      for (const t of theaters) {
        saveTheater({ sourceId: source.id, slug: t.slug, name: t.name, city: t.city, branchCount: t.branchCount });
      }
      console.log(`[scheduler] theaters saved: ${theaters.length}`);

      const st = await scraper.scrapeShowtimes();
      let saved = 0;
      for (const s of st) {
        const m = query('SELECT id FROM movies WHERE slug = ? AND is_active = 1', [s.movieSlug]);
        const t = query('SELECT id FROM theaters WHERE slug = ? AND is_active = 1', [s.theaterSlug]);
        if (m.length && t.length) {
          saveShowtime({ sourceId: source.id, movieId: m[0].id, theaterId: t[0].id, showDate: '2026-10-24', sessionTime: s.time });
          saved += 1;
        }
      }
      console.log(`[scheduler] Linked ${saved} showtimes to real movies/theaters`);

      await scraper.axios.close();
    } catch (err) {
      console.error('[scheduler] scrape error:', err.message);
    } finally {
      running = false;
    }
  }, {
    timezone: process.env.TZ || 'Asia/Kathmandu',
  });
  console.log(`[scheduler] scheduled (cron: ${schedule})`);
}

export function stopScheduler() {
  if (cron.processes) {
    for (const [, sched] of cron.processes) sched.stop();
  }
}
