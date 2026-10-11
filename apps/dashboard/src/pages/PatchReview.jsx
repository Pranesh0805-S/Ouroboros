import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';
import { formatDate } from '../lib/format';
import DiffViewer from '../components/DiffViewer.jsx';
import TestResultBadge from '../components/TestResultBadge.jsx';
import SimilarIncidents from '../components/SimilarIncidents.jsx';

const errMsg = (e) => e.response?.data?.error || e.message;

const OUTCOME_BADGE = { success: 'resolved', reverted: 'failed', pending: 'new' };

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
  const [info, setInfo] = useState(null);

  const loadIncident = useCallback(async () => {
    const r = await client.get('/incidents');
    setIncident(r.data.incidents.find((i) => i._id === id) || null);
  }, [id]);

  const loadPatches = useCallback(async () => {
    const r = await client.get(`/patches/${id}`);
    setPatches(r.data.patches);
    return r.data.patches;
  }, [id]);

  useEffect(() => {
    loadIncident().catch((e) => setError(errMsg(e)));
    loadPatches().catch((e) => setError(errMsg(e)));
    setSimilar(null);
    setSimilarError(null);
    client.get(`/incidents/${id}/similar`)
      .then((r) => setSimilar(r.data.similar_incidents || []))
      .catch((e) => { setSimilar([]); setSimilarError(errMsg(e)); });
  }, [id, loadIncident, loadPatches]);

  const patch = patches[selected];

  useEffect(() => {
    setOriginal(null);
    if (!patch) return;
    // once applied, the file on disk IS the patch, so show the saved backup instead
    if (patch.deployed && patch.original_code) {
      setOriginal(patch.original_code);
      return;
    }
    client.get(`/patches/${patch._id}/original`)
      .then((r) => setOriginal(r.data.original))
      .catch((e) => setOriginal(`// Could not load original file: ${errMsg(e)}`));
  }, [patch?._id, patch?.deployed]);

  const run = async (label, fn) => {
    setBusy(label);
    setError(null);
    setInfo(null);
    try { await fn(); } catch (e) { setError(errMsg(e)); }
    setBusy(null);
  };

  const generate = () => run('generate', async () => {
    await client.post(`/patches/${id}/generate`);
    await loadPatches();
    await loadIncident();
    setSelected(0);
  });

  const autoPatch = () => run('auto', async () => {
    const r = await client.post(`/patches/${id}/auto`);
    await loadPatches();
    await loadIncident();
    setSelected(0);
    setInfo(`Auto-patch finished: ${r.data.status} after ${r.data.attempts_used} attempt(s).`);
  });

  const test = () => run('test', async () => {
    await client.post(`/patches/${patch._id}/test`);
    await loadPatches();
    await loadIncident();
  });

  const review = (decision) => run(decision, async () => {
    await client.post(`/patches/${patch._id}/${decision}`, { note });
    setNote('');
    await loadPatches();
  });

  const apply = () => run('apply', async () => {
    const r = await client.post(`/patches/${patch._id}/apply`);
    await loadPatches();
    await loadIncident();
    setInfo(
      r.data.outcome === 'success'
        ? 'Patch applied. Outcome check passed.'
        : 'Outcome check failed. The file was rolled back to the original.'
    );
  });

  const pending = patch && (patch.approval_status || 'pending') === 'pending';
  const canApprove = pending && patch.test_result === 'passed';
  const canApply =
    patch &&
    patch.approval_status === 'approved' &&
    patch.test_result === 'passed' &&
    !patch.deployed &&
    patch.outcome !== 'reverted';

  return (
    <>
      <p><Link to="/">← Back to feed</Link></p>
      <h1>Patch review</h1>

      {error && <p className="error">{error}</p>}
      {info && <p className="muted">{info}</p>}

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
        <button className="btn primary" disabled={busy || !incident?.classified_type} onClick={autoPatch}>
          {busy === 'auto' ? 'Auto-patching (up to 3 tries)…' : 'Auto-patch (retry on failure)'}
        </button>
        <button className="btn" disabled={busy || !incident?.classified_type} onClick={generate}>
          {busy === 'generate' ? 'Generating…' : patches.length ? 'Generate single patch' : 'Generate patch'}
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
              <span>Outcome: <span className={`badge ${OUTCOME_BADGE[patch.outcome] || 'new'}`}>{patch.outcome || 'pending'}</span></span>
            </div>
          </div>

          {patch.attempts?.length > 0 && (
            <div className="card section">
              <div className="label">Generation attempts ({patch.attempts.length})</div>
              {patch.attempts.map((a) => (
                <details key={a.attempt}>
                  <summary>
                    Attempt {a.attempt} · <TestResultBadge result={a.test_result} />
                    {' '}· {a.pass ?? '—'} passed, {a.fail ?? '—'} failed
                  </summary>
                  {a.explanation && <p className="muted">{a.explanation}</p>}
                  <pre className="code">{a.output}</pre>
                </details>
              ))}
            </div>
          )}

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
            <button className="btn" disabled={busy || patch.deployed} onClick={test}>
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

          <div className="card section">
            <div className="label">Apply and outcome check</div>
            {patch.outcome_check?.checked_at ? (
              <>
                <p>
                  Outcome check: <TestResultBadge result={patch.outcome_check.status} />
                  {' '}· {patch.outcome_check.pass ?? '—'} passed, {patch.outcome_check.fail ?? '—'} failed
                  {' '}· {formatDate(patch.outcome_check.checked_at)}
                </p>
                {patch.outcome === 'reverted' && (
                  <p className="muted">The outcome check failed, so the original file was restored. Generate a new patch.</p>
                )}
              </>
            ) : (
              <p className="muted">Not applied yet.</p>
            )}
            <button className="btn primary" disabled={busy || !canApply} onClick={apply}>
              {busy === 'apply' ? 'Applying and verifying…' : 'Apply to sample app'}
            </button>
            {!canApply && !patch.deployed && patch.outcome !== 'reverted' && (
              <p className="muted">Apply unlocks after the patch is approved.</p>
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