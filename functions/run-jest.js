const { spawnSync } = require('child_process');

const port = process.env.DATABASE_EMULATOR_PORT || '9012';

const res = spawnSync('npx', ['jest', '--runInBand'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    DATABASE_EMULATOR_PORT: String(port),
    FIREBASE_DATABASE_EMULATOR_HOST: `127.0.0.1:${port}`,
  },
});

process.exit(res.status ?? 1);
