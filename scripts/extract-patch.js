const fs = require('fs');
const [, , jsonPath, target, out] = process.argv;
const patches = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const p = patches.filter((x) => x.target_file === target).pop();
fs.writeFileSync(out, p.generated_diff, 'utf8');
console.log('wrote', out);
