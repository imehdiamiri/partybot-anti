const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'expo', 'website', 'public');
const jsDir = path.join(distDir, '_expo', 'static', 'js', 'web');
const assetsDir = path.join(distDir, 'assets');
const oldNodeModulesDir = path.join(assetsDir, 'node_modules');
const newVendorDir = path.join(assetsDir, 'vendor');

// 1. Copy node_modules to vendor in assets
if (fs.existsSync(oldNodeModulesDir)) {
  fs.cpSync(oldNodeModulesDir, newVendorDir, { recursive: true });
  fs.rmSync(oldNodeModulesDir, { recursive: true, force: true });
  console.log('Moved assets/node_modules to assets/vendor');
} else {
  console.log('assets/node_modules not found, might have been already renamed.');
}

// 2. Find and replace in all JS files
if (fs.existsSync(jsDir)) {
  const files = fs.readdirSync(jsDir);
  for (const file of files) {
    if (file.endsWith('.js')) {
      const filePath = path.join(jsDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('assets/node_modules')) {
        content = content.replace(/assets\/node_modules/g, 'assets/vendor');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Patched ${file}`);
      }
    }
  }
}

console.log('Done patching web assets.');
