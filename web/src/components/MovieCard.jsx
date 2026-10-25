import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';

export default function MovieCard({ movie }) {
  const meta = [];
  if (movie.year != null) meta.push(String(movie.year));
  if (movie.runtime_minutes != null) meta.push(movie.runtime_minutes + ' min');
  if (movie.genre) meta.push(movie.genre);

  return (
    <Link to={`/movies/${movie.slug}`} className="movie-card">
      <div className="movie-card__poster">
        {movie.poster_url ? (
          <img src={movie.poster_url} alt={movie.title || 'poster'} loading="lazy" />
        ) : (
          <span className="placeholder">No poster</span>
        )}
      </div>
      <div className="movie-card__body">
        <p className="movie-card__title">{movie.title || '(untitled)'}</p>
        <p className="movie-card__meta">{meta.join(' · ') || '—'}</p>
      </div>
    </Link>
  );
}
