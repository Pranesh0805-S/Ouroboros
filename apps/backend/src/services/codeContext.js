const fs = require('fs');
const path = require('path');

// Maps classified_type -> the actual buggy source file in sample-buggy-app.
// Kept as an explicit map (not inferred from route string) because it's
// simpler and more reliable than parsing route params for a fixed 4-bug demo.
const BUG_FILE_MAP = {
  null_pointer: 'routes/users.js',
  off_by_one: 'routes/items.js',
  memory_leak: 'routes/cache.js',
  rate_limit: 'routes/weather.js',
};

const SAMPLE_APP_ROOT = path.resolve(__dirname, '../../../sample-buggy-app');

function getSourceFileForIncident(incident) {
  const relativePath = BUG_FILE_MAP[incident.classified_type];

  if (!relativePath) {
    throw new Error(`No known source file mapping for classified_type: ${incident.classified_type}`);
  }

  const fullPath = path.join(SAMPLE_APP_ROOT, relativePath);
  const code = fs.readFileSync(fullPath, 'utf-8');

  return { relativePath, fullPath, code };
}

module.exports = { getSourceFileForIncident, BUG_FILE_MAP };