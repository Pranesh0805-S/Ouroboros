import ReactDiffViewer from 'react-diff-viewer-continued';

export default function DiffViewer({ oldValue, newValue }) {
  return (
    <div className="diff-wrap">
      <ReactDiffViewer
        oldValue={oldValue}
        newValue={newValue}
        splitView={true}
        useDarkTheme={true}
        leftTitle="Original"
        rightTitle="Patched"
      />
    </div>
  );
}
