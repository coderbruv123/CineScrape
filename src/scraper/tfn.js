/**
 * The Film Nepal scraper adapter (Node.js / axios + cheerio).
 *
 * Pipeline (all raw HTML / XML, no browser):
 *   1. /sitemap.xml  -> movie-sitemap-N.xml -> /movie/{slug} URLs
 *   2. /movie/{slug} -> JSON-LD 'Movie' object (title, poster, genre, releaseDate,
 *      duration, cast, director, productionCompany, trailer, ...)
 *
 * Also extracts:
 *   - theaters from /cinemas
 *   - showtimes (movie names) from /show-times
 *
 * TFN is a Next.js app; its listing pages are client-rendered, but sitemap + detail
 * pages are server-rendered and fully available over plain HTTP. This is the legal,
 * sustainable way to scrape it.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

export const TFN_BASE_URL = process.env.TFN_BASE_URL || 'https://www.thefilmnepal.com';

const MOVIE_SITEMAP_XML = '/sitemap.xml';
const CINEMA_PAGE = '/cinemas';
const SHOWTIMES_PAGE = '/show-times';

const ISO_DURATION_RE = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:\.(\d+))S?$/;

export class TFNScraper {
  constructor(concurrency = 8) {
    this.baseUrl = TFN_BASE_URL;
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

  async runConcurrently(tasks, limit) {
    const limitN = limit || this.concurrency;
    const results = [];
    for (let i = 0; i < tasks.length; i += limitN) {
      const batch = tasks.slice(i, i + limitN);
      const promises = batch.map((t) => t());
      results.push(...(await Promise.all(promises)));
    }
    return results;
  }

  async $(path) {
    const resp = await this.axios.get(path);
    const $ = cheerio.load(resp.data);
    return { $, path };
  }

  /** Trim text from a cheerio object. */
  text($el) {
    return ($el ? $el.text().trim() : '');
  }

  /** Convert ISO 8601 duration (PT2H25M) to minutes. */
  durationToMinutes(iso) {
    if (!iso) return null;
    const m = ISO_DURATION_RE.exec(iso);
    if (!m) return null;
    const days = m[1] ? parseInt(m[1], 10) * 24 * 60 : 0;
    const hours = m[2] ? parseInt(m[2], 10) * 60 : 0;
    const mins = m[3] ? parseInt(m[3], 10) : 0;
    const secs = m[4] ? parseFloat('0.' + m[4]) * 60 : 0;
    return Math.round(days + hours + mins + secs);
  }

  /** Parse the JSON-LD Movie object from a detail page. */
  parseMovieJsonLd(html) {
    const $ = cheerio.load(html);
    const script = $('script[type="application/ld+json"]').html();
    if (!script) return null;
    try {
      const data = JSON.parse(script);
      for (const g of data['@graph'] || []) {
        if (g['@type'] === 'Movie') {
          const actor = (g.actor || []).map((a) => a.name || a).join('; ');
          const dir = g.director && g.director.name ? g.director.name : null;
          const prod = g.productionCompany && g.productionCompany.name ? g.productionCompany.name : null;
          return {
            title: g.name || null,
            posterUrl: g.image || null,
            genre: Array.isArray(g.genre) ? g.genre.join(', ') : g.genre || null,
            releaseDate: g.datePublished || g.dateModified || null,
            // Year is not a first-class field in the source; derive it from datePublished.
            year: g.datePublished ? parseInt(g.datePublished.substring(0, 4), 10) : null,
            runtimeMinutes: this.durationToMinutes(g.duration),
            cast: actor,
            director: dir,
            productionCompany: prod,
            trailerUrl: g.trailer && g.trailer.contentUrl ? g.trailer.contentUrl : g.trailer && g.trailer.embedUrl ? g.trailer.embedUrl : null,
            certificate: g.contentRating || null,
            synopsis: g.description || null,
          };
        }
      }
    } catch (e) {
      // fall through to cheerio-based fallback below
    }
    return null;
  }

  /** Fallback: extract title + year + genre + poster from cheerio markup. */
  parseMovieFromHtml(html, slug) {
    const $ = cheerio.load(html);
    const title = this.text($('h1'));
    const titleLower = title.toLowerCase();
    const year = /\((\d{4})\)/.test(title) ? parseInt(RegExp.$1, 10) : null;
    // poster: first tfnnew img
    let posterUrl = null;
    $('img').each((_, el) => {
      const src = $(el).attr('src') || '';
      if (src.includes('tfnnew.in-maa')) {
        posterUrl = src.replace('-thumbnail-md', '-full').replace('-md', '-full');
        return false;
      }
    });
    return { slug, title, year, runtimeMinutes: null, genre: null, cast: null, trailerUrl: null, posterUrl, certificate: null, synopsis: null };
  }

  // ---- movie slugs + details -------------------------------------------

  /** Enumerate all movie slugs from the sitemap index + sitemaps. */
  async scrapeMovieSlugs() {
    const slugs = new Set();
    const index = await this.axios.get(MOVIE_SITEMAP_XML);
    const sitemapUrls = [...new Set(
      index.data.toString().match(/<loc>([^<]+)<\/loc>/g).map((s) => s.replace(/<loc>/, '').replace('</loc>', ''))
    )].filter((u) => /^https:\/\/www\.thefilmnepal\.com\/movie-sitemap-\d+\.xml$/.test(u));

    for (const s of sitemapUrls) {
      const resp = await this.axios.get(s);
      const html = resp.data.toString();
      const urls = [...new Set(html.match(/<loc>([^<]+)<\/loc>/g) || [])]
        .map((u) => u.replace(/<loc>/, '').replace('</loc>', ''))
        .filter((u) => /^https:\/\/www\.thefilmnepal\.com\/movie\/[a-z0-9-]+$/.test(u));
      for (const u of urls) slugs.add(u.replace(/^https?:\/\/www\.thefilmnepal\.com\/movie\//, ''));
    }
    return [...slugs];
  }

  /** Fetch one movie detail page -> structured record. */
  async scrapeMovieDetail(slug) {
    const { $ } = await this.$(`/movie/${slug}`);
    // JSON-LD Movie object preferred (rich data)
    const jsonLd = this.parseMovieJsonLd($('html').toString());
    if (jsonLd) return { ...jsonLd, slug };
    // fallback to cheerio
    return this.parseMovieFromHtml($('html').toString(), slug);
  }

  /** List + enrich movies (sample detail by default). */
  async scrapeMovies(detailLimit = 40) {
    const slugs = await this.scrapeMovieSlugs();
    const records = [];
    for (const slug of slugs) {
      try {
        const rec = await this.scrapeMovieDetail(slug);
        if (rec) records.push(rec);
      } catch (err) {
        // skip per-movie failures; keep going
      }
      if (records.length >= detailLimit) break;
    }
    return records;
  }

  // ---- theaters & showtimes -------------------------------------------

  /** List theaters from /cinemas + /show-times.
   *
   * Theater names and URLs come from the /cinemas page JSON-LD (clean names).
   * City and branch_count come from the /show-times page (embedded JSON with
   * branch.city, and times[] per branch), so we parse that page once and reuse it.
   */
  async scrapeTheaters() {
    // 1) Theater names + URLs from /cinemas JSON-LD
    const theaters = new Map(); // slug -> { slug, name, city, branchCount }
    try {
      const { data } = await this.axios.get('/cinemas');
      const $ = cheerio.load(data);
      $('script[type="application/ld+json"]').each((_, el) => {
        const raw = $('script[type="application/ld+json"]').eq(0).html();
        if (!raw) return;
        try {
          const graph = JSON.parse(raw)['@graph'] || [];
          for (const item of graph) {
            // MovieTheater items are nested inside ItemList -> itemListElement -> item
            let theaterItem = item;
            if (theaterItem['@type'] === 'ItemList' && theaterItem.itemListElement) {
              for (const listItem of theaterItem.itemListElement) {
                if (listItem.item && listItem.item['@type'] === 'MovieTheater') {
                  theaterItem = listItem.item;
                  break;
                }
              }
            }
            if (theaterItem['@type'] === 'MovieTheater' && theaterItem.name && theaterItem.url) {
              const slug = theaterItem.url.replace('/cinemas/', '').replace(/^(\/)+/, '');
              if (slug && !theaters.has(slug)) {
                theaters.set(slug, { slug, name: theaterItem.name, city: null, branchCount: 0 });
              }
            }
          }
        } catch (e) {
          // malformed JSON-LD; fall through to element selector below
        }
      });
    } catch (err) {
      console.warn(`[tfn] cinemas JSON-LD parse failed: ${err.message}`);
    }

    // Fallback: element selector (in case JSON-LD is not available)
    if (theaters.size === 0) {
      const { $ } = await this.$('/cinemas');
      $('a[href*="/cinemas/"]').each((i, el) => {
        const name = $(el).text().replace(/\s*\d+\s*branch\s*/i, '').trim();
        const slug = $(el).attr('href').replace('/cinemas/', '').replace(/^\/+/, '');
        if (name && slug && !theaters.has(slug)) {
          theaters.set(slug, { slug, name, city: null, branchCount: 0 });
        }
      });
    }

    // 2) City + branch_count from /show-times page
    try {
      const { data } = await this.axios.get(SHOWTIMES_PAGE);
      const $ = cheerio.load(data);
      // The show-times page has branch data with city in JSON; use the HTML meta
      // data for city (e.g. <p class="mds-cinema-row__meta">Pulchowk, Lalitpur</p>).
      // We map by comparing theater name against the JSON-LD names.
      $('article.mds-cinema-row').each((i, el) => {
        const nameEl = $(el).find('h3.mds-cinema-row__title a');
        const cityEl = $(el).find('p.mds-cinema-row__meta');
        const name = nameEl.text().trim();
        const city = cityEl.text().trim();
        const link = nameEl.attr('href') || '';
        const slug = link.replace('/cinemas/', '').replace(/^\/+/, '');
        if (slug && theaters.has(slug)) {
          const existing = theaters.get(slug);
          if (city && !existing.city) existing.city = city;
          existing.branchCount += 1;
        }
      });
    } catch (err) {
      console.warn(`[tfn] show-times parse for theaters failed: ${err.message}`);
    }

    return [...theaters.values()];
  }

  /**
   * Showtimes: scrape real showtimes from the /show-times page.
   *
   * The page embeds JSON via a big script tag with the shape:
   *   {"<movie-slug>": {"id": N, "title": "...", "show_times": {"Today": [
   *     {"branch": {"id": N, "title": "...", "slug": "...", "location": "...", "city": "..."},
   *      "times": [{"id": N, "time": "HH:MM", ...}]}, ...]}, ...}
   *
   * Returns a list of raw showtime records: { movie_slug, movie_title, theater_slug,
   *   theater_name, theater_city, time }.
   */
  async scrapeShowtimes() {
    const rows = [];
    try {
      const { data } = await this.axios.get(SHOWTIMES_PAGE);
      // The page is a Next.js app with a big script tag containing minified JSON.
      // Extract the JSON data between the first { and the last }.
      const jsonMatch = data.match(/<script[^>]*>(\{.*?\})\s*<\/script>/s);
      if (!jsonMatch) return rows;

      let rawJson;
      try {
        rawJson = jsonMatch[1];
      } catch (e) {
        console.warn('[tfn] show-times JSON parse failed:', e.message);
        return rows;
      }

      let dataObj;
      try {
        dataObj = JSON.parse(rawJson);
      } catch (e) {
        console.warn('[tfn] show-times JSON parse failed:', e.message);
        return rows;
      }

      // dataObj is an object keyed by movie slug
      for (const [movieSlug, movieData] of Object.entries(dataObj)) {
        const title = movieData.title || movieSlug;
        const showTimes = movieData.show_times || {};
        for (const day of Object.values(showTimes)) {
          if (!Array.isArray(day)) continue;
          for (const slot of day) {
            const branch = slot.branch || {};
            const theaterSlug = branch.slug || null;
            const theaterName = branch.title || null;
            const theaterCity = branch.city || null;
            const times = slot.times || [];
            for (const t of times) {
              const time = t.time || null;
              if (theaterSlug && time) {
                rows.push({
                  movieSlug,
                  movieTitle: title,
                  theaterSlug,
                  theaterName,
                  theaterCity,
                  time,
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[tfn] scrapeShowtimes failed:', err.message);
    }
    return rows;
  }

  /** Now-playing movies: the /show-times movie selector lists the films currently
   *  in session at Nepali cinemas. Option labels may include a subtitle
   *  (e.g. "Kabaddi 5 - After the Final Match"). */
  async scrapeNowShowing() {
    const { $ } = await this.$(SHOWTIMES_PAGE);
    const $select = $('select[name="movie"]');
    const items = [];
    $select.find('option').each((i, el) => {
      const slug = $(el).attr('value');
      const name = $(el).text().trim();
      if (slug) items.push({ slug, name });
    });
    return items;
  }

  /** Now-playing movies + full detail (title, poster, cast, etc.). */
  async scrapeNowShowingMovies(detailLimit = 40) {
    const nowShowing = await this.scrapeNowShowing();
    const records = [];
    for (const { slug, name } of nowShowing) {
      try {
        const rec = await this.scrapeMovieDetail(slug);
        if (rec) {
          if (!rec.title) rec.title = name;
          records.push(rec);
        }
      } catch (err) {
        // skip per-movie failures; keep going
      }
      if (records.length >= detailLimit) break;
    }
    return records;
  }

  /** Health check. */
  async health() {
    try {
      await this.axios.get('/');
      return { ok: true, status: 'ok', title: 'The Film Nepal reachable' };
    } catch (err) {
      return { ok: false, status: 'error', error: err.message };
    }
  }
}
