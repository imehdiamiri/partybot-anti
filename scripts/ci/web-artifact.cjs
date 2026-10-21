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
// Fail closed if an older checked-in or renamed commercial recording leaks
// back into the deploy artifact. Check the actual bytes, not only imports.
function checkAudioAssets(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) checkAudioAssets(file);
    else if (/\.(wav|mp3|webm|m4a|ogg)$/i.test(item.name)) {
      const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      if (/whitney|phil_challenge/i.test(item.name) || hash === '96d64b877cf3658ef0cbf95db82c2c89d51d26a172ba2e74e5abea6060d6669d') {
        throw new Error(`Retired commercial audio in deploy artifact: ${path.relative(root, file)}`);
      }
    }
  }
}
checkAudioAssets(path.join(root, 'assets'));
const receipt = { commit: process.env.GITHUB_SHA, entry: match[1], sha256: crypto.createHash('sha256').update(fs.readFileSync(entry)).digest('hex') };
if (!/^[a-f0-9]{40}$/.test(receipt.commit || '')) throw new Error('Missing source revision');
fs.writeFileSync(path.join(root, 'ci-release.json'), JSON.stringify(receipt));
console.log(`Web artifact verified for ${receipt.commit}.`);
