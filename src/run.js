#!/usr/bin/env node
/**
 * Orchestrator: register source + run the scraper into SQLite.
 *
 * Run:  node src/run.js          # full run (last appr. 2000 movies)
 *       LIMIT=40 node src/run.js # quick first run (validate pipeline)
 */

import { TFNScraper } from './scraper/tfn.js';
import { ensureSource, saveMovie, saveTheater, saveShowtime, savePrice, query, saveKhaltiMovie, saveKhaltiCinema, saveKhaltiShowtime } from './db/database.js';
import { ShowtimeNepalScraper } from './scraper/showtimenepal.js';
import { KhaltiScraper } from './scraper/khalti.js';

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

  // 3) showtimes (link each record to its real movie + theater by slug)
  console.log('[run] Scraping showtimes...');
  const showtimes = await scraper.scrapeShowtimes();
  let saved = 0;
  for (const st of showtimes) {
    const m = query('SELECT id FROM movies WHERE slug = ? AND is_active = 1', [st.movieSlug]);
    const t = query('SELECT id FROM theaters WHERE slug = ? AND is_active = 1', [st.theaterSlug]);
    if (m.length && t.length) {
      saveShowtime({ sourceId: source.id, movieId: m[0].id, theaterId: t[0].id, showDate: '2026-10-24', sessionTime: st.time });
      saved += 1;
    }
  }
  console.log(`[run] Linked ${saved} showtimes to real movies/theaters`);

  // 4) ticket prices (price comparison across cinemas)
  console.log('[run] Scraping ticket prices...');
  const priceScraper = new ShowtimeNepalScraper();
  const prices = await priceScraper.scrapePrices();
  for (const p of prices) {
    savePrice(p);
  }
  console.log(`[run] Saved ${prices.length} ticket price rows`);

  console.log('[run] Done.');

  // 5) Khalti data (cinemas + movies + showtimes)
  console.log('[run] Scraping Khalti data...');
  const khaltiScraper = new KhaltiScraper();
  const khaltiSource = ensureSource({
    name: 'Khalti',
    baseUrl: khaltiScraper.baseUrl,
    config: { concurrency: 4 },
    status: 'active',
    reliabilityScore: 1.0,
  });
  console.log(`[run] Khalti source registered: id=${khaltiSource.id}`);

  const khaltiMovies = await khaltiScraper.scrapeNowShowingMovies();
  console.log(`[run] Khalti now-playing movies: ${khaltiMovies.movies?.length || 0}`);

  // Save Khalti movies
  const savedMovies = [];
  for (const m of khaltiMovies.movies || []) {
    const res = saveKhaltiMovie({
      sourceId: khaltiSource.id,
      idx: m.idx,
      title: m.title,
      genre: m.genre,
      duration: m.duration,
      grade: m.grade,
      releaseDate: m.releaseDate,
      trailerUrl: m.trailerUrl,
      posterUrl: m.posterUrl,
      certificate: m.certificate,
      synopsis: m.synopsis,
      director: m.director,
      cast: m.cast,
    });
    savedMovies.push(res);
  }
  console.log(`[run] Saved ${savedMovies.length} Khalti movies`);

  // Save Khalti cinemas (halls)
  const khaltiCinemas = khaltiMovies.theatres || [];
  const savedCinemas = [];
  for (const c of khaltiCinemas) {
    const res = saveKhaltiCinema({
      sourceId: khaltiSource.id,
      idx: c.idx,
      name: c.name,
      logo: c.logo,
      city: c.city,
      location: c.location,
    });
    savedCinemas.push(res);
  }
  console.log(`[run] Saved ${savedCinemas.length} Khalti cinemas`);

  // Save Khalti showtimes (link to movies/theaters by idx)
  let savedShowtimes = 0;
  const uniqueShows = new Set();
  for (const m of khaltiMovies.movies || []) {
    if (!m.idx) continue;
    const { cinemas = [] } = await khaltiScraper.scrapeMovieShowtimes(m.idx);
    for (const c of cinemas) {
      const key = `${m.idx}:${c.cinemaIdx}:${c.showDate}:${c.sessionTime}`;
      if (uniqueShows.has(key)) continue;
      uniqueShows.add(key);
      const res = saveKhaltiShowtime({
        sourceId: khaltiSource.id,
        movieIdx: m.idx,
        theaterIdx: c.cinemaIdx,
        showDate: c.showDate,
        sessionTime: c.sessionTime,
        showId: c.showId,
        bookingUrl: c.bookingUrl,
        totalSeats: c.totalSeats,
        availableSeats: c.availableSeats,
        earliestTimeToBookBefore: c.earliestTimeToBookBefore,
        auditorium: c.auditorium,
        availability: c.availability,
        useNewLayout: c.useNewLayout,
        resolution: c.resolution,
        audioFormat: c.audioFormat,
        visualFormat: c.visualFormat,
        color: c.color,
      });
      if (res) savedShowtimes += 1;
    }
  }
  console.log(`[run] Saved ${savedShowtimes} Khalti showtimes`);

  console.log('[run] Done.');
}

main().catch((err) => {
  console.error('[run] FATAL:', err);
  process.exit(1);
});
