// Bug pattern: rate_limit  ->  routes/weather.js
// The mock API allows 5 calls per 10s window. A correct fix must back off and
// retry instead of returning 429/500. Retries wait for the window, so this
// test is slow on purpose (~10s) and has a long timeout.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('../test-utils/startApp');

let app;
before(async () => { app = await startApp('weather.js', '/api/weather'); });
after(async () => { await app.close(); });

test('single request returns weather', async () => {
  const res = await fetch(`${app.baseUrl}/api/weather/Chennai`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.city, 'Chennai');
  assert.equal(typeof body.tempC, 'number');
});

test('burst of 8 requests all succeed (no 429 / 500 leaks to the caller)', { timeout: 60000 }, async () => {
  const results = await Promise.all(
    Array.from({ length: 8 }, () => fetch(`${app.baseUrl}/api/weather/Chennai`))
  );
  const statuses = results.map((r) => r.status);
  assert.deepEqual(statuses, Array(8).fill(200), `got statuses: ${statuses.join(',')}`);
});
