// Image-generation output optimization only: no creative modifications or cropping.
// Usage: node scripts/install-generated-heroes.cjs <path-to-sharp>
const fs = require('fs');
const path = require('path');
const sharp = require(process.argv[2] || 'sharp');
const root = path.resolve(__dirname, '..');
const { assets } = require('../docs/hero-prompts-2026-09-06.json');
(async () => {
  let total = 0;
  for (const asset of assets) {
    const target = path.resolve(root, asset.asset);
    const expected = path.join(root, 'expo', 'assets', 'images', 'heroes') + path.sep;
    if (!target.startsWith(expected)) throw new Error('Unexpected asset destination');
    const metadata = await sharp(asset.source).metadata();
    if (metadata.width !== 1672 || metadata.height !== 941) throw new Error(`Unexpected dimensions: ${asset.id}`);
    const output = await sharp(asset.source).webp({ quality: 84, effort: 6 }).toBuffer();
    fs.writeFileSync(target, output);
    total += output.length;
    console.log(`${asset.id}: ${output.length} bytes`);
  }
  console.log(`Total: ${total} bytes`);
})().catch(error => { console.error(error); process.exitCode = 1; });
