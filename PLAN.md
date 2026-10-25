# Cinema Scrapper — Product & Engineering Plan
## Nepali Cinemas Aggregator Web App

---

## 1. Executive Summary

Cinema Scrapper is a web application that aggregates Nepali cinema data (movies, theaters,
showtimes, trailers, posters, reviews) from multiple source websites into a single, searchable
interface. It uses automated scraping/crawling to keep data fresh, presenting Nepali movie-goers
with one place to discover what is playing, where, and when.

**Primary value:** A unified, up-to-date cinema guide for Nepal — saving users from hopping
across multiple ticket/platform sites.

---

## 2. Problem & Objectives

### Problem
- Nepali cinema information is scattered across many sites (theaters, ticketing portals, news).
- No single source has complete, consistent, up-to-date listings.
- Users must manually check multiple sites to find showtimes.

### Objectives (v1)
1. Scrape movie listings from a set of Nepali cinema sources.
2. Normalize data into a unified model.
3. Serve a searchable web UI: movies, theaters, showtimes.
4. Keep data fresh via scheduled refreshes.
5. Provide an API for future clients (mobile, widget).

### Non-goals (v1)
- Official ticket purchasing (out of scope; legal/operational complexity).
- Payments, user accounts, social features.

---

## 3. Scope

### MVP (v1)
- Crawl 3–5 Nepali cinema sources for: movie title, release date, cast, genre, trailer link, poster.
- Extract theater list + showtimes.
- Rest API + basic web UI.
- Scheduled refresh pipeline.
- Basic monitoring/sanity checks on scraped data.

### Post-MVP
- User favorites / watchlist.
- Push notifications for new showtimes.
- Mobile apps (React Native / Flutter) consuming the API.
- Ratings/reviews.
- PDF/e-ticket export (informational only).
- Multi-language UI (Nepali + English).

---

## 4. Core Features

### Movie Catalog
- Title, alias names, cast, genre, release date, duration, trailer, poster.
- Search + filters (genre, theater, date).

### Theaters
- Name, location, city, display screens, 3D/IMAX availability.

### Showtimes
- Movie x Theater x Date table with session times.

### Data Health
- Source freshness indicators, data quality flags.

### Future
- Favorites, notifications, API access.

---

## 5. Data Sources (Nepali Cinemas)

| Source | Type | Data |
|---|---|---|
| merocinema.com.np | Website | Movies, trailers, cast |
| cinemas in Nepal directories | Website | Theater list |
| Individual theater websites | Website | Showtimes |
| News sites (filmcaptions, etc.) | Website | Release dates, reviews |
| OTT/trailer platforms | API/web | Trailers, posters |

### Source prioritization (for MVP)
1. Sources with structured data (databases/tables) — easiest to parse.
2. Sites with embeddable data (JSON-LD, API endpoints).
3. HTML scraping as fallback.

### Collection strategy
- Maintain a source manifest (URL, selector config, frequency, reliability, terms of use).
- Each source = a "scraper module" with its own config.
- Run scrapers in parallel with per-source rate limiting.

---

## 6. System Architecture

```
                    +----------------------+
                    |   Web UI (React)    |
                    +----------+-----------+
                               |
                    +----------v-----------+
                    |   REST API (FastAPI)  |
                    +----------+-----------+
                               |
        +-------------------------------+
        |   Data Layer                   |
        |  - Scraper Workers (async)     |
        |  - PostgreSQL (main store)     |
        |  - Redis (cache/rate-limits)   |
        +-------------------------------+
                               |
                    +----------v----------+
                    |  Source Adapters    |
                    |  (per-source configs)|
                    +---------------------+
```

### Components
1. **Web UI**: React + TypeScript, responsive.
2. **API**: FastAPI (Python), REST, OpenAPI docs.
3. **Scraper workers**: Async (httpx + BeautifulSoup/lxml), per-source adapters, scheduled.
4. **Store**: PostgreSQL for relational data (movies, theaters, showtimes).
5. **Cache**: Redis for hot queries (e.g., showtimes for today).
6. **Queue**: Redis/RQ or Celery for scheduled refreshes.

---

## 7. Tech Stack

| Area | Choice |
|---|---|
| Frontend | React + TypeScript + Vite, Tailwind CSS |
| Backend | FastAPI (Python 3.11+) |
| Scraper | httpx (async) + BeautifulSoup4 / lxml |
| DB | PostgreSQL |
| Cache | Redis |
| Queue | RQ / Celery (via Redis) |
| Deploy | Docker + Render/Railway/AWS EC2 |
| Infra | GitHub Actions for CI + scheduled scrapes |

### Why this stack
- Python-rich ecosystem for scraping.
- FastAPI = quick, typed, auto-docs.
- React = rich, responsive UI with filtering.
- Postgres = reliable relational model for movies/theaters/showtimes.

---

## 8. Data Model (PostgreSQL)

### movies
- id (UUID), slug, title, alt_titles, description, release_date, duration_minutes,
  genre_json, cast_json, trailer_url, poster_url, source_id, source_raw_json,
  scraped_at, updated_at, is_active

### sources
- id, name, base_url, config (jsonb), status, last_success_at, last_failure_at,
  scrape_frequency_hours, reliability_score

### theaters
- id (UUID), name, slug, city, address, contact, display_json,
  scraped_at, updated_at, is_active

### showtimes
- id (UUID), movie_id (FK), theater_id (FK), show_date, session_time,
  price_json (optional), scraped_at, is_active, unique(movie_id, theater_id, show_date, session_time)

### extras (optional)
- movie_trailers, reviews, ratings, favorites (later)

### Indexes
- showtimes on (movie_id, show_date)
- movies on (slug, title)
- theaters on (city, name)

---

## 9. Scraper Design

### Per-source adapter pattern
Each source is a class with a single entry: `async def scrape()` returning raw JSON. A central
normalizer maps source-specific fields to the unified model. Config is stored per-source, so new
sources are added by dropping in a config + adapter — no code changes to core.

### Flow
1. Scheduler (APScheduler/Celery beat) triggers: per source, per configured frequency.
2. Worker picks up source, respects `robots.txt` + `rate_limit`, caches responses.
3. Fetches HTML/JSON, extracts target elements via config (CSS selectors, XPath, or JSON paths).
4. Normalizes → raw JSON + parsed fields.
5. Dedupe against DB on `slug` (movies) / (`name`, `city`) (theaters).
6. Upsert into PostgreSQL.
7. Report: count, new rows, failures, sample data.

### Parallelism & politeness
- Concurrency per source: 2–4.
- Global: 8–16 concurrent requests, min 2s gap between sources.
- Respect `robots.txt`, cache responses, log failures.
- Use `httpx` timeout = 15s, retries = 2 with backoff.

### Data quality checks
- Minimum title length, valid URL format, date validity, theater venue existence.
- Flag low-confidence extractions; set `is_active=false` for suspicious records.
- Weekly review of source reliability scores.

### Deduplication & versioning
- Movies keyed by slug; theaters keyed by (name, city).
- Store raw scraped JSON for audit; `updated_at` tracks freshness.
- Optional: checksum of source config to detect breakage.

---

## 10. Web UI (MVP)

### Pages
1. **Home**: Hero, "Now Showing" carousel, quick filters.
2. **Movies**: Grid/list, search, genre filter, sort by release date.
3. **Movie detail**: Cast, trailer, genres, theaters + showtimes.
4. **Theaters**: List + map (optional), showtimes for selected movie.
5. **Showtimes**: Table: session times per theater per day.

### Interactions
- Search (debounced, 300ms).
- Filter by genre, theater, date.
- "Trailer" opens YouTube embed.
- Poster clicks → movie detail.

### Responsive
- Mobile-first; tables become cards on small screens.

---

## 11. API Design (REST)

- `GET /api/v1/movies` — list (search, genre, page, limit).
- `GET /api/v1/movies/{slug}` — detail.
- `GET /api/v1/theaters` — list.
- `GET /api/v1/theaters/{slug}/movies` — movies playing.
- `GET /api/v1/movies/{slug}/showtimes?date=` — showtimes.
- `GET /api/v1/sources` — source health.

Responses return JSON with `status`, `data`, `message`.

---

## 12. Scheduling & Deployment

### Scheduled refreshes
- GitHub Actions cron for scraping (free, simple).
- Or Redis + RQ/Celery on a server.
- Frequencies: sources vary (e.g., theaters daily, movie catalog weekly).

### Deployment
- Backend + DB + Redis in Docker.
- UI built to static + served via backend (or CDN).
- Recommended: Render/Railway/Node for easy hosting; AWS EC2 for more control.

### Secrets
- Store API keys / credentials in environment, not in code.

---

## 13. Monitoring & Quality

### Scraping health
- Source failure alerts (email/Slack via webhook).
- Per-source success/failure metrics.
- Data freshness dashboard (minutes since last scrape).

### Data quality
- Automated sanity checks on ingest (see Data Quality checks above).
- Alerts for data quality degradation.

### Uptime
- Health endpoint (`/health`).
- Error tracking (Sentry or similar) for production.

---

## 14. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Source sites block scrapers / change structure | High | Source config approach; multiple sources; periodic review; legal check on ToS |
| IP rate-limiting | Medium | Rotate IPs (if needed), cache responses, schedule off-peak |
| Legal/ToS concerns | High | Review each source's ToS; only aggregate publicly listed data; do not store copyrighted images; provide cache-busting |
| Data staleness | Medium | Fallback: manual seed data; alert on staleness; version scraping |
| Copyright of posters/trailers | Medium | Store links, not assets; let users access originals via sources |

---

## 15. Roadmap

- **Week 1–2**: Requirement finalization; source manifest + legal review; scaffold repo (frontend+backend).
- **Week 3–4**: MVP scraper for one source; DB schema; basic API.
- **Week 5–6**: Scrape 3–5 sources; normalizer; data quality checks.
- **Week 7**: Web UI MVP + search/filter.
- **Week 8**: Polish, testing, deploy, monitor.
- **Post-MVP**: favorites, notifications, mobile app, reviews.

---

## 16. Next Steps (immediate)

1. Confirm scope & sources with the user (which Nepali cinemas?).
2. Audit a source or two to validate scrape feasibility.
3. Scaffold the repo + CI.
4. Build the first scraper adapter + DB + basic API.
5. Then UI.

---

*Plan is intentionally phased so the first deliverable is a working scraper pipeline, not a
full product.*
