/** Showtime Nepal movie ticket prices scraper.
 *
 * Scrapes the server-rendered price comparison table on
 * https://www.showtimenepal.com/theater/ticket-prices
 *
 * The page renders one HTML <table> per day of the week, each with the shape:
 *   Theater | Auditorium | Seat Category | Time band | Price |
 *   Price (Holiday) | Price (New Release)
 *
 * Each row = one auditorium / category / time band for one theater.
 * No movie association on the page; prices are per-cinema and are joined to the
 * movie/theater catalog on the timeline / API layer.
 */
import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL =
  process.env.SHOWTIME_NEPAL_BASE_URL || 'https://www.showtimenepal.com/theater/ticket-prices';

// Local fallback: cached HTML snapshot (showtimenepal.com's response currently
// trips Node.js' strict HTTP parser with an "Invalid header value char" error.
// See notes in the scraper source for context.)
const FALLBACK_FILE =
  process.env.SHOWTIME_NEPAL_FALLBACK_FILE ||
  new URL('../../web/ticket-prices.html', import.meta.url).pathname;

export class ShowtimeNepalScraper {
  constructor(concurrency = 4) {
    this.axios = axios.create({
      baseURL: BASE_URL,
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

  /** Fetch a URL and return a cheerio-wrapped document. */
  async $(path) {
    const resp = await this.axios.get(path);
    const $ = cheerio.load(resp.data);
    return { $, path };
  }

  /** Parse the raw HTML table(s) into normalized price records. */
  parsePrices(html) {
    const $ = cheerio.load(html);
    const rows = [];

    $('table').each((_, table) => {
      const $table = $(table);
      const $trs = $table.find('tr');
      $trs.each((_, tr) => {
        const $tr = $(tr);
        // Extract all cells (td/th), trimmed of tags & whitespace
        const cells = $tr
          .find('td, th')
          .map((_, el) => {
            return $(el).text().replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
          })
          .get();

        // Skip header rows and empty rows
        if (cells.length < 5) return;
        if (/^theater$/i.test(cells[0])) return;

        const theaterName = cells[0];
        const auditorium = cells[1] || null;
        const seatCategory = cells[2] || null;

        // Time band like "12:00 AM - 10:59 AM"
        const timeParts = cells[3].split('-');
        const timeFrom = timeParts[0] ? timeParts[0].trim() : null;
        const timeTo = timeParts[1] ? timeParts[1].trim() : null;
        if (!timeFrom) return;

        // Price(s)
        const priceRegular = this.parsePrice(cells[4]);
        if (priceRegular == null) return;

        const priceHoliday = cells[5] ? this.parsePrice(cells[5]) : null;
        const priceNewRelease = cells[6] ? this.parsePrice(cells[6]) : null;

        rows.push({
          theater_name: theaterName,
          auditorium,
          seat_category: seatCategory,
          time_from: timeFrom,
          time_to: timeTo,
          price_regular: priceRegular,
          price_holiday: priceHoliday,
          price_new_release: priceNewRelease,
        });
      });
    });

    return rows;
  }

  /** Extract a leading numeric price (e.g. "185.00" -> 185, "" -> null). */
  parsePrice(str) {
    if (!str) return null;
    const m = str.match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : null;
  }

  /** Fetch and parse prices from the source page. Prefers HTTP; falls back to a
   *  locally cached HTML snapshot when the remote response trips Node.js' strict
   *  HTTP parser (HPE_INVALID_HEADER_TOKEN).
   */
  async scrapePrices() {
    // 1) Try HTTP first
    try {
      const { $} = await this.$(BASE_URL);
      return this.parsePrices($('html').toString());
    } catch (err) {
      console.warn(`[showtimenepal] HTTP fetch failed (${err.message}); trying fallback file.`);
    }

    // 2) Fallback: read cached snapshot
    let html;
    try {
      const fs = await import('node:fs');
      html = fs.readFileSync(FALLBACK_FILE, 'utf8');
    } catch (e) {
      throw new Error(`ShowtimeNepal scrape failed: HTTP fetch and fallback file both unavailable. ${e.message}`);
    }
    return this.parsePrices(html);
  }
}
