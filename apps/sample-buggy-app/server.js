// server.js
// Ouroboros Phase 1 â€” sample-buggy-app
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

