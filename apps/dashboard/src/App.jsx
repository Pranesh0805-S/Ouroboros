import { useEffect, useState } from 'react';
import client from './api/client';

export default function App() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    client.get('/metrics').then((r) => setMetrics(r.data)).catch((e) => setError(e.message));
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Ouroboros</h1>
      {error && <p style={{ color: 'crimson' }}>API error: {error}</p>}
      {metrics && <pre>{JSON.stringify(metrics, null, 2)}</pre>}
      {!metrics && !error && <p>Loading…</p>}
    </div>
  );
}
