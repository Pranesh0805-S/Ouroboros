// logger.js
// Minimal structured logger. Every error gets written as a single-line JSON
// object to logs/errors.log so Phase 2 (log ingestion) has a real,
// consistent shape to parse: { id, timestamp, route, error_type, message, stack }
//
// This deliberately mirrors the "Incident" shape from the project spec
// (source_repo, error_type, stack_trace, raw_log) so later phases don't
// need a translation layer.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'errors.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * @param {object} opts
 * @param {string} opts.route - e.g. "GET /api/users/:id"
 * @param {string} opts.errorType - one of: null_pointer | memory_leak | rate_limit | off_by_one | unknown
 * @param {Error} opts.error - the actual error object
 * @param {object} [opts.context] - any extra request context (params, query, body-safe fields)
 */
function logError({ route, errorType, error, context = {} }) {
  const entry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    source_repo: 'sample-buggy-app',
    route,
    error_type: errorType,
    message: error && error.message ? error.message : String(error),
    stack: error && error.stack ? error.stack : null,
    context,
  };

  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');

  // Also echo to console so it's visible while developing locally
  console.error(`[${entry.timestamp}] [${errorType}] ${route} -> ${entry.message}`);

  return entry;
}

module.exports = { logError, LOG_FILE };

