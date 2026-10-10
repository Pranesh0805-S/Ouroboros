export default function TestResultBadge({ result }) {
  const map = { passed: 'resolved', failed: 'failed', error: 'failed', timeout: 'failed', pending: 'new' };
  return <span className={`badge ${map[result] || 'new'}`}>{result || 'pending'}</span>;
}
