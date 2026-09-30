const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(process.env.GITHUB_WORKSPACE || '.');
const target = path.resolve(root, 'website/public');
if (process.env.GITHUB_ACTIONS !== 'true' || !target.startsWith(root + path.sep)) throw new Error('Only a disposable Actions workspace may be cleared');
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
