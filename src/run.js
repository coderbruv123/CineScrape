#!/usr/bin/env node
/**
 * Orchestrator: register source + run the scraper into SQLite.
 *
 * Run:  node src/run.js          # full run (last appr. 2000 movies)
 *       LIMIT=40 node src/run.js # quick first run (validate pipeline)
 */

import { TFNScraper } from './scraper/tfn.js';
import { ensureSource, saveMovie, saveTheater, saveShowtime, savePrice } from './db/database.js';
import { ShowtimeNepalScraper } from './scraper/showtimenepal.js';

const LIMIT = Number(process.env.LIMIT || 0); // 0 = full catalog

async function main() {
  const scraper = new TFNScraper(Number(process.env.TFN_CONCURRENCY || 8));

  const source = ensureSource({
    name: 'The Film Nepal',
    baseUrl: scraper.baseUrl,
    config: { concurrency: Number(process.env.TFN_CONCURRENCY || 8) },
    status: 'active',
    reliabilityScore: 1.0,
  });
  console.log(`[run] Source registered: id=${source.id} name=${source.name}`);

  // 1) movies (currently showing in Nepali cinemas)
  console.log('[run] Enumerating now-playing movies...');
  const movies = await scraper.scrapeNowShowingMovies(LIMIT > 0 ? LIMIT : 40);
  console.log(`[run] Saved ${movies.length} now-playing movie(s).`);
  for (const m of movies) {
    saveMovie({
      sourceId: source.id, slug: m.slug, title: m.title,
      year: m.year, runtimeMinutes: m.runtimeMinutes, genre: m.genre, cast: m.cast,
      trailerUrl: m.trailerUrl, posterUrl: m.posterUrl,
      certificate: m.certificate, synopsis: m.synopsis,
      releaseDate: m.releaseDate, director: m.director, productionCompany: m.productionCompany,
    });
  }
  console.log(`[run] Saved ${movies.length} movies`);

  // 2) theaters
  console.log('[run] Scraping theaters...');
  const theaters = await scraper.scrapeTheaters();
  for (const t of theaters) {
    saveTheater({ sourceId: source.id, slug: t.slug, name: t.name, city: t.city, branchCount: t.branchCount });
  }
  console.log(`[run] Saved ${theaters.length} theaters`);

  // 3) showtimes (stub for MVP; real per-movie/per-theater mapping added later)
  console.log('[run] Scraping showtimes...');
  const showtimes = await scraper.scrapeShowtimes();
  for (let i = 0; i < Math.min(showtimes.length, 10); i++) {
    saveShowtime({ sourceId: source.id, movieId: 0, theaterId: 0, showDate: '2026-10-24', sessionTime: '19:30' });
  }
  console.log(`[run] Saved ${Math.min(showtimes.length, 10)} showtime stub rows`);

  // 4) ticket prices (price comparison across cinemas)
  console.log('[run] Scraping ticket prices...');
  const priceScraper = new ShowtimeNepalScraper();
  const prices = await priceScraper.scrapePrices();
  for (const p of prices) {
    savePrice(p);
  }
  console.log(`[run] Saved ${prices.length} ticket price rows`);

  console.log('[run] Done.');
}

main().catch((err) => {
  console.error('[run] FATAL:', err);
  process.exit(1);
});
