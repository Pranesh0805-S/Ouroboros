import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';
import { formatDate } from '../lib/format';
import DiffViewer from '../components/DiffViewer.jsx';
import TestResultBadge from '../components/TestResultBadge.jsx';
import SimilarIncidents from '../components/SimilarIncidents.jsx';

const errMsg = (e) => e.response?.data?.error || e.message;

export default function PatchReview() {
  const { id } = useParams(); // incident id
  const [incident, setIncident] = useState(null);
  const [patches, setPatches] = useState([]);
  const [selected, setSelected] = useState(0);
  const [original, setOriginal] = useState(null);
  const [similar, setSimilar] = useState(null);
  const [similarError, setSimilarError] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const loadPatches = useCallback(async () => {
    const r = await client.get(`/patches/${id}`);
    setPatches(r.data.patches);
    return r.data.patches;
  }, [id]);

  useEffect(() => {
    client.get('/incidents')
      .then((r) => setIncident(r.data.incidents.find((i) => i._id === id) || null))
      .catch((e) => setError(errMsg(e)));
    loadPatches().catch((e) => setError(errMsg(e)));
    setSimilar(null);
    setSimilarError(null);
    client.get(`/incidents/${id}/similar`)
      .then((r) => setSimilar(r.data.similar_incidents || []))
      .catch((e) => { setSimilar([]); setSimilarError(errMsg(e)); });
  }, [id, loadPatches]);

  const patch = patches[selected];

  useEffect(() => {
    setOriginal(null);
    if (!patch) return;
    client.get(`/patches/${patch._id}/original`)
      .then((r) => setOriginal(r.data.original))
      .catch((e) => setOriginal(`// Could not load original file: ${errMsg(e)}`));
  }, [patch?._id]);

  const run = async (label, fn) => {
    setBusy(label);
    setError(null);
    try { await fn(); } catch (e) { setError(errMsg(e)); }
    setBusy(null);
  };

  const generate = () => run('generate', async () => {
    await client.post(`/patches/${id}/generate`);
    await loadPatches();
    setSelected(0);
  });
  const test = () => run('test', async () => {
    await client.post(`/patches/${patch._id}/test`);
    await loadPatches();
  });
  const review = (decision) => run(decision, async () => {
    await client.post(`/patches/${patch._id}/${decision}`, { note });
    setNote('');
    await loadPatches();
  });

  const pending = patch && (patch.approval_status || 'pending') === 'pending';
  const canApprove = pending && patch.test_result === 'passed';

  return (
    <>
      <p><Link to="/">← Back to feed</Link></p>
      <h1>Patch review</h1>

      {error && <p className="error">{error}</p>}

      {incident && (
        <div className="card section">
          <div className="label">Incident · {formatDate(incident.createdAt)}</div>
          <div><strong>{incident.error_type}</strong> on {incident.route || '—'}</div>
          <p className="muted">{incident.message}</p>
          <div>
            <span className={`badge ${incident.status}`}>{incident.status}</span>{' '}
            <span className="muted">classified as {incident.classified_type || '—'}</span>
          </div>
          {incident.stack && <pre className="code">{incident.stack}</pre>}
        </div>
      )}

      <div className="toolbar">
        <button className="btn primary" disabled={busy || !incident?.classified_type} onClick={generate}>
          {busy === 'generate' ? 'Generating…' : patches.length ? 'Generate another patch' : 'Generate patch'}
        </button>
        {patches.length > 1 && (
          <select className="btn" value={selected} onChange={(e) => setSelected(Number(e.target.value))}>
            {patches.map((p, idx) => (
              <option key={p._id} value={idx}>Patch {patches.length - idx} · {formatDate(p.createdAt)}</option>
            ))}
          </select>
        )}
      </div>

      {!patch && <p className="muted">No patch yet. Generate one to start the review.</p>}

      {patch && (
        <>
          <div className="card section">
            <div className="label">Patch for {patch.target_file}</div>
            <p>{patch.explanation || 'No explanation provided.'}</p>
            <div className="meta">
              <span>Confidence: <strong>{patch.confidence_score ?? '—'}</strong></span>
              <span>Sandbox: <TestResultBadge result={patch.test_result} /></span>
              <span>Approval: <span className={`badge ${patch.approval_status === 'approved' ? 'resolved' : patch.approval_status === 'rejected' ? 'failed' : 'new'}`}>{patch.approval_status || 'pending'}</span></span>
            </div>
          </div>

          {original === null ? <p className="muted">Loading original file…</p> : (
            <DiffViewer oldValue={original} newValue={patch.generated_diff} />
          )}

          <div className="card section">
            <div className="label">Sandbox result</div>
            {patch.test_details?.ran_at ? (
              <>
                <p>
                  {patch.test_details.pass}/{patch.test_details.tests} tests passed
                  {' '}· {patch.test_details.durationMs}ms · {patch.test_details.testFile}
                </p>
                <pre className="code">{patch.test_details.output}</pre>
              </>
            ) : <p className="muted">Not tested yet.</p>}
            <button className="btn" disabled={busy} onClick={test}>
              {busy === 'test' ? 'Running in Docker…' : patch.test_details?.ran_at ? 'Re-run sandbox test' : 'Run sandbox test'}
            </button>
          </div>

          <div className="card section">
            <div className="label">Review decision</div>
            {pending ? (
              <>
                <input className="note" placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="toolbar">
                  <button className="btn success" disabled={busy || !canApprove} onClick={() => review('approve')}>Approve</button>
                  <button className="btn danger" disabled={busy} onClick={() => review('reject')}>Reject</button>
                </div>
                {!canApprove && <p className="muted">Approve unlocks after the patch passes the sandbox test.</p>}
              </>
            ) : (
              <p>
                {patch.approval_status} {patch.reviewed_at && `on ${formatDate(patch.reviewed_at)}`}
                {patch.review_note && <span className="muted"> · “{patch.review_note}”</span>}
              </p>
            )}
          </div>
        </>
      )}

      <div className="card section">
        <div className="label">Similar past incidents</div>
        <SimilarIncidents items={similar} error={similarError} />
      </div>
    </>
  );
}
