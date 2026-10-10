const { generatePatch } = require('./patchGenerator');
const { runPatchInSandbox } = require('./sandboxRunner');

const MAX_ATTEMPTS = Number(process.env.PATCH_MAX_ATTEMPTS) || 3;

async function generateAndTestWithRetry(incident, maxAttempts = MAX_ATTEMPTS) {
  const attempts = [];
  let feedback = null;
  let last = null;
  let sandbox = null;

  for (let n = 1; n <= maxAttempts; n++) {
    last = await generatePatch(incident, feedback);

    try {
      sandbox = await runPatchInSandbox({
        targetFile: last.target_file,
        patchedContent: last.generated_diff,
      });
    } catch (err) {
      // bad target_file / empty / oversized patch
      sandbox = { status: 'error', output: err.message, pass: null, fail: null };
    }

    attempts.push({
      attempt: n,
      generated_diff: last.generated_diff,
      explanation: last.explanation,
      confidence_score: last.confidence_score,
      test_result: sandbox.status,
      pass: sandbox.pass,
      fail: sandbox.fail,
      output: sandbox.output,
    });

    console.log(`Auto-patch attempt ${n}/${maxAttempts}: ${sandbox.status}`);

    if (sandbox.status === 'passed') break;
    // error/timeout = infrastructure problem, retrying won't help
    if (sandbox.status !== 'failed') break;

    feedback = {
      attempt: n,
      previousCode: last.generated_diff,
      failureOutput: sandbox.output,
    };
  }

  return { last, sandbox, attempts };
}

module.exports = { generateAndTestWithRetry };