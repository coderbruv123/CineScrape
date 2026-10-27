const API_BASE = '/api'

async function apiFetch(path, opts) {
  const res = await fetch(API_BASE + path, opts)
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body && body.detail) detail = body.detail
    } catch (_) {}
    throw new Error(detail)
  }
  return res.json()
}

export const api = {
  async health() {
    return apiFetch('/v1/health')
  },

  async getMovies({ limit = 20, offset = 0, search = '', genre = '' } = {}) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (search) params.append('search', search)
    if (genre) params.append('genre', genre)
    return apiFetch('/v1/movies?' + params.toString())
  },

  async getGenres() {
    const res = await apiFetch('/v1/movies?limit=500')
    const set = new Set()
    for (const m of res.data || []) {
      for (const g of String(m.genre || '').split(',')) {
        const t = g.trim()
        if (t) set.add(t)
      }
    }
    return [...set].sort()
  },

  async getMovie(slug) {
    return apiFetch('/v1/movies/' + encodeURIComponent(slug))
  },

  async getTheaters() {
    return apiFetch('/v1/theaters')
  },

  async getTheaterMovies(theaterId) {
    return apiFetch('/v1/theaters/' + theaterId + '/movies');
  },

  async getSources() {
    return apiFetch('/v1/sources');
  },

  async getPrices(movieSlug) {
    return apiFetch('/v1/prices?movie=' + encodeURIComponent(movieSlug));
  },

  // ------------------------------------------------------------- Khalti source
  async getKhaltiCinemas() {
    return apiFetch('/v1/khalti/cinemas');
  },

  async getKhaltiMovies() {
    return apiFetch('/v1/khalti/movies');
  },

  async getKhaltiMovieShowtimes(idx) {
    return apiFetch('/v1/khalti/movies/' + encodeURIComponent(idx));
  },
};
