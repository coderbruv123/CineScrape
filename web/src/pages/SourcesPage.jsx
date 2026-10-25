import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';

export default function SourcesPage() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getSources()
      .then((res) => setSources(res.data || []))
      .catch(() => setError('Could not load sources'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="section">
      <div className="section__head"><h2>Sources</h2></div>
      {loading ? (
        <div className="spinner"><div></div></div>
      ) : error ? (
        <p className="empty">{error}</p>
      ) : (
        <ul className="theater-list">
          {sources.map((s) => (
            <li key={s.id} className="theater-row">
              <span className="theater-row__name">{s.name}</span>
              <span className="theater-row__meta">{s.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
