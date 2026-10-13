const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');

const PORT = '5055';
let server;
let output = '';

async function waitForServer(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Server exited early (code ${server.exitCode}). Output:\n${output}`);
    }
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet, retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server not ready after ${timeoutMs}ms. Output:\n${output}`);
}

before(async () => {
  server = spawn('node', ['server.js'], {
    env: { ...process.env, PORT, API_SECRET_KEY: 'test-key' },
  });
  server.stdout.on('data', (d) => (output += d));
  server.stderr.on('data', (d) => (output += d));
  await waitForServer(`http://127.0.0.1:${PORT}/api/health`);
});

after(() => server.kill());

test('health endpoint returns 200', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
  assert.strictEqual(res.status, 200);
});
