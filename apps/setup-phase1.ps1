# ============================================================
# Ouroboros Phase 1 - Sample Buggy App Setup Script
# Run this from D:\Ouroboros in PowerShell (inside VS Code terminal)
# ============================================================

$base = "D:\Ouroboros\apps\sample-buggy-app"

# Create directories
$dirs = @(
    $base,
    "$base\routes",
    "$base\data",
    "$base\logs"
)
foreach ($d in $dirs) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
}

Write-Host "Created directory structure under $base" -ForegroundColor Cyan

$content_package_json = @'
{
  "name": "sample-buggy-app",
  "version": "1.0.0",
  "description": "Ouroboros Phase 1 - intentionally buggy Express app used as the monitored 'production target'",
  "main": "server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "express": "^4.19.2"
  }
}

'@
Set-Content -Path "$base\package.json" -Value $content_package_json -Encoding utf8
Write-Host "Wrote package.json" -ForegroundColor Green

$content_logger_js = @'
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

'@
Set-Content -Path "$base\logger.js" -Value $content_logger_js -Encoding utf8
Write-Host "Wrote logger.js" -ForegroundColor Green

$content_data_seed_js = @'
// data/seed.js
// Fake in-memory "database" for the sample app. Intentionally simple —
// the point of this app is to produce realistic failure patterns, not to
// be a real backend.

// NOTE the bug: user id "3" has no `profile` key at all (simulates a
// record that was created before the `profile` field existed, or a
// partial signup). This is what triggers the null-pointer route.
const users = [
  { id: '1', name: 'Asha Rao', profile: { name: 'Asha Rao', bio: 'Backend engineer' } },
  { id: '2', name: 'Diego Fernandez', profile: { name: 'Diego Fernandez', bio: 'Loves Postgres' } },
  { id: '3', name: 'Priya Menon' }, // <-- no `profile` object (bug trigger)
  { id: '4', name: 'Kwame Boateng', profile: { name: 'Kwame Boateng', bio: 'Frontend + a11y' } },
];

const items = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
}));

module.exports = { users, items };

'@
Set-Content -Path "$base\data\seed.js" -Value $content_data_seed_js -Encoding utf8
Write-Host "Wrote data\seed.js" -ForegroundColor Green

$content_routes_users_js = @'
// routes/users.js
// BUG PATTERN: Null Pointer / Undefined Reference
//
// GET /api/users/:id
// Looks up a user and reads user.profile.name directly. Some users
// (see data/seed.js, id "3") don't have a `profile` object, so this
// throws: "Cannot read properties of undefined (reading 'name')"
//
// This mirrors a very common real-world bug: an optional/nullable field
// added later in a schema migration, accessed without an optional-chain
// or existence check somewhere downstream.

const express = require('express');
const router = express.Router();
const { users } = require('../data/seed');
const { logError } = require('../logger');

router.get('/:id', (req, res) => {
  const { id } = req.params;

  try {
    const user = users.find((u) => u.id === id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // --- BUG: no check that user.profile exists before reading .name ---
    const displayName = user.profile.name;

    return res.json({ id: user.id, displayName });
  } catch (err) {
    logError({
      route: 'GET /api/users/:id',
      errorType: 'null_pointer',
      error: err,
      context: { params: req.params },
    });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;

'@
Set-Content -Path "$base\routes\users.js" -Value $content_routes_users_js -Encoding utf8
Write-Host "Wrote routes\users.js" -ForegroundColor Green

$content_routes_cache_js = @'
// routes/cache.js
// BUG PATTERN: Memory Leak (unbounded in-memory cache)
//
// POST /api/cache/set   { key, value }
// GET  /api/cache/stats
//
// Every call to /set pushes an entry into an in-memory Map that is NEVER
// evicted — no TTL, no max-size cap, no LRU. In a real service this is
// exactly how long-lived Node processes slowly exhaust heap: a "cache"
// that quietly becomes an unbounded log of every value ever stored.
//
// There's no single stack trace for a memory leak the way there is for a
// null pointer, so instead this route self-reports: once the cache
// crosses a size threshold, it logs a "memory_leak" incident with the
// current heap stats. That's the realistic detection signal Ouroboros
// would actually consume (heap growth / RSS, not a thrown exception).

const express = require('express');
const router = express.Router();
const { logError } = require('../logger');

// --- BUG: module-level Map, no cap, no eviction, no TTL ---
const cache = new Map();

// Threshold chosen low on purpose so the bug is reproducible in a demo
// without needing thousands of requests.
const LEAK_WARNING_THRESHOLD = 50;
let hasWarned = false;

router.post('/set', (req, res) => {
  const { key, value } = req.body || {};

  if (!key) {
    return res.status(400).json({ error: 'key is required' });
  }

  // --- BUG: keys are never overwritten intentionally, and even if the
  // same key is reused, old values for other keys just keep accumulating.
  // Nothing ever calls cache.delete() or cache.clear().
  cache.set(`${key}:${Date.now()}:${Math.random()}`, value);

  if (cache.size >= LEAK_WARNING_THRESHOLD && !hasWarned) {
    hasWarned = true;
    const mem = process.memoryUsage();
    logError({
      route: 'POST /api/cache/set',
      errorType: 'memory_leak',
      error: new Error(
        `Unbounded cache exceeded ${LEAK_WARNING_THRESHOLD} entries with no eviction policy (heapUsed=${Math.round(
          mem.heapUsed / 1024 / 1024
        )}MB)`
      ),
      context: { cacheSize: cache.size, memoryUsage: mem },
    });
  }

  return res.status(201).json({ stored: true, cacheSize: cache.size });
});

router.get('/stats', (req, res) => {
  const mem = process.memoryUsage();
  return res.json({
    cacheSize: cache.size,
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    rssMB: Math.round(mem.rss / 1024 / 1024),
  });
});

module.exports = router;

'@
Set-Content -Path "$base\routes\cache.js" -Value $content_routes_cache_js -Encoding utf8
Write-Host "Wrote routes\cache.js" -ForegroundColor Green

$content_routes_weather_js = @'
// routes/weather.js
// BUG PATTERN: Rate Limit / Timeout error on an external API call
//
// GET /api/weather/:city
//
// Simulates calling a third-party weather API that allows only 5 requests
// per rolling 10-second window per process. The bug: there is no
// throttling, queueing, retry/backoff, or even a caught rejection on the
// caller's side — a burst of requests just blows through the quota and
// the "external API" throws, which propagates as an unhandled 500.
//
// This mirrors a very common production incident: a downstream API
// (payments, geocoding, email) starts 429-ing under load and nothing in
// the calling code was built to expect that.

const express = require('express');
const router = express.Router();
const { logError } = require('../logger');

const WINDOW_MS = 10_000;
const MAX_REQUESTS_PER_WINDOW = 5;

// timestamps of recent calls to the mock external API
let callTimestamps = [];

function mockExternalWeatherApi(city) {
  const now = Date.now();
  callTimestamps = callTimestamps.filter((t) => now - t < WINDOW_MS);

  // --- BUG: caller never checks quota before calling; the "API" just
  // throws once the quota is exceeded, with no retry/backoff on our side.
  if (callTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const err = new Error(
      `Rate limit exceeded for weather API: ${MAX_REQUESTS_PER_WINDOW} requests per ${WINDOW_MS / 1000}s`
    );
    err.status = 429;
    throw err;
  }

  callTimestamps.push(now);

  return {
    city,
    tempC: Math.round(15 + Math.random() * 15),
    condition: ['Sunny', 'Cloudy', 'Rainy'][Math.floor(Math.random() * 3)],
  };
}

router.get('/:city', (req, res) => {
  const { city } = req.params;

  try {
    const weather = mockExternalWeatherApi(city);
    return res.json(weather);
  } catch (err) {
    logError({
      route: 'GET /api/weather/:city',
      errorType: 'rate_limit',
      error: err,
      context: { params: req.params, recentCallCount: callTimestamps.length },
    });
    return res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;

'@
Set-Content -Path "$base\routes\weather.js" -Value $content_routes_weather_js -Encoding utf8
Write-Host "Wrote routes\weather.js" -ForegroundColor Green

$content_routes_items_js = @'
// routes/items.js
// BUG PATTERN: Off-by-one / boundary error in pagination
//
// GET /api/items?page=1&pageSize=10
//
// With 23 seeded items and pageSize=10, correct pagination should give:
//   page 1 -> items 1-10
//   page 2 -> items 11-20
//   page 3 -> items 21-23
//
// --- BUG: the slice's start index is computed as (page * pageSize)
// instead of ((page - 1) * pageSize). This shifts every page forward by
// one pageSize, so page 1 skips the first `pageSize` items entirely, and
// the very last page silently comes back empty/short instead of erroring
// (classic boundary bug — it doesn't crash, it just quietly returns
// wrong data, which is why it's dangerous).

const express = require('express');
const router = express.Router();
const { items } = require('../data/seed');
const { logError } = require('../logger');

router.get('/', (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const pageSize = parseInt(req.query.pageSize, 10) || 10;

  try {
    // --- BUG: should be (page - 1) * pageSize ---
    const start = page * pageSize;
    const end = start + pageSize;

    const pageItems = items.slice(start, end);

    // Detect + log the symptom: a non-final page that comes back empty
    // or short is a strong signal something's off in the slice math.
    const isLastPossiblePage = start < items.length;
    if (pageItems.length === 0 && isLastPossiblePage) {
      logError({
        route: 'GET /api/items',
        errorType: 'off_by_one',
        error: new Error(
          `Pagination returned 0 items for page=${page}, pageSize=${pageSize} despite ${items.length} total items existing (start=${start}, end=${end})`
        ),
        context: { page, pageSize, totalItems: items.length, start, end },
      });
    }

    return res.json({
      page,
      pageSize,
      totalItems: items.length,
      items: pageItems,
    });
  } catch (err) {
    logError({
      route: 'GET /api/items',
      errorType: 'off_by_one',
      error: err,
      context: { query: req.query },
    });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;

'@
Set-Content -Path "$base\routes\items.js" -Value $content_routes_items_js -Encoding utf8
Write-Host "Wrote routes\items.js" -ForegroundColor Green

$content_server_js = @'
// server.js
// Ouroboros Phase 1 — sample-buggy-app
//
// This is the "production target" the rest of Ouroboros will monitor.
// It exposes 4 routes, each seeded with a different real-world bug
// pattern (see the comment block at the top of each file in ./routes).
// Errors are written to logs/errors.log as structured JSON, which is
// what Phase 2 (log ingestion) will consume.

const express = require('express');
const path = require('path');

const usersRouter = require('./routes/users');
const cacheRouter = require('./routes/cache');
const weatherRouter = require('./routes/weather');
const itemsRouter = require('./routes/items');
const { logError, LOG_FILE } = require('./logger');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

// simple request log so it's obvious what's being hit while demoing
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'sample-buggy-app', logFile: LOG_FILE });
});

app.use('/api/users', usersRouter);
app.use('/api/cache', cacheRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/items', itemsRouter);

// Catch-all for anything unhandled that slips past individual route
// try/catches (e.g. a thrown error in middleware). Still logged in the
// same structured shape so nothing falls outside Ouroboros's view.
app.use((err, req, res, next) => {
  logError({
    route: `${req.method} ${req.path}`,
    errorType: 'unknown',
    error: err,
    context: { params: req.params, query: req.query },
  });
  res.status(500).json({ error: 'Internal Server Error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`sample-buggy-app listening on http://localhost:${PORT}`);
  console.log(`Try:`);
  console.log(`  GET  http://localhost:${PORT}/api/users/3        (null pointer bug)`);
  console.log(`  POST http://localhost:${PORT}/api/cache/set      (memory leak bug, body: {"key":"a","value":"b"})`);
  console.log(`  GET  http://localhost:${PORT}/api/weather/Chennai (rate limit bug, call 6+ times fast)`);
  console.log(`  GET  http://localhost:${PORT}/api/items?page=1&pageSize=10 (off-by-one bug)`);
});

'@
Set-Content -Path "$base\server.js" -Value $content_server_js -Encoding utf8
Write-Host "Wrote server.js" -ForegroundColor Green

Write-Host ""
Write-Host "Phase 1 files written. Next steps:" -ForegroundColor Yellow
Write-Host "  cd `"$base`""
Write-Host "  npm install"
Write-Host "  npm start"
Write-Host ""
Write-Host "Then test the 4 bug routes:" -ForegroundColor Yellow
Write-Host "  GET  http://localhost:4000/api/users/3          (null pointer)"
Write-Host "  POST http://localhost:4000/api/cache/set         (memory leak) body: {`"key`":`"a`",`"value`":`"b`"}"
Write-Host "  GET  http://localhost:4000/api/weather/Chennai   (rate limit - call 6+ times fast)"
Write-Host "  GET  http://localhost:4000/api/items?page=1&pageSize=10  (off-by-one)"
Write-Host ""
Write-Host "Errors get logged as structured JSON to $base\logs\errors.log" -ForegroundColor Yellow
