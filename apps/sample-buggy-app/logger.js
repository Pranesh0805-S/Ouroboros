// logger.js
// Minimal structured logger. Every error gets written as a single-line JSON
// object to logs/errors.log so Phase 2 (log ingestion) has a real,
// consistent shape to parse: { id, timestamp, route, error_type, message, stack }
//
// This deliberately mirrors the "Incident" shape from the project spec
// (source_repo, error_type, stack_trace, raw_log) so later phases don't
// need a translation layer.
//
// In addition to the local file log, each error is also POSTed to the
// Ouroboros backend's ingestion endpoint (fire-and-forget) so Phase 2's
// classifier can pick it up in real time.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'errors.log');
const BACKEND_INGEST_URL = process.env.BACKEND_INGEST_URL || 'http://localhost:5000/api/incidents/ingest';

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

  // Fire-and-forget POST to the Ouroboros backend ingestion API.
  // Deliberately non-blocking: if the backend is down, the buggy app
  // must keep working and errors.log must still be written above.
  forwardToBackend(entry);

  return entry;
}

async function forwardToBackend(entry) {
  try {
    const res = await fetch(BACKEND_INGEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_repo: entry.source_repo,
        route: entry.route,
        error_type: entry.error_type,
        message: entry.message,
        stack: entry.stack,
        context: entry.context,
      }),
    });

    if (!res.ok) {
      console.warn(`[logger] Backend ingest returned ${res.status}`);
    }
  } catch (err) {
    // Backend not running / unreachable — this is expected in some dev flows,
    // so we just warn rather than throw.
    console.warn(`[logger] Could not reach backend ingest endpoint: ${err.message}`);
  }
}

module.exports = { logError, LOG_FILE };