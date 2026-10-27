/** Khalti cinema + movie scraper adapter.
 *
 * Khalti (movies.khalti.com) exposes, in its server-rendered __NEXT_DATA__
 * payloads, a cinema directory (halls), a now-playing movie list, and
 * per-movie showtimes with booking references:
 *
 *   - /theatres          cinema directory (halls)
 *   - /                  now-playing movies
 *   - /movie/{idx}       per-movie showtimes + booking refs
 *
 * The data received by this adapter is what the "Khalti" source feeds:
 *   - cinema (hall) names, cities, locations, logos
 *   - movie titles, genres, durations, ratings, release dates, posters
 *   - per-cinema showtimes with booking links (show_id)
 */
import axios from 'axios';
import * as cheerio from 'cheerio';

export const KHALTI_BASE_URL = process.env.KHALTI_BASE_URL || 'https://movies.khalti.com';

/** Build a booking URL for a show_id. */
export function khaltiBookingUrl(movieIdx, showId) {
  return `https://movies.khalti.com/movie/${encodeURIComponent(movieIdx)}/show/${encodeURIComponent(showId)}`;
}

export class KhaltiScraper {
  constructor(concurrency = 4) {
    this.baseUrl = KHALTI_BASE_URL;
    this.axios = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'User-Agent': 'CinemaScrapper/1.0 (research; contact: dev@example.com)',
      },
      maxRedirects: 5,
    });
    this.concurrency = concurrency;
  }

  /** Cheerio wrapper around a page. */
  async $(path) {
    const resp = await this.axios.get(path);
    const $ = cheerio.load(resp.data);
    return { $, path };
  }

  /** Pull the server-rendered __NEXT_DATA__ JSON out of a page. */
  parseNextData(html) {
    const $ = cheerio.load(html);
    const script = $('script#__NEXT_DATA__').html();
    if (!script) return null;
    try {
      return JSON.parse(script);
    } catch (e) {
      if (process.env.LOG_LEVEL === 'DEBUG') console.warn('[khalti] __NEXT_DATA__ parse failed:', e.message);
      return null;
    }
  }

  /** Cinema directory from the /theatres page. */
  cinemasFromHTML(html) {
    const parsed = this.parseNextData(html);
    if (!parsed) return [];
    const list = parsed.props?.pageProps?.theatreList;
    if (!Array.isArray(list)) return [];
    const cinemas = [];
    for (const t of list) {
      if (t && t.name && t.idx) cinemas.push({ idx: t.idx, name: t.name, logo: t.logo || null, city: null, location: null });
    }
    return cinemas;
  }

  /** Now-playing movie list from the / page + per-movie detail page. */
  moviesFromHTML(html) {
    const parsed = this.parseNextData(html);
    if (!parsed) return { movies: [], theatres: [], cities: [] };
    const pageProps = parsed.props?.pageProps || {};
    const movies = [];
    const theatres = [];
    const cities = [];
    const md = pageProps.moviesData?.data;
    if (md && Array.isArray(md.movies)) {
      for (const m of md.movies) {
        if (!m || !m.name) continue;
        const extra = m.extra_detail || {};
        movies.push({
          idx: m.idx,
          title: m.name,
          genre: m.genre || extra.movie_genre || null,
          duration: m.duration || null,
          grade: m.grade || extra.grade_name || null,
          releaseDate: m.extra_detail?.release_date || null,
          trailerUrl: m.video || null,
          posterUrl: m.images?.portrait || null,
          synopsis: m.description || null,
          director: m.director || null,
          cast: Array.isArray(m.stars) ? m.stars.map((s) => s?.name || s?.toString || s).join(', ') : (m.stars || null),
          language: m.language || null,
          ratings: m.ratings || null,
          audience: m.audience || null,
          prioritizedVisualFormat: m.prioritizedVisualFormat || null,
          fcubeId: m.fcubeId || extra.fcube_id || null,
          certificate: null, // Khalti exposes a content rating (grade), not a certificate
        });
      }
    }
    if (Array.isArray(md?.theatres)) {
      for (const t of md.theatres) {
        if (t && t.name && t.idx) theatres.push({ idx: t.idx, name: t.name, logo: t.logo || null, city: null, location: null });
      }
    }
    if (Array.isArray(pageProps.cityData?.data)) {
      for (const c of pageProps.cityData.data) {
        if (c && c.name && !cities.includes(c.name)) cities.push(c.name);
      }
    }
    return { movies, theatres, cities };
  }

  /** Cinema directory from the /theatres page. */
  async scrapeCinemas() {
    const { data } = await this.axios.get('/theatres');
    return this.cinemasFromHTML(data);
  }

  /** Now-playing movies + cinema directory. */
  async scrapeNowShowingMovies(detailLimit = 40) {
    const { data } = await this.axios.get('/');
    return this.moviesFromHTML(data);
  }

  /** Per-movie showtimes + booking references for one movie. */
  async scrapeMovieShowtimes(movieIdx) {
    const { data } = await this.axios.get(`/movie/${encodeURIComponent(movieIdx)}`);
    const parsed = this.parseNextData(data);
    if (!parsed) return { movie: null, cinemas: [] };
    const pageProps = parsed.props?.pageProps || {};
    const movie = pageProps.movieDetail?.data;
    const rows = [];
    if (movie && Array.isArray(movie.theatres)) {
      for (const t of movie.theatres) {
        if (!t || !t.name) continue;
        for (const s of t.shows || []) {
          if (!s || !s.datetime) continue;
          const [datePart, timePart] = String(s.datetime || '').split(' ');
          rows.push({
            movieIdx: movie.idx,
            movieTitle: movie.name,
            cinemaIdx: t.idx,
            cinemaName: t.name,
            cinemaLocation: t.location || null,
            cinemaCity: t.city || null,
            showId: s.show_id || null,
            showDate: datePart || null,
            sessionTime: timePart ? timePart.slice(0, 5) : null,
            showTime: s.datetime,
            auditorium: s.auditorium_name || null,
            totalSeats: s.total_seats ?? null,
            availableSeats: s.available_seats ?? null,
            earliestTimeToBookBefore: s.earliest_time_to_book_before ?? null,
            availability: s.ticket_availability || null,
            useNewLayout: s.use_new_layout ?? null,
            resolution: s.resolution || null,
            audioFormat: s.audio_format || null,
            visualFormat: s.visual_format || null,
            color: s.color || null,
            bookingUrl: s.show_id ? khaltiBookingUrl(movie.idx, s.show_id) : null,
          });
        }
      }
    }
    return { movie: this.movieFromDetail(movie), cinemas: rows };
  }

  /** Build a full enriched movie record from the detail-page object. */
  movieFromDetail(movie) {
    const extra = movie?.extra_detail || {};
    return {
      idx: movie?.idx || null,
      title: movie?.name || null,
      genre: extra.movie_genre || null,
      duration: movie?.duration || null,
      grade: extra.grade_name || null,
      releaseDate: extra.release_date || null,
      trailerUrl: extra.video || null,
      posterUrl: movie?.images?.portrait || null,
      synopsis: movie?.description || null,
      director: movie?.director || null,
      cast: Array.isArray(movie?.stars) ? movie.stars.map((s) => s.name || s.toString()).join(', ') : (movie?.stars || null),
      certificate: null, // Khalti does not expose an official certificate
      language: movie?.language || null,
      ratings: movie?.ratings || null,
      audience: movie?.audience || null,
      prioritizedVisualFormat: movie?.prioritized_visual_format || null,
      fcubeId: extra.fcube_id || null,
    };
  }
}
