import ReactDiffViewer from 'react-diff-viewer-continued';

// strip BOM, unify line endings, ignore trailing whitespace so only real changes show
const normalize = (s = '') =>
  s.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\s+$/, '') + '\n';

export default function DiffViewer({ oldValue, newValue }) {
  return (
    <div className="diff-wrap">
      <ReactDiffViewer
        oldValue={normalize(oldValue)}
        newValue={normalize(newValue)}
        splitView={true}
        useDarkTheme={true}
        leftTitle="Original"
        rightTitle="Patched"
      />
    </div>
  );
}
