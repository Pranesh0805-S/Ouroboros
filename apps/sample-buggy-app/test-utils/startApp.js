// test-utils/startApp.js
// Mounts ONE route file on a throwaway Express app on a random port, so tests
// never depend on server.js, MongoDB, or the real logger.
const express = require('express');
const path = require('path');

const root = path.resolve(__dirname, '..');

function silenceLogger() {
  const p = require.resolve(path.join(root, 'logger'));
  require.cache[p] = { id: p, filename: p, loaded: true, exports: { logError() {} } };
}

async function startApp(routeFile, mountPath) {
  silenceLogger();
  const routePath = require.resolve(path.join(root, 'routes', routeFile));
  delete require.cache[routePath]; // fresh module state per test file
  const router = require(routePath);

  const app = express();
  app.use(express.json());
  app.use(mountPath, router);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  return {
    baseUrl,
    close: () =>
      new Promise((resolve) => {
        if (server.closeAllConnections) server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

module.exports = { startApp };
