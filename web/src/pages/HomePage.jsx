import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import MovieCard from '../components/MovieCard.jsx';
import TheatersList from '../components/TheatersList.jsx';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';

export default function HomePage() {
  const [movies, setMovies] = useState([]);
  const [genres, setGenres] = useState([]);
  const [theaters, setTheaters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  const load = async (reset = true) => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit, offset: reset ? 0 : page * limit, search, genre };
      const res = await api.getMovies(params);
      setMovies(res.data || []);
      setPage(res.data && res.data.length < limit ? 0 : page + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.getGenres().then(setGenres).catch(() => {});
    load(true);
  }, []);

  const handleSearch = (reset = true) => {
    setPage(0);
    load(reset);
  };

  return (
    <div className="home">
      <section className="hero">
        <h1>Now Showing</h1>
        <p>Nepali cinema, one place.</p>
        <div className="hero__search">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search movies or slugs..."
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <select value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option value="">All genres</option>
            {genres.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <button className="primary" onClick={() => handleSearch(true)}>Search</button>
        </div>
      </section>

      {error && <ErrorMessage message={error} onRetry={() => handleSearch(true)} />}
      {loading && !error && <Spinner full />}
      {!loading && !error && movies.length === 0 && <p className="empty">No movies found.</p>}

      {!loading && !error && movies.length > 0 && (
        <>
          <section className="section">
            <div className="section__head">
              <h2>Movies</h2>
              <span className="count">{movies.length}</span>
            </div>
            <div className="movie-grid">
              {movies.map((m) => (
                <MovieCard key={m.id} movie={m} />
              ))}
            </div>
            {movies.length === limit && page > 0 && (
              <button className="btn" onClick={() => load(false)}>Load more</button>
            )}
          </section>

          <section className="section">
            <div className="section__head">
              <h2>Theaters</h2>
              <span className="count">{theaters.length}</span>
            </div>
            <TheatersList theaters={theaters} />
          </section>
        </>
      )}
    </div>
  );
}
