const http = require('http');
const { spawnSync } = require('child_process');
const path = require('path');

const port = process.env.DATABASE_EMULATOR_PORT || '9012';

function checkEmulator(p) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${p}/.json`, { timeout: 1500 }, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 401 || res.statusCode === 404);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const isRunning = await checkEmulator(port);
  let status = 1;

  if (isRunning) {
    console.log(`[test-runner] Mode (b): Detected running Realtime Database Emulator on 127.0.0.1:${port}.`);
    console.log(`[test-runner] Executing Jest directly against healthy emulator...`);
    const res = spawnSync('node', ['run-jest.js'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        DATABASE_EMULATOR_PORT: String(port),
        FIREBASE_DATABASE_EMULATOR_HOST: `127.0.0.1:${port}`,
      },
    });
    status = res.status ?? 1;
  } else {
    console.log(`[test-runner] Mode (a): No active emulator detected on port ${port}.`);
    console.log(`[test-runner] Launching Firebase Emulator Suite exec...`);
    const cmd = 'npx firebase emulators:exec --only database "node functions/run-jest.js"';
    const res = spawnSync(cmd, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        DATABASE_EMULATOR_PORT: String(port),
        FIREBASE_DATABASE_EMULATOR_HOST: `127.0.0.1:${port}`,
      },
    });
    status = res.status ?? 1;
  }

  process.exit(status);
}

main().catch((err) => {
  console.error('[test-runner] Error:', err);
  process.exit(1);
});
