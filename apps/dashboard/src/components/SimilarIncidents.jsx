export default function SimilarIncidents({ items }) {
  if (!items) return <p className="muted">Loading…</p>;
  if (items.length === 0) return <p className="muted">No similar incidents found.</p>;
  return (
    <ul className="similar">
      {items.map((s, idx) => (
        <li key={s.incident_id || s._id || idx}>
          <strong>{s.classified_type || s.error_signature || 'incident'}</strong>
          {s.similarity != null && <span className="muted"> · similarity {Number(s.similarity).toFixed(2)}</span>}
          {s.message && <div className="muted">{s.message}</div>}
        </li>
      ))}
    </ul>
  );
}
