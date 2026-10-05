// Bug pattern: memory_leak  ->  routes/cache.js
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('../test-utils/startApp');

let app;
before(async () => { app = await startApp('cache.js', '/api/cache'); });
after(async () => { await app.close(); });

const post = (body) =>
  fetch(`${app.baseUrl}/api/cache/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

test('set without a key returns 400', async () => {
  const res = await post({ value: 'x' });
  assert.equal(res.status, 400);
});

test('set with a key returns 201', async () => {
  const res = await post({ key: 'a', value: 1 });
  assert.equal(res.status, 201);
});

test('cache stays bounded after 250 inserts', async () => {
  for (let i = 0; i < 250; i++) {
    const res = await post({ key: `k${i}`, value: i });
    assert.equal(res.status, 201);
  }
  const stats = await (await fetch(`${app.baseUrl}/api/cache/stats`)).json();
  assert.ok(stats.cacheSize <= 100, `cache grew to ${stats.cacheSize} entries (unbounded)`);
});
