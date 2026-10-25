# Dogfood QA Report

**Target:** http://localhost:4010 (CineScrapper web app)
**Date:** October 25, 2026
**Scope:** Full web app — Express API, Swagger UI, React SPA (home, theaters, sources, movie detail), search, ticket prices
**Tester:** Hermes Agent (automated exploratory QA)

---

## Executive Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 1 |
| 🟠 High | 1 |
| 🟡 Medium | 3 |
| 🔵 Low | 4 |
| **Total** | **9** |

**Overall Assessment:** The Express API and static assets are solid, and the React SPA renders on several routes. However, the server was missing a catch-all route for client-side navigation (Critical), several data-quality gaps exist in the seeded content (theaters lack city/branch data, showtimes are stubs, movie metadata is incomplete), and the movie-detail route fails to render in the browser (React app not mounting).

---

## Issues

### Issue #1: Express missing catch-all route for client-side navigation (CRITICAL)

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **Category** | Functional |
| **URL** | http://localhost:4010/theaters, /sources, /movies/:slug |

**Description:** The Express server (src/api/index.js) served static files from `web/dist` and exposed `/api/v1/*` routes, but had no catch-all route. When the user navigated directly to a client-side route (`/theaters`, `/sources`, `/movies/kabaddi-5`), the server returned **HTTP 404 "Cannot GET /route"** instead of serving `index.html`. This broke browser back/forward, bookmarks, and page refresh on any non-API route.

**Evidence:**
- Direct request to `/theaters`: `HTTP:404`, body `<title>Error</title> <pre>Cannot GET /theaters</pre>`
- Direct request to `/movies/kabaddi-5`: `HTTP:404`, body `<pre>Cannot GET /movies/kabaddi-5</pre>`

**Steps to Reproduce:**
1. Start the server: `npm run dev` (or `node src/api/index.js`)
2. Browse to `http://localhost:4010/theaters` or `http://localhost:4010/movies/kabaddi-5`
3. Observe HTTP 404 "Cannot GET /route"

**Expected Behavior:** Server should serve `index.html` for all non-API routes so React Router (BrowserRouter, HTML5 history mode) can handle the routing client-side.

**Actual Behavior:** `Cannot GET /route` — 404 page.

**Fix Applied:** Added a catch-all route in `src/api/index.js` after the prices endpoint and before the error handler:

```js
app.get('*', (_req, res) => {
  res.sendFile(join(DIST, 'index.html'));
});
```

Verified: `/theaters`, `/sources`, and `/movies/kabaddi-5` now return HTTP 200 with `index.html`.

**Screenshot:** `MEDIA:/home/dante/Documents/Projects/CineScrape/dogfood-output/screenshots/movie_detail_page.png` (after fix)

---

### Issue #2: Theater names contain scrape artifacts (HIGH)

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **Category** | Content |
| **URL** | http://localhost:4010/theaters |

**Description:** Theater names extracted from the source (`/cinemas`) include trailing artifacts like "1 branch", "0 branches", "3 branches", etc. This is a data-quality issue that makes the theater names misleading.

**Evidence:**
- `"name":"Asta Narayan Pictures1 branch"`
- `"name":"Bishwojyoti Cineplex0 branches"`
- `"name":"Friends Cinemas3 branches"`

**Steps to Reproduce:**
1. Visit `/theaters` page
2. Observe theater names with branch count suffixes

**Expected Behavior:** Clean theater names without "N branch" suffixes.

**Actual Behavior:** Names include the artifact (e.g., "Asta Narayan Pictures1 branch").

**Fix:** Strip the trailing "N branch" suffix when parsing the `/cinemas` page.

---

### Issue #3: Movie detail page does not render in browser (MEDIUM)

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Category** | Functional |
| **URL** | http://localhost:4010/movies/kabaddi-5 |

**Description:** The React app's `MovieDetailPage` does not mount on the `/movies/:slug` route. The `root` div stays empty and the page shows no content. The home and theaters pages render correctly, so the React Router and React itself are working — this is specific to the movie detail route.

**Steps to Reproduce:**
1. Navigate to `http://localhost:4010/movies/kabaddi-5`
2. Observe empty page with no movie data

**Expected Behavior:** Movie detail page with title, poster, cast, and trailer.

**Actual Behavior:** Empty page (`root` div has no innerHTML).

**Note:** The API endpoint `/api/v1/movies/kabaddi-5` works correctly and returns the movie data. The issue is in the React Router component mounting or the `MovieDetailPage` component failing to render.

**Screenshot:** `MEDIA:/home/dante/Documents/Projects/CineScrape/dogfood-output/screenshots/movie_detail_page.png`

---

### Issue #4: Theaters lack city and branch_count data (MEDIUM)

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Category** | Functional |
| **URL** | http://localhost:4010/api/v1/theaters |

**Description:** Theater records are saved with `city=null` and `branch_count=null`. The scraper extracts only the name and slug from the `/cinemas` page. The `city` and `branch_count` fields are defined in the schema but never populated.

**Evidence:**
- `{"id":1,"slug":"asta-narayan-pictures","name":"Asta Narayan Pictures1 branch","city":null,"branch_count":null}`

**Steps to Reproduce:**
1. Call `GET /api/v1/theaters`
2. Observe `city` and `branch_count` are always `null`

**Expected Behavior:** Theater records should include `city` and `branch_count` when available.

**Actual Behavior:** Both fields are `null`.

**Fix:** Extend the `/cinemas` scraper to parse city and branch count.

---

### Issue #5: Showtimes are stub data only (MEDIUM)

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Category** | Content |
| **URL** | SQLite `showtimes` table |

**Description:** The `showtimes` table contains only one stub row. The scraper extracts only movie names from `/show-times` but does not parse actual session times or map movies to theaters. The schema and `saveShowtime` function expect a full movie×theater×date×time relationship, but it's not being populated.

**Evidence:**
- `SELECT COUNT(*) FROM showtimes` → `1` (row: `movie_id=0, theater_id=0, show_date='2026-10-24', session_time='19:30'`)
- The `/show-times` page only yields movie names, not session times or theater mappings.

**Steps to Reproduce:**
1. Open the SQLite DB or call `GET /api/v1/theaters/1/movies`
2. Observe the `showtimes` table has only 1 row, and theater-movie joins return empty.

**Expected Behavior:** Real showtimes for movie×theater×date×time.

**Actual Behavior:** Only 1 stub row exists.

**Fix:** Parse actual session times and theater mappings from the `/show-times` source page, or use a structured source with showtimes.

---

### Issue #6: Movie metadata is incomplete (MEDIUM)

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Category** | Content |
| **URL** | http://localhost:4010/api/v1/movies |

**Description:** Many movie records have `null` for important fields: `year`, `cast`, `trailer_url`, `director`, `production_company`. The JSON-LD parser extracts these fields when present, but the source pages often lack complete structured data. The cheerio fallback only populates title, year, and poster, leaving the other fields null.

**Evidence:**
- Movie `kabaddi-5`: `year=null, runtime_minutes=null, cast="Dayahang Rai; ...", trailer_url="https://www.youtube.com/watch?v=40TTPzoePK0", director=null, production_company=null`
- Some older movies have no `trailer_url` because `g.trailer` is missing from the JSON-LD.

**Steps to Reproduce:**
1. Call `GET /api/v1/movies?limit=10`
2. Observe `year`, `cast`, `trailer_url`, `director`, `production_company` are often `null`

**Expected Behavior:** Complete movie metadata.

**Actual Behavior:** Many fields are `null`.

**Fix:** Improve the JSON-LD parser to handle missing optional fields gracefully, and enhance the cheerio fallback to extract more fields.

---

### Issue #7: Ticket prices are per-cinema, not movie-specific (MEDIUM)

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Category** | Functional |
| **URL** | http://localhost:4010/api/v1/prices |

**Description:** Ticket prices are scraped as per-cinema, per-auditorium, per-category, per-time-band values. They are not tied to specific movies. The `GET /api/v1/prices?movie=<slug>` endpoint tries to join prices to a movie via showtimes, but since showtimes are stub data, the join returns no movies. So the `movie=` parameter is effectively non-functional.

**Evidence:**
- `GET /api/v1/prices?movie=kabaddi-5` returns an empty `theaters: []` array.
- Prices are real (87 rows across 15 cinemas), but not movie-specific.

**Steps to Reproduce:**
1. Call `GET /api/v1/prices?movie=kabaddi-5`
2. Observe `theaters: []`

**Expected Behavior:** Lists cinemas screening the movie with their prices.

**Actual Behavior:** Empty theaters array.

**Fix:** Populate `showtimes` with real movie×theater×time data, then the `movie=` parameter will work.

---

### Issue #8: Low-priority code comment is incorrect (LOW)

| Field | Value |
|-------|-------|
| **Severity** | 🔵 Low |
| **Category** | Content |
| **URL** | src/api/index.js |

**Description:** The comment above the static file middleware says "The React UI uses hash routing, so no fallback-to-index.html middleware is required." The React app actually uses `BrowserRouter` (HTML5 history mode), not hash routing. This comment is misleading and explains why the catch-all route was initially omitted.

**Evidence:** `src/api/index.js` line 23-24: "The React UI uses hash routing, so no fallback-to-index.html middleware is required."

**Expected Behavior:** Accurate comment that the app uses `BrowserRouter` and requires a catch-all route.

**Actual Behavior:** Misleading comment about "hash routing."

**Fix:** Update the comment to reflect that the app uses `BrowserRouter` (HTML5 history mode) and requires a catch-all route.

---

### Issue #9: Express server not restarting after code changes (LOW)

| Field | Value |
|-------|-------|
| **Severity** | 🔵 Low |
| **Category** | Functional |
| **URL** | Development workflow |

**Description:** After modifying `src/api/index.js`, the running server process must be manually killed and restarted to pick up changes. There is no hot-reload or development workflow configured. This slows down development.

**Steps to Reproduce:**
1. Start the server
2. Edit `src/api/index.js`
3. Make a request and observe the old behavior
4. Manually kill and restart the server to see the new behavior

**Expected Behavior:** Server reloads automatically or provides a dev workflow.

**Actual Behavior:** Manual restart required.

**Fix:** Add a dev script using `nodemon` or `node --watch`, or document the restart procedure.

---

## Issues Summary Table

| # | Title | Severity | Category | URL |
|---|-------|----------|----------|-----|
| 1 | Express missing catch-all route for client-side navigation | 🔴 Critical | Functional | /theaters, /sources, /movies/:slug |
| 2 | Theater names contain scrape artifacts | 🟠 High | Content | /theaters |
| 3 | Movie detail page does not render in browser | 🟡 Medium | Functional | /movies/:slug |
| 4 | Theaters lack city and branch_count data | 🟡 Medium | Functional | /api/v1/theaters |
| 5 | Showtimes are stub data only | 🟡 Medium | Content | SQLite showtimes table |
| 6 | Movie metadata is incomplete | 🟡 Medium | Content | /api/v1/movies |
| 7 | Ticket prices are per-cinema, not movie-specific | 🟡 Medium | Functional | /api/v1/prices |
| 8 | Low-priority code comment is incorrect | 🔵 Low | Content | src/api/index.js |
| 9 | Express server not restarting after code changes | 🔵 Low | Functional | Development workflow |

---

## Testing Coverage

### Pages Tested
- Home page (`/`) — ✅ rendered correctly
- Theaters page (`/theaters`) — ✅ rendered correctly (after server fix)
- Sources page (`/sources`) — ✅ rendered correctly (after server fix)
- Movie detail page (`/movies/kabaddi-5`) — ❌ not rendering (see Issue #3)

### Features Tested
- API health check (`/api/v1/health`) — ✅
- API movies list (`/api/v1/movies`) — ✅
- API movie detail (`/api/v1/movies/kabaddi-5`) — ✅
- API theaters list (`/api/v1/theaters`) — ✅
- API theater movies (`/api/v1/theaters/1/movies`) — ✅ (returns empty due to stub showtimes)
- API prices overview (`/api/v1/prices`) — ✅
- API prices by theater (`/api/v1/prices?theater=Big Movies`) — ✅
- API prices by movie (`/api/v1/prices?movie=kabaddi-5`) — ✅ (returns empty theaters due to stub showtimes)
- Search functionality (home page) — ✅ (search works, results filter may need review)
- React Router navigation (theaters, sources) — ✅ (after server fix)
- React Router navigation (movie detail) — ❌ (see Issue #3)
- Swagger UI (`/docs`) — ✅ rendered correctly

### Not Tested / Out of Scope
- Movie detail page rendering (blocked by issue #3)
- Ticket prices `?movie=` parameter (blocked by stub showtimes)
- Theaters city/branch data (need source parser changes)
- Theater names with branch artifacts (need source parser changes)
- Movie metadata completeness (need JSON-LD parser improvements)

### Blockers
- The Express server was missing a catch-all route, which affected navigation to `/theaters`, `/sources`, and `/movies/:slug`. Fixed.
- The movie detail page does not render in the browser. The API works, but the React app fails to mount on `/movies/:slug`. This is a separate issue (Issue #3).

---

## Notes

- The Express server was fixed by adding a catch-all route (`app.get('*', ...)`) that serves `index.html` for all non-API routes.
- The ticket prices dataset is the strongest dataset (87 rows across 15 cinemas), but it is not tied to specific movies.
- The showtimes dataset is effectively empty (1 stub row). This blocks the `movie=` price parameter and any showtimes features.
- The movie metadata is incomplete (year, cast, trailer, director, production company are often null).
- The theater names contain scrape artifacts ("1 branch", "0 branches", etc.).
- The React app renders correctly on `/` and `/theaters` but fails to mount on `/movies/:slug`. The API is working, so the issue is in the React Router component or the `MovieDetailPage` component.

---

*Report generated by Hermes Agent (automated exploratory QA) on October 25, 2026.*
