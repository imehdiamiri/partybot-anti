const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve('website/public');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const match = html.match(/src="(\/_expo\/static\/js\/web\/entry-[^"\s]+\.js)"/);
if (!match) throw new Error('Exported entry bundle missing');
const entry = path.resolve(root, '.' + match[1]);
if (!entry.startsWith(root + path.sep) || !fs.existsSync(entry)) throw new Error('Entry outside artifact or missing');
for (const file of ['app.html', 'privacy.html', 'terms.html', 'app-ads.txt', 'ads.txt']) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required route/asset: ${file}`);
}
const receipt = { commit: process.env.GITHUB_SHA, entry: match[1], sha256: crypto.createHash('sha256').update(fs.readFileSync(entry)).digest('hex') };
if (!/^[a-f0-9]{40}$/.test(receipt.commit || '')) throw new Error('Missing source revision');
fs.writeFileSync(path.join(root, 'ci-release.json'), JSON.stringify(receipt));
console.log(`Web artifact verified for ${receipt.commit}.`);
