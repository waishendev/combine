/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('http');

const port = Number(process.env.PORT || 3000);
const path = process.env.HEALTHCHECK_PATH || '/api/healthz';

let req;

const timeout = setTimeout(() => {
  if (req) {
    req.destroy(new Error('Health check timed out'));
  }
  process.exit(1);
}, 5000);

req = http.get({ host: '127.0.0.1', port, path, timeout: 4000 }, (res) => {
  clearTimeout(timeout);

  if (res.statusCode !== 200) {
    process.exit(1);
    return;
  }

  res.resume();
  res.once('end', () => process.exit(0));
});

req.on('error', () => {
  clearTimeout(timeout);
  process.exit(1);
});
