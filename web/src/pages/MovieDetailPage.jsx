import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import TheatersList from '../components/TheatersList.jsx';

export default function MovieDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [theaters, setTheaters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getMovie(slug)
      .then((res) => setMovie(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    api.getTheaters()
      .then((res) => setTheaters(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  if (!movie && !error) return <Spinner full />;

  const meta = [];
  if (movie.year != null) meta.push(String(movie.year));
  if (movie.runtime_minutes != null) meta.push(movie.runtime_minutes + ' min');
  if (movie.genre) meta.push(movie.genre);

  return (
    <div>
      <button className="btn-tall" onClick={() => navigate('/')}>← Back</button>
      <div className="detail-hero">
        <div className="detail-hero__poster">
          {movie.poster_url ? (
            <img src={movie.poster_url} alt={movie.title || 'poster'} />
          ) : (
            <span className="placeholder">No poster</span>
          )}
        </div>
        <div className="detail-body">
          <h1>{movie.title || '(untitled)'}</h1>
          <div className="meta">
            <div className="row"><span className="label">Year</span><span className="val">{meta[0] || '—'}</span></div>
            <div className="row"><span className="label">Runtime</span><span className="val">{meta[1] || '—'}</span></div>
            <div className="row"><span className="label">Genre</span><span className="val">{movie.genre || '—'}</span></div>
            <div className="row"><span className="label">Cast</span><span className="val">{movie.cast || '—'}</span></div>
            {movie.trailer_url && (
              <div className="row">
                <span className="label">Trailer</span>
                <a className="url" href={movie.trailer_url} target="_blank" rel="noopener">{movie.trailer_url}</a>
              </div>
            )}
            {movie.synopsis && (
              <div className="row">
                <span className="label">Synopsis</span>
                <span className="val">{movie.synopsis}</span>
              </div>
            )}
          </div>
          {error && <ErrorMessage message={error} />}
          {loading && !error && <Spinner />}
          {!loading && !error && theaters.length > 0 && (
            <section className="section">
              <h2>Theaters showing this movie</h2>
              <TheatersList theaters={theaters} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
