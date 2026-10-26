import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';

export default function MovieDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getMovie(slug)
      .then((res) => setMovie(res))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    api.getPrices(slug)
      .then((res) => setTickets(res.theaters || []))
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
          {!loading && !error && tickets.length > 0 && (
            <section className="section">
              <div className="section__head">
                <h2>Tickets &amp; Cinemas</h2>
              </div>
              <div className="ticket-flow">
                {tickets.map((t) => (
                  <div key={t.slug} className="theater-row">
                    <div className="theater-row__name">
                      <span className="tmark">🎬</span> {t.name}
                    </div>
                    <div className="ticket-prices">
                      {t.prices.map((p, i) => (
                        <div key={i} className="ticket-item">
                          <span className="ticket-item__cat">{p.seat_category || 'General'}</span>
                          <span className="ticket-item__time">{p.time_from}–{p.time_to}</span>
                          <span className="ticket-item__price">Rs {Math.round(Number(p.price_regular))}</span>
                          {p.price_holiday != null && (
                            <span className="ticket-item__alt">holiday Rs {Math.round(Number(p.price_holiday))}</span>
                          )}
                          {p.price_new_release != null && (
                            <span className="ticket-item__alt">new Rs {Math.round(Number(p.price_new_release))}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {!loading && !error && tickets.length === 0 && (
            <p className="empty">No ticket prices yet for this movie.</p>
          )}
        </div>
      </div>
    </div>
  );
}
