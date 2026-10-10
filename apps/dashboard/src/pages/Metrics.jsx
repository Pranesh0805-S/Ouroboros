import { useEffect, useState } from 'react';
import client from '../api/client';
import { formatDuration } from '../lib/format';

function Breakdown({ title, data }) {
  return (
    <div className="card">
      <div className="label">{title}</div>
      <ul>
        {Object.entries(data || {}).map(([k, v]) => (
          <li key={k}><span>{k}</span><strong>{v}</strong></li>
        ))}
      </ul>
    </div>
  );
}

export default function Metrics() {
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    client.get('/metrics').then((r) => setM(r.data)).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">API error: {error}</p>;
  if (!m) return <p className="muted">Loading…</p>;

  return (
    <>
      <h1>Metrics</h1>
      <div className="cards">
        <div className="card"><div className="label">Total incidents</div><div className="value">{m.total_incidents}</div></div>
        <div className="card"><div className="label">Awaiting review</div><div className="value">{m.awaiting_review}</div></div>
        <div className="card"><div className="label">Mean time to patch</div><div className="value">{formatDuration(m.mean_time_to_patch_ms)}</div></div>
      </div>
      <div className="cards">
        <Breakdown title="Incidents by status" data={m.incidents_by_status} />
        <Breakdown title="Patches by sandbox result" data={m.patches_by_test_result} />
        <Breakdown title="Patches by approval" data={m.patches_by_approval} />
      </div>
    </>
  );
}
