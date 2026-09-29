const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const expoDistDir = path.join(projectRoot, 'expo', 'dist');
const websitePublicDir = path.join(projectRoot, 'website', 'public');

console.log('Project Root:', projectRoot);
console.log('Expo Dist:', expoDistDir);
console.log('Website Public:', websitePublicDir);

if (!fs.existsSync(expoDistDir)) {
  console.error('Expo dist directory does not exist!');
  process.exit(1);
}

// 1. Directories to sync
const dirsToSync = ['_expo', 'game', 'lobby', 'cards', 'assets', '(tabs)', '(tools)'];

dirsToSync.forEach(dirName => {
  const src = path.join(expoDistDir, dirName);
  const dest = path.join(websitePublicDir, dirName);
  if (fs.existsSync(src)) {
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
    fs.cpSync(src, dest, { recursive: true });
    console.log(`Copied ${dirName} to website/public/${dirName}`);
  }
});

// 2. Copy static html tool files
const files = fs.readdirSync(expoDistDir);
files.forEach(file => {
  if (file.endsWith('.html') && file !== 'index.html') {
    const src = path.join(expoDistDir, file);
    const dest = path.join(websitePublicDir, file);
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} to website/public/${file}`);
  }
});

// Copy expo index.html to website/public/index.html and app.html
const expoIndex = path.join(expoDistDir, 'index.html');
const rootIndex = path.join(websitePublicDir, 'index.html');
const appHtml = path.join(websitePublicDir, 'app.html');
if (fs.existsSync(expoIndex)) {
  fs.copyFileSync(expoIndex, rootIndex);
  fs.copyFileSync(expoIndex, appHtml);
  console.log('Copied expo index.html to website/public/index.html and app.html');
}

// Keep the AdMob seller declaration identical to the exported public asset.
const appAdsSrc = path.join(expoDistDir, 'app-ads.txt');
if (fs.existsSync(appAdsSrc)) {
  fs.copyFileSync(appAdsSrc, path.join(websitePublicDir, 'app-ads.txt'));
  console.log('Copied app-ads.txt to website/public/app-ads.txt');
}

// Copy favicon.ico if present
const faviconSrc = path.join(expoDistDir, 'favicon.ico');
const faviconDest = path.join(websitePublicDir, 'favicon.ico');
if (fs.existsSync(faviconSrc)) {
  fs.copyFileSync(faviconSrc, faviconDest);
  console.log('Copied favicon.ico to website/public/favicon.ico');
}

// Ensure website/public/play/index.html loads the full Expo app
const playDir = path.join(websitePublicDir, 'play');
if (fs.existsSync(playDir)) {
  fs.rmSync(playDir, { recursive: true, force: true });
}
fs.mkdirSync(playDir, { recursive: true });
const expoPlayHtml = path.join(expoDistDir, 'play.html');
if (fs.existsSync(expoPlayHtml)) {
  fs.copyFileSync(expoPlayHtml, path.join(playDir, 'index.html'));
  console.log('Copied expo play.html to website/public/play/index.html');
} else if (fs.existsSync(expoIndex)) {
  fs.copyFileSync(expoIndex, path.join(playDir, 'index.html'));
}

// 2.5 Ensure directory index.html exists for every static route (clean URL fallback)
function ensureDirectoryIndex(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== '_expo' && entry.name !== 'assets') {
      ensureDirectoryIndex(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.html') && entry.name !== 'index.html' && entry.name !== 'app.html' && !entry.name.startsWith('[')) {
      const baseName = entry.name.slice(0, -5);
      const subDir = path.join(dir, baseName);
      if (!fs.existsSync(subDir)) {
        fs.mkdirSync(subDir, { recursive: true });
      }
      const destIndex = path.join(subDir, 'index.html');
      fs.copyFileSync(fullPath, destIndex);
      console.log(`Mirrored ${path.relative(websitePublicDir, fullPath)} -> ${path.relative(websitePublicDir, destIndex)}`);
    }
  }
}
ensureDirectoryIndex(websitePublicDir);

// 3. Patch assets/node_modules -> assets/vendor
const publicAssets = path.join(websitePublicDir, 'assets');
const oldNodeModules = path.join(publicAssets, 'node_modules');
const newVendor = path.join(publicAssets, 'vendor');

if (fs.existsSync(oldNodeModules)) {
  if (fs.existsSync(newVendor)) {
    fs.rmSync(newVendor, { recursive: true, force: true });
  }
  fs.cpSync(oldNodeModules, newVendor, { recursive: true });
  fs.rmSync(oldNodeModules, { recursive: true, force: true });
  console.log('Moved website/public/assets/node_modules to assets/vendor');
}

// 4. Patch JS bundles to point to assets/vendor
const jsDir = path.join(websitePublicDir, '_expo', 'static', 'js', 'web');
if (fs.existsSync(jsDir)) {
  const jsFiles = fs.readdirSync(jsDir);
  jsFiles.forEach(file => {
    if (file.endsWith('.js')) {
      const filePath = path.join(jsDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('assets/node_modules')) {
        content = content.replace(/assets\/node_modules/g, 'assets/vendor');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Patched ${file}`);
      }
    }
  });
}

// Remove the erroneous expo/website directory if it exists
const wrongExpoWebsite = path.join(projectRoot, 'expo', 'website');
if (fs.existsSync(wrongExpoWebsite)) {
  fs.rmSync(wrongExpoWebsite, { recursive: true, force: true });
  console.log('Cleaned up incorrect expo/website directory');
}

console.log('All web assets successfully synced and patched!');
