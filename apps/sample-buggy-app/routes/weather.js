// routes/weather.js
// BUG PATTERN: Rate Limit / Timeout error on an external API call
//
// GET /api/weather/:city
//
// Simulates calling a third-party weather API that allows only 5 requests
// per rolling 10-second window per process. The bug: there is no
// throttling, queueing, retry/backoff, or even a caught rejection on the
// caller's side â€” a burst of requests just blows through the quota and
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

