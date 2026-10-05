// Bug pattern: null_pointer  ->  routes/users.js
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('../test-utils/startApp');

let app;
before(async () => { app = await startApp('users.js', '/api/users'); });
after(async () => { await app.close(); });

test('user with a profile returns displayName', async () => {
  const res = await fetch(`${app.baseUrl}/api/users/1`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.displayName, 'Asha Rao');
});

test('user WITHOUT a profile (id 3) does not crash', async () => {
  const res = await fetch(`${app.baseUrl}/api/users/3`);
  assert.equal(res.status, 200);
});

test('user without a profile still returns an explicit displayName field', async () => {
  const res = await fetch(`${app.baseUrl}/api/users/3`);
  const body = await res.json();
  // key must exist (null or a fallback string), not silently dropped from the JSON
  assert.ok('displayName' in body, 'displayName was dropped from the response');
  assert.ok(body.displayName === null || typeof body.displayName === 'string');
});

test('unknown user returns 404', async () => {
  const res = await fetch(`${app.baseUrl}/api/users/999`);
  assert.equal(res.status, 404);
});
