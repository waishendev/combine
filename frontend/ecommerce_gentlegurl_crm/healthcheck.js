/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http');

const port = Number(process.env.PORT || 3000);
const path = process.env.HEALTHCHECK_PATH || '/api/healthz';

const req = http.get({ host: '127.0.0.1', port, path, timeout: 4000 }, (res) => {
  process.exit(res.statusCode === 200 ? 0 : 1);
});
req.on('error', () => process.exit(1));
setTimeout(() => {
  try {
    req.destroy();
  } catch {
    // ignore
  }
  process.exit(1);
}, 5000);
