import { Link } from 'react-router-dom';

const short = (s = '', n = 150) => (s.length > n ? s.slice(0, n) + '…' : s);

export default function SimilarIncidents({ items, error }) {
  if (error) return <p className="error">Similarity search failed: {error}</p>;
  if (!items) return <p className="muted">Loading…</p>;
  if (items.length === 0) return <p className="muted">No similar incidents found.</p>;
  return (
    <ul className="similar">
      {items.map((s) => {
        const [type] = (s.error_signature || '').split(':');
        return (
          <li key={s.id || s.incident_id}>
            <div>
              <strong>{type || 'incident'}</strong>
              <span className="muted"> · {Math.round((s.similarity || 0) * 100)}% match · </span>
              <Link to={`/incidents/${s.incident_id}`}>open →</Link>
            </div>
            <div className="muted">{short(s.error_signature)}</div>
          </li>
        );
      })}
    </ul>
  );
}
