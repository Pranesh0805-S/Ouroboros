// Bug pattern: off_by_one  ->  routes/items.js   (23 seeded items)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('../test-utils/startApp');

let app;
before(async () => { app = await startApp('items.js', '/api/items'); });
after(async () => { await app.close(); });

const ids = async (qs) => {
  const res = await fetch(`${app.baseUrl}/api/items${qs}`);
  assert.equal(res.status, 200);
  return (await res.json()).items.map((i) => i.id);
};

test('page 1 returns items 1-10', async () => {
  assert.deepEqual(await ids('?page=1&pageSize=10'), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('page 2 returns items 11-20', async () => {
  assert.deepEqual(await ids('?page=2&pageSize=10'), [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
});

test('last page returns the remaining 3 items (21-23)', async () => {
  assert.deepEqual(await ids('?page=3&pageSize=10'), [21, 22, 23]);
});

test('page past the end returns an empty list', async () => {
  assert.deepEqual(await ids('?page=4&pageSize=10'), []);
});

test('no query params defaults to the first page', async () => {
  assert.deepEqual(await ids(''), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
