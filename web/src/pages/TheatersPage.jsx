import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';

export default function TheatersPage() {
  const navigate = useNavigate();
  const [theaters, setTheaters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getTheaters()
      .then((res) => setTheaters(res.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <button className="btn-tall" onClick={() => navigate('/')}>← Back</button>
      {error && <ErrorMessage message={error} />}
      {loading && !error && <Spinner full />}
      {!loading && !error && theaters.length === 0 && <p className="empty">No theaters found.</p>}
      {!loading && !error && theaters.length > 0 && (
        <div className="section">
          <div className="section__head"><h2>Theaters</h2><span className="count">{theaters.length}</span></div>
          <div className="theater-list">
            {theaters.map((t) => (
              <div key={t.id} className="theater-row">
                <span className="theater-row__name">{t.name}</span>
                <span className="theater-row__meta">{t.city || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
