// Manual check: node sandboxRunner.cli.js <path to test.patches.json>
const fs = require('fs');
const { runPatchInSandbox } = require('./sandboxRunner');

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('usage: node sandboxRunner.cli.js <test.patches.json>');
  process.exit(1);
}
const patches = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const line = (label, r) =>
  console.log(`${label.padEnd(26)} ${r.status.padEnd(8)} pass=${r.pass} fail=${r.fail} ${r.durationMs}ms`);

(async () => {
  for (const [i, p] of patches.entries()) {
    const r = await runPatchInSandbox({ targetFile: p.target_file, patchedContent: p.generated_diff });
    line(`#${i + 1} ${p.target_file}`, r);
  }

  console.log('--- negative controls ---');
  const bad = await runPatchInSandbox({
    targetFile: 'routes/items.js',
    patchedContent: "module.exports = require('express').Router(); // does nothing",
  });
  line('empty router (want failed)', bad);

  try {
    await runPatchInSandbox({ targetFile: '../server.js', patchedContent: 'x' });
    console.log('path traversal NOT blocked  <-- problem');
  } catch (e) {
    console.log('path traversal blocked      ok');
  }
})();