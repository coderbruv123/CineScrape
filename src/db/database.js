/**
 * Database layer for Cinema Scrapper.
 * Uses Node's built-in `node:sqlite` (DatabaseSync) - no native module needed.
 *
 * Schema mirrors the original plan:
 *   sources, movies, theaters, showtimes
 */

import { DatabaseSync } from 'node:sqlite';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = process.env.DB_PATH || './cinemascrape.db';

let _db = null;

function getDb() {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    _db.exec("PRAGMA journal_mode = WAL;");
    _db.exec(`PRAGMA foreign_keys = ON;`);
    initSchema();
  }
  return _db;
}

export function initSchema() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      base_url TEXT NOT NULL,
      config TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active',
      last_success_at TEXT,
      last_failure_at TEXT,
      scrape_frequency_hours INTEGER NOT NULL DEFAULT 24,
      reliability_score REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      year INTEGER,
      runtime_minutes INTEGER,
      genre TEXT,
      cast TEXT,
      trailer_url TEXT,
      poster_url TEXT,
      certificate TEXT,
      synopsis TEXT,
      release_date TEXT,
      director TEXT,
      production_company TEXT,
      language TEXT,
      ratings TEXT,
      audience_grade TEXT,
      fcube_id INTEGER,
      scraped_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER NOT NULL DEFAULT 1,
      UNIQUE(slug)
    );

    CREATE TABLE IF NOT EXISTS theaters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      city TEXT,
      country TEXT NOT NULL DEFAULT 'Nepal',
      branch_count INTEGER,
      scraped_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER NOT NULL DEFAULT 1,
      UNIQUE(slug)
    );

    CREATE TABLE IF NOT EXISTS showtimes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      movie_id INTEGER NOT NULL,
      theater_id INTEGER NOT NULL,
      show_date TEXT NOT NULL,
      session_time TEXT NOT NULL,
      scraped_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER NOT NULL DEFAULT 1,
      show_id TEXT,
      booking_url TEXT,
      total_seats INTEGER,
      available_seats INTEGER,
      earliest_time_to_book_before INTEGER,
      auditorium TEXT,
      availability TEXT,
      useNewLayout INTEGER,
      resolution TEXT,
      audioFormat TEXT,
      visualFormat TEXT,
      color TEXT,
      UNIQUE(movie_id, theater_id, show_date, session_time)
    );

    CREATE INDEX IF NOT EXISTS idx_movies_source ON movies(source_id);
    CREATE INDEX IF NOT EXISTS idx_showtimes_movie ON showtimes(movie_id);
    CREATE INDEX IF NOT EXISTS idx_showtimes_theater ON showtimes(theater_id);
  `);

  // Ticket price tables: per-theater, per-auditorium, per-category, per time band.
  // Joined to the movie/theater catalog client-side (prices are not tied to a single
  // movie on the source pages).
  db.exec(`CREATE TABLE IF NOT EXISTS prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    theater_name TEXT NOT NULL,
    auditorium TEXT NOT NULL,
    seat_category TEXT NOT NULL,
    time_from TEXT NOT NULL,
    time_to TEXT,
    price_regular REAL NOT NULL,
    price_holiday REAL,
    price_new_release REAL,
    scraped_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(theater_name, auditorium, seat_category, time_from, time_to)
  );

  CREATE INDEX IF NOT EXISTS idx_prices_theater ON prices(theater_name);
  CREATE INDEX IF NOT EXISTS idx_prices_time ON prices(time_from, time_to);
  `);
}

/**
 * Insert or update a ticket price row (upsert keyed on theater + auditorium +
 * category + time band).
 */
export function savePrice({
   theater_name, auditorium, seat_category, time_from, time_to,
   price_regular, price_holiday, price_new_release,
 }) {
   const db = getDb();
   const info = db.prepare(`INSERT INTO prices
     (theater_name, auditorium, seat_category, time_from, time_to,
      price_regular, price_holiday, price_new_release)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(theater_name, auditorium, seat_category, time_from, time_to)
     DO UPDATE SET
       price_regular = excluded.price_regular,
       price_holiday = excluded.price_holiday,
       price_new_release = excluded.price_new_release,
       updated_at = datetime('now')
   `).run(
     theater_name, auditorium, seat_category, time_from, time_to,
     price_regular, price_holiday, price_new_release
   );
   return { id: info.lastInsertRowid, changes: info.changes };
 }

/**
 * Fetch all recent price rows, grouped by theater name (for the price-comparison
 * endpoint).
 */
export function getPricesByTheater() {
  const rows = query(
    `SELECT theater_name, auditorium, seat_category, time_from, time_to,
            price_regular, price_holiday, price_new_release
       FROM prices
      ORDER BY theater_name, time_from`
  );
  const byTheater = new Map();
  for (const r of rows) {
    if (!byTheater.has(r.theater_name)) byTheater.set(r.theater_name, []);
    byTheater.get(r.theater_name).push(r);
  }
  return Object.fromEntries(byTheater);
}

/** Run a SELECT and return all rows. */
export function query(sql, params = []) {
  return getDb().prepare(sql).all(...params);
}

/** Run an INSERT/UPDATE and return { changes, lastInsertRowid }. */
export function run(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}

/**
 * Ensure a source exists (upsert by name). Returns the row (incl. id).
 */
export function ensureSource({ name, baseUrl, config = {}, status = 'active', reliabilityScore = 1.0 }) {
  const db = getDb();
  const row = db.prepare("SELECT id FROM sources WHERE name = ?").get(name);
  if (row) {
    db.prepare(`
      UPDATE sources SET base_url = ?, config = ?, status = ?, reliability_score = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(baseUrl, JSON.stringify(config), status, reliabilityScore, row.id);
    return { id: row.id, name, base_url: baseUrl, config, status, reliability_score: reliabilityScore };
  }
  const info = db.prepare(`
    INSERT INTO sources (name, base_url, config, status, reliability_score)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, baseUrl, JSON.stringify(config), status, reliabilityScore);
  return { id: info.lastInsertRowid, name, base_url: baseUrl, config, status, reliability_score: reliabilityScore };
}

/**
 * Insert or update a movie by slug (upsert).
 * Returns { id, changes }.
 */
export function saveMovie({
  sourceId, slug, title, year, runtimeMinutes, genre, cast, trailerUrl, posterUrl, certificate, synopsis,
  releaseDate, director, productionCompany
}) {
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO movies (source_id, slug, title, year, runtime_minutes, genre, cast, trailer_url, poster_url, certificate, synopsis, release_date, director, production_company)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      year = excluded.year,
      runtime_minutes = excluded.runtime_minutes,
      genre = excluded.genre,
      cast = excluded.cast,
      trailer_url = excluded.trailer_url,
      poster_url = excluded.poster_url,
      certificate = excluded.certificate,
      synopsis = excluded.synopsis,
      release_date = excluded.release_date,
      director = excluded.director,
      production_company = excluded.production_company,
      updated_at = datetime('now')
  `).run(sourceId, slug, title, year, runtimeMinutes, genre, cast, trailerUrl, posterUrl, certificate, synopsis, releaseDate, director, productionCompany);
  return { id: info.lastInsertRowid, changes: info.changes };
}

/**
 * Insert or update a theater by slug (upsert).
 */
export function saveTheater({ sourceId, slug, name, city, branchCount }) {
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO theaters (source_id, slug, name, city, branch_count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      city = excluded.city,
      branch_count = excluded.branch_count,
      updated_at = datetime('now')
  `).run(sourceId, slug, name, city, branchCount);
  return { id: info.lastInsertRowid, changes: info.changes };
}

/**
 * Insert or update a showtime (upsert keyed on movie + theater + date + time).
 */
export function saveShowtime({ sourceId, movieId, theaterId, showDate, sessionTime, showId, bookingUrl, totalSeats, availableSeats, earliestTimeToBookBefore }) {
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO showtimes (source_id, movie_id, theater_id, show_date, session_time, show_id, booking_url, total_seats, available_seats, earliest_time_to_book_before, auditorium, availability, useNewLayout, resolution, audioFormat, visualFormat, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(movie_id, theater_id, show_date, session_time) DO UPDATE SET
      scraped_at = datetime('now'),
      show_id = excluded.show_id,
      booking_url = excluded.booking_url,
      total_seats = excluded.total_seats,
      available_seats = excluded.available_seats,
      earliest_time_to_book_before = excluded.earliest_time_to_book_before,
      auditorium = excluded.auditorium,
      availability = excluded.availability,
      useNewLayout = excluded.useNewLayout,
      resolution = excluded.resolution,
      audioFormat = excluded.audioFormat,
      visualFormat = excluded.visualFormat,
      color = excluded.color
  `).run(sourceId, movieId, theaterId, showDate, sessionTime, showId || null, bookingUrl || null, totalSeats || null, availableSeats || null, earliestTimeToBookBefore || null, auditorium || null, availability || null, useNewLayout || null, resolution || null, audioFormat || null, visualFormat || null, color || null);
  return { id: info.lastInsertRowid, changes: info.changes };
}

/**
 * Save a Khalti movie to the movies table (upsert by slug).
 * Khalti uses idx as the slug (it is the unique movie identifier).
 */
export function saveKhaltiMovie({
  sourceId, idx, title, genre, duration, grade, releaseDate,
  trailerUrl, posterUrl, certificate, synopsis, director, cast,
  language, ratings, audience, prioritizedVisualFormat, fcubeId
}) {
  const db = getDb();
  // Check if a movie with this title already exists (from another source)
  const existing = db.prepare(
    `SELECT id, source_id, title, genre, runtime_minutes, poster_url, release_date, director, "cast", synopsis, language, ratings, audience_grade, fcube_id FROM movies WHERE LOWER(title) = LOWER(?) AND source_id != ? LIMIT 1`
  ).get(title, sourceId);
  if (existing) {
    // Merge: keep existing fields if new ones are missing
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    db.prepare(`
      UPDATE movies SET
        title = COALESCE(?, title),
        genre = COALESCE(?, genre),
        runtime_minutes = COALESCE(?, runtime_minutes),
        poster_url = COALESCE(?, poster_url),
        release_date = COALESCE(?, release_date),
        director = COALESCE(?, director),
      "cast" = COALESCE(?, "cast"),
        synopsis = COALESCE(?, synopsis),
        language = COALESCE(?, language),
        ratings = COALESCE(?, ratings),
        audience_grade = COALESCE(?, audience_grade),
        fcube_id = COALESCE(?, fcube_id),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title, genre, duration, posterUrl, releaseDate, director, cast, synopsis, language, ratings, audience?.grade?.name || null, fcubeId, existing.id
    );
    return { id: existing.id, changes: 1, updated: true };
  }
  const info = db.prepare(`
    INSERT INTO movies (source_id, slug, title, genre, runtime_minutes, poster_url, release_date, director, cast, synopsis, language, ratings, audience_grade, fcube_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      genre = excluded.genre,
      runtime_minutes = excluded.runtime_minutes,
      poster_url = excluded.poster_url,
      release_date = excluded.release_date,
      director = excluded.director,
      cast = excluded.cast,
      synopsis = excluded.synopsis,
      language = excluded.language,
      ratings = excluded.ratings,
      audience_grade = excluded.audience_grade,
      fcube_id = excluded.fcube_id,
      updated_at = datetime('now')
  `).run(sourceId, idx, title, genre, duration, posterUrl, releaseDate, director, cast, synopsis, language, ratings, audience?.name || null, fcubeId);
  return { id: info.lastInsertRowid, changes: info.changes, updated: false };
}

/**
 * Insert or update a Khalti cinema (hall) by idx.
 */
export function saveKhaltiCinema({ sourceId, idx, name, logo, city, location }) {
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO theaters (source_id, slug, name, city, branch_count)
    VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      city = excluded.city,
      updated_at = datetime('now')
  `).run(sourceId, idx, name, city);
  return { id: info.lastInsertRowid, changes: info.changes };
}

/**
 * Save a Khalti showtime and link to the movie and theater by idx.
 */
export function saveKhaltiShowtime({
  sourceId, movieIdx, theaterIdx, showDate, sessionTime,
  showId, bookingUrl, totalSeats, availableSeats, earliestTimeToBookBefore,
  auditorium, availability, useNewLayout, resolution, audioFormat, visualFormat, color
}) {
  const db = getDb();
  // Look up movie id by Khalti idx
  const m = query('SELECT id FROM movies WHERE slug = ? AND is_active = 1', [movieIdx]);
  if (!m.length) return null;
  const movieId = m[0].id;
  // Look up theater id by Khalti idx
  const t = query('SELECT id FROM theaters WHERE slug = ? AND is_active = 1', [theaterIdx]);
  if (!t.length) return null;
  const theaterId = t[0].id;
  const info = db.prepare(`
      INSERT INTO showtimes (source_id, movie_id, theater_id, show_date, session_time, show_id, booking_url, total_seats, available_seats, earliest_time_to_book_before, auditorium, availability, useNewLayout, resolution, audioFormat, visualFormat, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(movie_id, theater_id, show_date, session_time) DO UPDATE SET
        scraped_at = datetime('now'),
        show_id = excluded.show_id,
        booking_url = excluded.booking_url,
        total_seats = excluded.total_seats,
        available_seats = excluded.available_seats,
        earliest_time_to_book_before = excluded.earliest_time_to_book_before,
        auditorium = excluded.auditorium,
        availability = excluded.availability,
        useNewLayout = excluded.useNewLayout,
        resolution = excluded.resolution,
        audioFormat = excluded.audioFormat,
        visualFormat = excluded.visualFormat,
        color = excluded.color
    `).run(sourceId, movieId, theaterId, showDate, sessionTime, showId || null, bookingUrl || null, totalSeats || null, availableSeats || null, earliestTimeToBookBefore || null, auditorium || null, availability || null, useNewLayout || null, resolution || null, audioFormat || null, visualFormat || null, color || null);
  return { id: info.lastInsertRowid, changes: info.changes };
}
