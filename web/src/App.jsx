import { useState, useEffect } from 'react';
import { Link, Routes, Route } from 'react-router-dom';
import { api } from './api.js';
import HomePage from './pages/HomePage.jsx';
import MovieDetailPage from './pages/MovieDetailPage.jsx';
import TheatersPage from './pages/TheatersPage.jsx';

function SourcesPage() {
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

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <Link to="/" className="brand">
            <span className="brand__mark">🎬</span>
            <span className="brand__name">Cinema Scrapper</span>
          </Link>
          <nav className="app-header__nav">
            <Link to="/">Now Showing</Link>
            <Link to="/theaters">Theaters</Link>
            <Link to="/sources">Sources</Link>
          </nav>
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/movies/:slug" element={<MovieDetailPage />} />
          <Route path="/theaters" element={<TheatersPage />} />
          <Route path="/sources" element={<SourcesPage />} />
          <Route path="/" element={<HomePage />} />
        </Routes>
      </main>
      <footer className="app-footer">Cinema Scrapper — aggregated from The Film Nepal</footer>
    </div>
  );
}
