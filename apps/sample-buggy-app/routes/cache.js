// routes/cache.js
// BUG PATTERN: Memory Leak (unbounded in-memory cache)
//
// POST /api/cache/set   { key, value }
// GET  /api/cache/stats
//
// Every call to /set pushes an entry into an in-memory Map that is NEVER
// evicted â€” no TTL, no max-size cap, no LRU. In a real service this is
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

