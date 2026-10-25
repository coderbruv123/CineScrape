/**
 * Express REST API for Cinema Scrapper.
 *
 * Routes:
 *   GET  /api/v1/health
 *   GET  /api/v1/sources
 *   GET  /api/v1/movies?genre=&search=&limit=&offset=
 *   GET  /api/v1/movies/:id
 *   GET  /api/v1/theaters
 *   GET  /api/v1/theaters/:id/movies
 */

import express from 'express';
import { query, ensureSource, saveMovie, saveTheater, saveShowtime, savePrice, getPricesByTheater } from '../db/database.js';
import { existsSync } from 'fs';
import { join } from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger.js';

const app = express();
app.use(express.json());

// Serve the built React UI. The React UI uses React Router (BrowserRouter,
// HTML5 history mode), so all non-API routes must fall through to index.html.
// Without this, direct visits to /theaters, /sources, or /movies/:slug
// return "Cannot GET /route".
const DIST = join(process.cwd(), 'web', 'dist');
if (existsSync(DIST)) {
  app.use(express.static(DIST));
}

// ---------------------------------------------------------------- health
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', service: 'cinemascrapper' });
});

// --------------------------------------------------------------- sources
app.get('/api/v1/sources', (_req, res) => {
  const rows = query("SELECT id, name, base_url, status, last_success_at, last_failure_at, scrape_frequency_hours, reliability_score FROM sources ORDER BY name");
  res.json({
    data: rows.map((r) => ({
      id: r.id, name: r.name, base_url: r.base_url, status: r.status,
      last_success_at: r.last_success_at, last_failure_at: r.last_failure_at,
      scrape_frequency_hours: r.scrape_frequency_hours, reliability_score: r.reliability_score,
    })),
  });
});

// ----------------------------------------------------------------- movies
app.get('/api/v1/movies', (req, res) => {
  const { genre, search, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT * FROM movies WHERE is_active = 1';
  const params = [];
  if (genre) {
    sql += ' AND genre LIKE ?';
    params.push(`%${genre}%`);
  }
  if (search) {
    sql += ' AND (title LIKE ? OR slug LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit, 10), parseInt(offset, 10));
  const movies = query(sql, params);
  res.json({
    data: movies.map((m) => ({
      id: m.id, slug: m.slug, title: m.title, year: m.year,
      runtime_minutes: m.runtime_minutes, genre: m.genre, cast: m.cast,
      trailer_url: m.trailer_url, poster_url: m.poster_url,
      certificate: m.certificate, synopsis: m.synopsis,
      scraped_at: m.scraped_at, updated_at: m.updated_at,
    })),
    count: movies.length,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
  });
});

app.get('/api/v1/movies/:slug', (req, res) => {
  const m = query('SELECT * FROM movies WHERE slug = ?', [req.params.slug]);
  if (!m.length) return res.status(404).json({ error: 'Movie not found' });
  const movie = m[0];
  res.json({
    id: movie.id, slug: movie.slug, title: movie.title, year: movie.year,
    runtime_minutes: movie.runtime_minutes, genre: movie.genre, cast: movie.cast,
    trailer_url: movie.trailer_url, poster_url: movie.poster_url,
    certificate: movie.certificate, synopsis: movie.synopsis,
    scraped_at: movie.scraped_at, updated_at: movie.updated_at,
    source: null, // source name joins could be added via SQL join
  });
});

// --------------------------------------------------------------- theaters
app.get('/api/v1/theaters', (_req, res) => {
  const theaters = query("SELECT id, slug, name, city, branch_count, scraped_at FROM theaters WHERE is_active = 1 ORDER BY name");
  res.json({
    data: theaters.map((t) => ({
      id: t.id, slug: t.slug, name: t.name, city: t.city,
      branch_count: t.branch_count, scraped_at: t.scraped_at,
    })),
    count: theaters.length,
  });
});

app.get('/api/v1/theaters/:id/movies', (req, res) => {
  const theater = query('SELECT * FROM theaters WHERE id = ?', [req.params.id]);
  if (!theater.length) return res.status(404).json({ error: 'Theater not found' });
  const theaterRow = theater[0];
  const showtimes = query(
    `SELECT s.movie_id FROM showtimes s
     JOIN movies m ON m.id = s.movie_id
     WHERE s.theater_id = ? AND m.is_active = 1`,
    [req.params.id]
  );
  const movieIds = showtimes.map((st) => st.movie_id);
  let movies = [];
  if (movieIds.length) {
    const rows = query('SELECT id, slug, title, genre, year, scraped_at FROM movies WHERE id IN (' + movieIds.map(() => '?').join(',') + ')', movieIds);
    movies = rows.map((m) => ({
      id: m.id, slug: m.slug, title: m.title, genre: m.genre, year: m.year, scraped_at: m.scraped_at,
    }));
  }
  res.json({
    theater: { id: theaterRow.id, name: theaterRow.name, city: theaterRow.city },
    movies,
  });
});

// -------------------------------------------------------------- ticket prices
// GET /api/v1/prices?movie=<slug> | GET /api/v1/prices?theater=<name>
app.get('/api/v1/prices', (req, res) => {
  const { movie, theater } = req.query;

  if (movie) {
    // Prices for a specific movie: join via showtimes -> theaters -> price rows
    const m = query('SELECT id FROM movies WHERE slug = ? AND is_active = 1', [movie]);
    if (!m.length) return res.status(404).json({ error: 'Movie not found' });
    const movieId = m[0].id;

    const showtimes = query(
      `SELECT s.theater_id FROM showtimes s
       JOIN theaters t ON t.id = s.theater_id
       WHERE s.movie_id = ? AND t.is_active = 1`,
      [movieId]
    );

    const theaterIds = [...new Set(showtimes.map(r => r.theater_id))];
    const result = { movie, theaters: [] };
    for (const id of theaterIds) {
      const t = query('SELECT slug, name FROM theaters WHERE id = ?', [id]);
      if (!t.length) continue;
      const prices = getPricesByTheater()[t[0].name] || [];
      result.theaters.push({
        slug: t[0].slug,
        name: t[0].name,
        prices,
      });
    }
    return res.json(result);
  }

  if (theater) {
    const rows = getPricesByTheater()[theater] || [];
    return res.json({ theater, prices: rows });
  }

  // GET /api/v1/prices - list all price data grouped by theater (recent snapshot)
  const all = getPricesByTheater();
  res.json({ theaters: Object.keys(all).map(name => ({ name, count: all[name].length })), total: Object.values(all).reduce((s, a) => s + a.length, 0) });
});

// -------------------------------------------------------------- client-side route fallback
// The React UI uses React Router (BrowserRouter, HTML5 history mode), so all
// non-API routes must fall through to index.html. Without this, direct visits
// to /theaters, /sources, or /movies/:slug return "Cannot GET ...".
app.get('*', (_req, res) => {
  res.sendFile(join(DIST, 'index.html'));
});

// -------------------------------------------------------------- error mid
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------- swagger ui
// Serve the Swagger UI at /docs and the OpenAPI JSON at /api/openapi.json
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  swaggerUiOptions: {
    tryIt: true,
    operationsSorter: 'alpha',
  },
}));
app.get('/api/openapi.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// -------------------------------------------------------------- error mid
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;

// Start the server when run directly (ESM: main module check)
const PORT = Number(process.env.PORT) || 4010;
if (process.argv[1] && import.meta.url.endsWith(`file://${process.argv[1]}`)) {
  app.listen(PORT, () => {
    console.log(`[api] Cinema Scrapper listening on port ${PORT}`);
    console.log(`[api] Swagger UI at http://localhost:${PORT}/docs`);
  });
}
