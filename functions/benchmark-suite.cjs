const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9014') throw new Error('Isolated emulator required');
for (const args of [
  ...(!process.argv.includes('--checks-only') ? [['functions/benchmark.cjs']] : []),
  ['functions/benchmark-security.cjs'],
  ['functions/node_modules/jest/bin/jest.js', '--config', JSON.stringify({ rootDir: __dirname, testEnvironment: 'node' }), '--runInBand'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', timeout: 600000,
    env: { ...process.env, DATABASE_EMULATOR_PORT: '9014' } });
  if (result.status !== 0) process.exit(result.status || 1);
}
