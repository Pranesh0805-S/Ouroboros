// sandboxRunner.js
// Runs ONE generated patch inside the locked-down Docker sandbox and reports the result.
// The patched file is mounted read-only over the original; only that route's tests run.
const { spawn } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const IMAGE = process.env.SANDBOX_IMAGE || 'ouroboros-sandbox';
const TIMEOUT_MS = Number(process.env.SANDBOX_TIMEOUT_MS) || 90_000;
const MAX_PATCH_BYTES = 200 * 1024;
const MAX_BUFFER_CHARS = 100_000;
const MAX_OUTPUT_CHARS = 8_000;
const TARGET_RE = /^routes\/[A-Za-z0-9_-]+\.js$/;

// target_file comes from the LLM/DB, so never trust it: only routes/<name>.js is allowed.
function validateTarget(targetFile) {
  if (typeof targetFile !== 'string' || !TARGET_RE.test(targetFile)) {
    throw new Error(`Refusing target_file "${targetFile}": must look like routes/<name>.js`);
  }
}

function parseSummary(output) {
  const num = (label) => {
    const m = output.match(new RegExp(`^# ${label} (\\d+)`, 'm'));
    return m ? Number(m[1]) : null;
  };
  return { tests: num('tests'), pass: num('pass'), fail: num('fail') };
}

const tail = (s, n) => (s.length > n ? `...[truncated]...\n${s.slice(-n)}` : s);

function runDocker(args, containerName, timeoutMs) {
  return new Promise((resolve) => {
    let output = '';
    let timedOut = false;
    let settled = false;

    const child = spawn('docker', args, { windowsHide: true });
    const collect = (d) => { output = (output + d.toString()).slice(-MAX_BUFFER_CHARS); };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);

    const timer = setTimeout(() => {
      timedOut = true;
      spawn('docker', ['kill', containerName], { windowsHide: true }).on('error', () => {});
    }, timeoutMs);

    const done = (exitCode, spawnError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode, output, timedOut, spawnError });
    };
    child.on('error', (err) => done(null, err));
    child.on('close', (code) => done(code));
  });
}

async function runPatchInSandbox({ targetFile, patchedContent }) {
  validateTarget(targetFile);
  if (typeof patchedContent !== 'string' || !patchedContent.trim()) {
    throw new Error('patchedContent is empty');
  }
  if (Buffer.byteLength(patchedContent) > MAX_PATCH_BYTES) {
    throw new Error('patchedContent is too large');
  }

  const base = path.basename(targetFile, '.js');
  const testFile = `tests/${base}.test.js`; // routes/items.js -> tests/items.test.js
  const containerName = `ouroboros-sbx-${crypto.randomBytes(4).toString('hex')}`;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ouroboros-'));
  const hostFile = path.join(dir, `${base}.js`);
  const started = Date.now();

  try {
    await fs.writeFile(hostFile, patchedContent, 'utf8');

    const args = [
      'run', '--rm', '--name', containerName,
      '--network', 'none',
      '--memory', '256m', '--cpus', '1', '--pids-limit', '128',
      '--read-only', '--tmpfs', '/tmp',
      '-v', `${hostFile}:/app/${targetFile}:ro`,
      IMAGE, 'node', '--test', testFile,
    ];

    const r = await runDocker(args, containerName, TIMEOUT_MS);
    const summary = parseSummary(r.output);

    let status;
    let output = r.output;
    if (r.spawnError) {
      status = 'error';
      output = `Could not start docker (is Docker Desktop running?): ${r.spawnError.message}`;
    } else if (r.timedOut) {
      status = 'timeout';
    } else if (r.exitCode === 0 && summary.tests > 0 && summary.fail === 0) {
      status = 'passed';
    } else if (r.exitCode === 1 && summary.fail > 0) {
      status = 'failed';
    } else {
      status = 'error'; // docker/image/test-file problem, not a failing patch
    }

    return {
      status,
      passed: status === 'passed',
      ...summary,
      durationMs: Date.now() - started,
      exitCode: r.exitCode,
      testFile,
      output: tail(output, MAX_OUTPUT_CHARS),
    };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { runPatchInSandbox };