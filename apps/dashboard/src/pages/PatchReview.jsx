import { useParams, Link } from 'react-router-dom';

export default function PatchReview() {
  const { id } = useParams();
  return (
    <>
      <p><Link to="/">← Back to feed</Link></p>
      <h1>Patch review</h1>
      <p className="muted">Incident {id}. Diff, sandbox result and approve/reject coming next.</p>
    </>
  );
}
