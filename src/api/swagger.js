/**
 * Cinema Scrapper — OpenAPI 3.0 spec.
 *
 * Generated from src/api/index.js routes:
 *   GET /api/v1/health
 *   GET /api/v1/sources
 *   GET /api/v1/movies
 *   GET /api/v1/movies/:slug
 *   GET /api/v1/theaters
 *   GET /api/v1/theaters/:id/movies
 *   GET /api/v1/prices
 *
 * Run:
 *   npm run dev          # start the Express server
 *   open http://localhost:4010/docs      # Swagger UI
 *   curl http://localhost:4010/api/openapi.json
 */

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Cinema Scrapper API',
      version: '1.0.0',
      description:
        'Nepali cinema aggregator — movies, theaters, showtimes, and ticket prices.\n' +
        'Primary data source: The Film Nepal (thefilmnepal.com) for movie/theater/showtime listings;\n' +
        'Showtime Nepal (showtimenepal.com) for per-cinema ticket prices.',
      contact: { name: 'Cinema Scrapper Team' },
      license: { name: 'MIT' },
    },
    servers: [{ url: 'http://localhost:4010', description: 'Local development' }],
    tags: [
      { name: 'Health', description: 'Liveness/status checks' },
      { name: 'Sources', description: 'Source dashboard (movie/theater data sources)' },
      { name: 'Movies', description: 'Movie catalog (search, genre, detail)' },
      { name: 'Theaters', description: 'Cinema theaters and their movies' },
      { name: 'Prices', description: 'Ticket prices by cinema (per auditorium/category/time band)' },
    ],
    paths: {
      '/api/v1/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          description: 'Returns service status.',
          responses: {
            '200': {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { status: { type: 'string' }, service: { type: 'string' } } },
                  example: { status: 'ok', service: 'cinemascrapper' },
                },
              },
            },
          },
        },
      },
      '/api/v1/sources': {
        get: {
          tags: ['Sources'],
          summary: 'List data sources',
          description: 'Returns every registered scraper source (name, URL, config, status).',
          responses: {
            '200': {
              description: 'List of sources',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer' },
                            name: { type: 'string' },
                            base_url: { type: 'string' },
                            status: { type: 'string' },
                            scrape_frequency_hours: { type: 'integer' },
                            reliability_score: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                  example: {
                    data: [
                      {
                        id: 1,
                        name: 'The Film Nepal',
                        base_url: 'https://www.thefilmnepal.com',
                        status: 'active',
                        scrape_frequency_hours: 24,
                        reliability_score: 1.0,
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/movies': {
        get: {
          tags: ['Movies'],
          summary: 'List movies',
          description: 'Search and filter the now-playing / active movie catalog.',
          parameters: [
            { name: 'genre', in: 'query', description: 'Filter by genre (e.g. Drama, Action)', schema: { type: 'string' } },
            { name: 'search', in: 'query', description: 'Search by title or slug', schema: { type: 'string' } },
            { name: 'limit', in: 'query', description: 'Max rows to return (default 50)', schema: { type: 'integer' } },
            { name: 'offset', in: 'query', description: 'Pagination offset (default 0)', schema: { type: 'integer' } },
          ],
          responses: {
            '200': {
              description: 'Movie list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer' },
                            slug: { type: 'string' },
                            title: { type: 'string' },
                            year: { type: 'integer' },
                            runtime_minutes: { type: 'integer' },
                            genre: { type: 'string' },
                            cast: { type: 'string' },
                            trailer_url: { type: 'string' },
                            poster_url: { type: 'string' },
                            certificate: { type: 'string' },
                            synopsis: { type: 'string' },
                            scraped_at: { type: 'string' },
                          },
                        },
                      },
                      count: { type: 'integer' },
                      limit: { type: 'integer' },
                      offset: { type: 'integer' },
                    },
                  },
                  example: {
                    data: [
                      {
                        id: 1,
                        slug: 'harishchandra',
                        title: 'Harishchandra',
                        year: 2016,
                        runtime_minutes: 145,
                        genre: 'Drama',
                        cast: 'Sushant KC',
                        poster_url: null,
                        scraped_at: '2026-10-25 10:32:06',
                      },
                    ],
                    count: 1,
                    limit: 50,
                    offset: 0,
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/movies/{slug}': {
        parameters: [
          { name: 'slug', in: 'path', required: true, description: 'Movie slug', schema: { type: 'string' } },
        ],
        get: {
          tags: ['Movies'],
          summary: 'Movie detail',
          description: 'Returns a single movie by slug.',
          responses: {
            '200': {
              description: 'Movie detail',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Movie' },
                },
              },
            },
            '404': { description: 'Movie not found' },
          },
        },
      },
      '/api/v1/theaters': {
        get: {
          tags: ['Theaters'],
          summary: 'List theaters',
          description: 'Returns every active cinema/theater.',
          responses: {
            '200': {
              description: 'Theater list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer' },
                            slug: { type: 'string' },
                            name: { type: 'string' },
                            city: { type: 'string' },
                            branch_count: { type: 'integer' },
                            scraped_at: { type: 'string' },
                          },
                        },
                      },
                      count: { type: 'integer' },
                    },
                  },
                  example: {
                    data: [
                      {
                        id: 1,
                        slug: 'big-movies',
                        name: 'Big Movies',
                        city: null,
                        branch_count: null,
                        scraped_at: '2026-10-25 10:32:06',
                      },
                    ],
                    count: 1,
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/theaters/{id}/movies': {
        parameters: [
          { name: 'id', in: 'path', required: true, description: 'Theater ID', schema: { type: 'integer' } },
        ],
        get: {
          tags: ['Theaters'],
          summary: 'Movies playing at a theater',
          description: 'Returns movies associated with a theater via showtimes.',
          responses: {
            '200': {
              description: 'Theater + movies',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      theater: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' }, city: { type: 'string' } } },
                      movies: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: { id: { type: 'integer' }, slug: { type: 'string' }, title: { type: 'string' }, genre: { type: 'string' }, year: { type: 'integer' } },
                        },
                      },
                    },
                  },
                },
              },
            },
            '404': { description: 'Theater not found' },
          },
        },
      },
      '/api/v1/prices': {
        get: {
          tags: ['Prices'],
          summary: 'Ticket prices (by cinema, by movie, or full list)',
          description:
            'Price comparison across Nepali cinemas. Prices come from Showtime Nepal\n' +
            '(showtimenepal.com) per cinema, per auditorium, per seat-category, per time band.\n' +
            'Optional params:\n' +
            '  movie=<slug>   → shows which cinemas are screening this movie and the prices\n' +
            '                   (joins showtimes → theaters → prices)\n' +
            '  theater=<name> → returns prices for a single theater',
          parameters: [
            {
              name: 'movie',
              in: 'query',
              description: 'Movie slug (filters to cinemas showing this film)',
              schema: { type: 'string' },
            },
            {
              name: 'theater',
              in: 'query',
              description: 'Theater name (returns prices for this cinema)',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Price data',
              content: {
                'application/json': {
                  schema: {
                    oneOf: [
                      { $ref: '#/components/schemas/PricesByMovie' },
                      { $ref: '#/components/schemas/PricesByTheater' },
                      { $ref: '#/components/schemas/PricesOverview' },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Movie: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            slug: { type: 'string' },
            title: { type: 'string' },
            year: { type: 'integer' },
            runtime_minutes: { type: 'integer' },
            genre: { type: 'string' },
            cast: { type: 'string' },
            trailer_url: { type: 'string' },
            poster_url: { type: 'string' },
            certificate: { type: 'string' },
            synopsis: { type: 'string' },
            scraped_at: { type: 'string' },
          },
        },
        Theater: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            slug: { type: 'string' },
            name: { type: 'string' },
            city: { type: 'string' },
            branch_count: { type: 'integer' },
            scraped_at: { type: 'string' },
          },
        },
        PriceRow: {
          type: 'object',
          properties: {
            theater_name: { type: 'string' },
            auditorium: { type: 'string' },
            seat_category: { type: 'string' },
            time_from: { type: 'string' },
            time_to: { type: 'string' },
            price_regular: { type: 'number' },
            price_holiday: { type: 'number' },
            price_new_release: { type: 'number' },
          },
        },
        PricesByMovie: {
          type: 'object',
          properties: {
            movie: { type: 'string' },
            theaters: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  slug: { type: 'string' },
                  name: { type: 'string' },
                  prices: { type: 'array', items: { $ref: '#/components/schemas/PriceRow' } },
                },
              },
            },
          },
        },
        PricesByTheater: {
          type: 'object',
          properties: {
            theater: { type: 'string' },
            prices: { type: 'array', items: { $ref: '#/components/schemas/PriceRow' } },
          },
        },
        PricesOverview: {
          type: 'object',
          properties: {
            theaters: {
              type: 'array',
              items: {
                type: 'object',
                properties: { name: { type: 'string' }, count: { type: 'integer' } },
              },
            },
            total: { type: 'integer' },
          },
        },
      },
    },
  },
};

export default options;
