require('dotenv').config();
const fs = require('fs');
const path = require('path');

const gen = require('../src/services/patchGenerator');
const realGenerate = gen.generatePatch;
let calls = 0;

// must be replaced BEFORE patchRetry is required
gen.generatePatch = async (incident, feedback) => {
  calls++;
  if (calls === 1) {
    const buggy = fs.readFileSync(
      path.resolve(__dirname, '../../sample-buggy-app/routes/users.js'), 'utf8');
    return {
      target_file: 'routes/users.js',
      generated_diff: buggy,
      explanation: 'deliberately bad first attempt',
      confidence_score: 0.1,
    };
  }
  console.log('Feedback received by attempt', calls, '->', !!feedback);
  return realGenerate(incident, feedback);
};

const { generateAndTestWithRetry } = require('../src/services/patchRetry');

const incident = {
  error_type: 'null_pointer',
  classified_type: 'null_pointer',
  message: "Cannot read properties of undefined (reading 'name')",
  stack: 'TypeError at routes/users.js:29:38',
};

generateAndTestWithRetry(incident).then(({ attempts }) => {
  console.table(attempts.map(a => ({
    attempt: a.attempt, result: a.test_result, pass: a.pass, fail: a.fail,
  })));
  process.exit(0);
}).catch((e) => { console.error(e); process.exit(1); });