import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { formatDate } from '../lib/format';

const STATUSES = ['all', 'new', 'classified', 'patched', 'tested', 'resolved'];

export default function IncidentFeed() {
  const [incidents, setIncidents] = useState([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/incidents')
      .then((r) => setIncidents(r.data.incidents))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const shown = filter === 'all' ? incidents : incidents.filter((i) => i.status === filter);

  return (
    <>
      <h1>Incident feed</h1>
      <div className="toolbar">
        {STATUSES.map((s) => (
          <button key={s} className={`chip ${filter === s ? 'on' : ''}`} onClick={() => setFilter(s)}>
            {s}
          </button>
        ))}
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">API error: {error}</p>}

      {!loading && !error && (
        <table>
          <thead>
            <tr><th>Time</th><th>Route</th><th>Error</th><th>Classified as</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {shown.map((i) => (
              <tr key={i._id}>
                <td>{formatDate(i.createdAt)}</td>
                <td>{i.route || '—'}</td>
                <td>{i.error_type}</td>
                <td>{i.classified_type || '—'}</td>
                <td><span className={`badge ${i.status}`}>{i.status}</span></td>
                <td><Link to={`/incidents/${i._id}`}>Review →</Link></td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={6} className="muted">No incidents with this status.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </>
  );
}
