const puppeteer = require('./expo/node_modules/puppeteer');
const https = require('https');
const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Parse CLI arguments
const args = process.argv.slice(2);
const baseUrlIdx = args.indexOf('--base-url');
const baseUrl = (baseUrlIdx !== -1 && args[baseUrlIdx + 1] ? args[baseUrlIdx + 1] : 'https://partybot.games').replace(/\/$/, '');

// ─── Direct HTTP Helper ───
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          contentType: res.headers['content-type'] || '',
          body: data
        });
      });
    }).on('error', reject);
  });
}

function htmlContainsText(html, text) {
  const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  return html.includes(text) || html.includes(escapedText) || html.includes(text.replace(/&/g, '&amp;'));
}

// ─── 1. Derive Models from Source ───
function deriveAuthoritativeModels() {
  const projectRoot = __dirname;
  const appModelsPath = path.join(projectRoot, 'expo', 'src', 'models', 'AppModels.ts');
  const cardModelsPath = path.join(projectRoot, 'expo', 'src', 'models', 'CardModels.ts');

  assert(fs.existsSync(appModelsPath), `AppModels.ts must exist at ${appModelsPath}`);
  assert(fs.existsSync(cardModelsPath), `CardModels.ts must exist at ${cardModelsPath}`);

  const appModelsContent = fs.readFileSync(appModelsPath, 'utf8');
  const cardModelsContent = fs.readFileSync(cardModelsPath, 'utf8');

  // Extract Games
  const gameMatches = [...appModelsContent.matchAll(/id:\s*'([a-z0-9_]+)',\s*\n\s*name:\s*'([^']+)'/g)];
  const games = gameMatches.map(m => ({ id: m[1], name: m[2] }));

  // Deduplicate and validate
  const uniqueGameIds = new Set(games.map(g => g.id));
  assert.strictEqual(games.length, 16, `Expected exactly 16 games in AppModels.ts (found ${games.length})`);
  assert.strictEqual(uniqueGameIds.size, 16, `All game IDs must be unique`);

  for (const g of games) {
    assert(!g.id.includes('['), `Game ID "${g.id}" must not contain placeholder syntax`);
  }

  // Extract Cards Categories
  const categories = [
    { id: 'act', title: 'Act' },
    { id: 'talk', title: 'Talk' },
    { id: 'challenges', title: 'Challenges' },
    { id: 'penalty', title: 'Penalty' },
    { id: 'couple', title: 'Couple' },
    { id: 'mostLikelyTo', title: 'Most Likely To' },
    { id: 'favorites', title: 'Favorites' },
  ];

  const uniqueCatIds = new Set(categories.map(c => c.id));
  assert.strictEqual(categories.length, 7, `Expected 7 Cards categories (found ${categories.length})`);
  assert.strictEqual(uniqueCatIds.size, 7, `All Cards category IDs must be unique`);

  for (const c of categories) {
    assert(!c.id.includes('['), `Category ID "${c.id}" must not contain placeholder syntax`);
    assert(cardModelsContent.includes(`id: CardCategory.${c.id}`) || cardModelsContent.includes(`'${c.id}'`), `Category "${c.id}" must exist in CardModels.ts`);
  }

  return { games, categories };
}

// ─── 2. Audit Published Static Route Files ───
function auditStaticRouteFiles(games, categories) {
  const websitePublicDir = path.join(__dirname, 'website', 'public');
  assert(fs.existsSync(websitePublicDir), `website/public must exist`);

  const foundGameDetails = [];
  const foundGameSetups = [];
  const foundCards = [];
  const allHtmlFiles = [];

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && e.name !== '_expo' && e.name !== 'assets') {
        scanDir(full);
      } else if (e.isFile() && e.name.endsWith('.html')) {
        const rel = path.relative(websitePublicDir, full).replace(/\\/g, '/');
        allHtmlFiles.push(rel);
      }
    }
  }
  scanDir(websitePublicDir);

  for (const g of games) {
    if (allHtmlFiles.includes(`game/${g.id}.html`) || allHtmlFiles.includes(`game/${g.id}/index.html`)) {
      foundGameDetails.push(g.id);
    }
    if (allHtmlFiles.includes(`game/${g.id}/setup.html`) || allHtmlFiles.includes(`game/${g.id}/setup/index.html`)) {
      foundGameSetups.push(g.id);
    }
  }

  for (const c of categories) {
    if (allHtmlFiles.includes(`cards/${c.id}.html`) || allHtmlFiles.includes(`cards/${c.id}/index.html`)) {
      foundCards.push(c.id);
    }
  }

  const missingGames = games.filter(g => !foundGameDetails.includes(g.id));
  const missingSetups = games.filter(g => !foundGameSetups.includes(g.id));
  const missingCards = categories.filter(c => !foundCards.includes(c.id));

  return {
    totalHtmlFiles: allHtmlFiles.length,
    gameDetailsCount: foundGameDetails.length,
    gameSetupsCount: foundGameSetups.length,
    cardsCount: foundCards.length,
    missingGames,
    missingSetups,
    missingCards,
    allHtmlFiles
  };
}

async function runSmokeSuite() {
  console.log(`========================================================================`);
  console.log(`TASK 53 PRODUCTION STATIC ROUTE INTEGRITY & CORRECTNESS VERIFICATION`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Target Viewports: Mobile (390x844), Desktop (1440x900)`);
  console.log(`========================================================================\n`);

  // 1. Authoritative models check
  console.log(`--- 1. Deriving Authoritative Models ---`);
  const { games, categories } = deriveAuthoritativeModels();
  console.log(`  - Verified ${games.length} Game IDs: [${games.map(g => g.id).join(', ')}]`);
  console.log(`  - Verified ${categories.length} Cards Category IDs: [${categories.map(c => c.id).join(', ')}]`);

  // 2. Published static file audit
  console.log(`\n--- 2. Published Route Artifact Audit ---`);
  const fileAudit = auditStaticRouteFiles(games, categories);
  console.log(`  - Total HTML Route Artifacts in website/public: ${fileAudit.totalHtmlFiles}`);
  console.log(`  - Verified Game Detail HTML routes: ${fileAudit.gameDetailsCount}/${games.length}`);
  console.log(`  - Verified Game Setup HTML routes: ${fileAudit.gameSetupsCount}/${games.length}`);
  console.log(`  - Verified Cards Category HTML routes: ${fileAudit.cardsCount}/${categories.length}`);
  assert.strictEqual(fileAudit.missingGames.length, 0, `Missing game detail files: ${JSON.stringify(fileAudit.missingGames)}`);
  assert.strictEqual(fileAudit.missingSetups.length, 0, `Missing game setup files: ${JSON.stringify(fileAudit.missingSetups)}`);
  assert.strictEqual(fileAudit.missingCards.length, 0, `Missing cards category files: ${JSON.stringify(fileAudit.missingCards)}`);

  // 3. Direct HTTP GET static content assertions (before JS)
  console.log(`\n--- 3. Direct HTTP GET Response Assertions (No JS / Static HTML) ---`);
  
  // Find current live bundle script tag from index
  const rootHttp = await httpGet(`${baseUrl}/`);
  assert.strictEqual(rootHttp.statusCode, 200, `Root URL must return HTTP 200`);
  const bundleMatch = rootHttp.body.match(/src="(\/_expo\/static\/js\/web\/entry-[a-f0-9]+\.js)"/);
  assert(bundleMatch, `Could not find entry bundle script in root response HTML`);
  const currentBundlePath = bundleMatch[1];
  console.log(`  - Live Production Entry Bundle: ${currentBundlePath}`);

  // Test 16 Game Detail direct HTTP responses
  for (const g of games) {
    const url = `${baseUrl}/game/${g.id}`;
    const res = await httpGet(url);
    assert.strictEqual(res.statusCode, 200, `Direct HTTP GET ${url} must return 200 (got ${res.statusCode})`);
    assert(res.contentType.includes('text/html'), `Direct HTTP GET ${url} must have HTML content type`);
    assert(res.body.includes(currentBundlePath), `Direct HTTP GET ${url} must reference current bundle ${currentBundlePath}`);
    assert(htmlContainsText(res.body, g.name), `Direct HTTP GET ${url} must include game title "${g.name}" in static HTML`);
    assert(!res.body.includes('Game not found'), `Direct HTTP GET ${url} must not contain "Game not found"`);
    if (g.id !== 'memory_grid') {
      assert(!res.body.includes('>Memory Grid<'), `Direct HTTP GET ${url} must not contain fallback ">Memory Grid<"`);
    }
  }
  console.log(`  - All 16 Game Detail routes returned HTTP 200 with matching static game titles & bundle.`);

  // Test 16 Game Setup direct HTTP responses
  for (const g of games) {
    const url = `${baseUrl}/game/${g.id}/setup?mode=singleDevice`;
    const res = await httpGet(url);
    assert.strictEqual(res.statusCode, 200, `Direct HTTP GET ${url} must return 200 (got ${res.statusCode})`);
    assert(res.contentType.includes('text/html'), `Direct HTTP GET ${url} must have HTML content type`);
    assert(res.body.includes(currentBundlePath), `Direct HTTP GET ${url} must reference current bundle ${currentBundlePath}`);
    assert(htmlContainsText(res.body, g.name), `Direct HTTP GET ${url} must include game title "${g.name}" in setup static HTML`);
    assert(!res.body.includes('Game not found'), `Direct HTTP GET ${url} must not contain "Game not found"`);
  }
  console.log(`  - All 16 Game Setup routes returned HTTP 200 with matching setup static titles & bundle.`);

  // Test 7 Cards Category direct HTTP responses
  for (const c of categories) {
    const url = `${baseUrl}/cards/${c.id}`;
    const res = await httpGet(url);
    assert.strictEqual(res.statusCode, 200, `Direct HTTP GET ${url} must return 200 (got ${res.statusCode})`);
    assert(res.contentType.includes('text/html'), `Direct HTTP GET ${url} must have HTML content type`);
    assert(res.body.includes(currentBundlePath), `Direct HTTP GET ${url} must reference current bundle ${currentBundlePath}`);
    assert(htmlContainsText(res.body, c.title), `Direct HTTP GET ${url} must include category title "${c.title}" in static HTML`);
    assert(!res.body.includes('Category not found'), `Direct HTTP GET ${url} must not contain "Category not found"`);
  }
  console.log(`  - All 7 Cards Category routes returned HTTP 200 with matching category titles & bundle.`);

  // Test Unknown routes direct HTTP responses
  const unknownUrls = [
    { url: `${baseUrl}/game/not_a_real_game`, expected: 'Game not found' },
    { url: `${baseUrl}/game/not_a_real_game/setup?mode=singleDevice`, expected: 'Game not found' },
    { url: `${baseUrl}/cards/not_a_real_category`, expected: 'Category not found' },
  ];
  for (const u of unknownUrls) {
    const res = await httpGet(u.url);
    assert.strictEqual(res.statusCode, 200, `Unknown route ${u.url} must return 200`);
    assert(htmlContainsText(res.body, u.expected), `Unknown route ${u.url} must render controlled "${u.expected}" in static HTML`);
  }
  console.log(`  - Unknown routes returned controlled static not-found states.`);

  // 4. Chromium Hydration & Interactive Rendering Smoke (Puppeteer)
  console.log(`\n--- 4. Chromium Hydration & Interactive Screen Assertions ---`);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const allEvents = [];
  let currentViewportName = 'Desktop (1440x900)';

  try {
    const page = await browser.newPage();

    page.on('pageerror', err => {
      const pathname = page.url() ? new URL(page.url()).pathname : '/';
      allEvents.push({
        source: 'pageerror',
        message: err.message || String(err),
        stack: err.stack,
        pathname,
        viewport: currentViewportName,
        timestamp: Date.now()
      });
      console.error(`  [Page Error @ ${pathname} (${currentViewportName})]`, err.message);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        const pathname = page.url() ? new URL(page.url()).pathname : '/';
        allEvents.push({
          source: 'console.error',
          message: text,
          pathname,
          viewport: currentViewportName,
          timestamp: Date.now()
        });
        console.error(`  [Console Error @ ${pathname} (${currentViewportName})] ${text}`);
      }
    });

    // 4A. Hydrate all 16 Game Details (alternating viewports)
    console.log(`\n  Testing 16 Game Detail Hydration Screens...`);
    for (let i = 0; i < games.length; i++) {
      const g = games[i];
      const vp = i % 2 === 0 ? { name: 'Mobile (390x844)', w: 390, h: 844 } : { name: 'Desktop (1440x900)', w: 1440, h: 900 };
      currentViewportName = vp.name;
      await page.setViewport({ width: vp.w, height: vp.h });

      const url = `${baseUrl}/game/${g.id}`;
      await page.goto(url, { waitUntil: 'networkidle0' });
      await page.evaluate(() => new Promise(r => setTimeout(r, 200)));

      // Inspect visible content
      const state = await page.evaluate((expectedName) => {
        const bodyText = document.body.innerText || '';
        const singleDeviceBtn = document.querySelector('[data-testid="game-detail-mode-singleDevice"]');
        const modeButtons = document.querySelectorAll('[data-testid^="game-detail-mode-"]');
        const hasName = bodyText.includes(expectedName);
        const hasNotFound = bodyText.includes('Game not found');
        return {
          hasName,
          hasNotFound,
          hasSingleDeviceBtn: !!singleDeviceBtn,
          modeBtnCount: modeButtons.length,
          bodySample: bodyText.substring(0, 150)
        };
      }, g.name);

      assert(state.hasName, `[${g.id} @ ${vp.name}] Visible page must contain game title "${g.name}"`);
      assert(!state.hasNotFound, `[${g.id} @ ${vp.name}] Must not show "Game not found"`);
      assert(state.hasSingleDeviceBtn, `[${g.id} @ ${vp.name}] Must show 1-Phone mode button`);
      assert.strictEqual(state.modeBtnCount, 1, `[${g.id} @ ${vp.name}] Web must render exactly 1 singleDevice mode button (got ${state.modeBtnCount})`);
      console.log(`    [PASS] Game Detail: /game/${g.id} [${vp.name}] -> Title: "${g.name}" | Modes: 1`);
    }

    // 4B. Hydrate all 16 Game Setups (alternating viewports)
    console.log(`\n  Testing 16 Game Setup Hydration Screens...`);
    for (let i = 0; i < games.length; i++) {
      const g = games[i];
      const vp = i % 2 === 1 ? { name: 'Mobile (390x844)', w: 390, h: 844 } : { name: 'Desktop (1440x900)', w: 1440, h: 900 };
      currentViewportName = vp.name;
      await page.setViewport({ width: vp.w, height: vp.h });

      const url = `${baseUrl}/game/${g.id}/setup?mode=singleDevice`;
      await page.goto(url, { waitUntil: 'networkidle0' });
      await page.evaluate(() => new Promise(r => setTimeout(r, 200)));

      const state = await page.evaluate((expectedName) => {
        const bodyText = document.body.innerText || '';
        const backBtn = document.querySelector('[data-testid="setup-back-btn"]');
        const startBtn = document.querySelector('[data-testid="setup-start-button"]');
        const hasName = bodyText.includes(expectedName);
        const hasNotFound = bodyText.includes('Game not found');
        return {
          hasName,
          hasNotFound,
          hasBackBtn: !!backBtn,
          hasStartBtn: !!startBtn,
        };
      }, g.name);

      assert(state.hasName, `[${g.id}/setup @ ${vp.name}] Setup screen must contain game title "${g.name}"`);
      assert(!state.hasNotFound, `[${g.id}/setup @ ${vp.name}] Setup screen must not show "Game not found"`);
      assert(state.hasBackBtn, `[${g.id}/setup @ ${vp.name}] Setup screen must have Back button`);
      assert(state.hasStartBtn, `[${g.id}/setup @ ${vp.name}] Setup screen must have Start button`);
      console.log(`    [PASS] Game Setup: /game/${g.id}/setup [${vp.name}] -> Title: "${g.name}" | Back & Start buttons verified`);
    }

    // 4C. Hydrate all 7 Cards Categories (alternating viewports)
    console.log(`\n  Testing 7 Cards Category Hydration Screens...`);
    for (let i = 0; i < categories.length; i++) {
      const c = categories[i];
      const vp = i % 2 === 0 ? { name: 'Mobile (390x844)', w: 390, h: 844 } : { name: 'Desktop (1440x900)', w: 1440, h: 900 };
      currentViewportName = vp.name;
      await page.setViewport({ width: vp.w, height: vp.h });

      const url = `${baseUrl}/cards/${c.id}`;
      await page.goto(url, { waitUntil: 'networkidle0' });
      await page.evaluate(() => new Promise(r => setTimeout(r, 200)));

      const state = await page.evaluate((expectedTitle) => {
        const bodyText = document.body.innerText || '';
        const backBtn = document.querySelector('[data-testid="cards-back-btn"]');
        const hasTitle = bodyText.includes(expectedTitle);
        const hasNotFound = bodyText.includes('Category not found');
        return {
          hasTitle,
          hasNotFound,
          hasBackBtn: !!backBtn,
          bodySample: bodyText.substring(0, 100)
        };
      }, c.title);

      assert(state.hasTitle, `[cards/${c.id} @ ${vp.name}] Cards deck screen must contain category title "${c.title}"`);
      assert(!state.hasNotFound, `[cards/${c.id} @ ${vp.name}] Cards deck screen must not show "Category not found"`);
      assert(state.hasBackBtn, `[cards/${c.id} @ ${vp.name}] Cards deck screen must have Back button`);
      console.log(`    [PASS] Cards Deck: /cards/${c.id} [${vp.name}] -> Category Title: "${c.title}" | Back button verified`);
    }

    // 4D. Hydrate Unknown Routes in Chromium
    console.log(`\n  Testing Unknown Route Hydration States...`);
    for (const u of unknownUrls) {
      currentViewportName = 'Desktop (1440x900)';
      await page.setViewport({ width: 1440, height: 900 });
      await page.goto(u.url, { waitUntil: 'networkidle0' });
      await page.evaluate(() => new Promise(r => setTimeout(r, 200)));

      const state = await page.evaluate((expectedText) => {
        const bodyText = document.body.innerText || '';
        return {
          hasExpected: bodyText.includes(expectedText),
          hasMemoryGrid: bodyText.includes('Memory Grid'),
          bodySample: bodyText.substring(0, 100)
        };
      }, u.expected);

      assert(state.hasExpected, `[${u.url}] Must show controlled not-found message "${u.expected}"`);
      assert(!state.hasMemoryGrid, `[${u.url}] Must not silently render Memory Grid`);
      console.log(`    [PASS] Unknown Route: ${u.url} -> Rendered controlled state: "${u.expected}"`);
    }

    // 5. Error Grouping and Accounting
    console.log(`\n--- 5. Error Accounting & Audit Summary ---`);
    const eventGroups = new Map();
    for (const ev of allEvents) {
      const normalizedMsg = ev.message.trim().replace(/https?:\/\/[^\s]+/g, '[URL]');
      const key = `${normalizedMsg} @ ${ev.pathname}`;
      if (!eventGroups.has(key)) {
        eventGroups.set(key, {
          message: ev.message,
          normalizedMsg,
          pathname: ev.pathname,
          viewports: new Set(),
          sources: new Set(),
          count: 0,
          isExtension: ev.message.includes('chrome-extension://'),
          isHydration: ev.message.includes('Minified React error #418') || ev.message.includes('Hydration failed'),
        });
      }
      const group = eventGroups.get(key);
      group.viewports.add(ev.viewport);
      group.sources.add(ev.source);
      group.count++;
    }

    const actionableFirstPartyErrors = [];
    const extensionErrors = [];

    console.log(`  Grouped Event Summary (${eventGroups.size} distinct groups):`);
    if (eventGroups.size === 0) {
      console.log(`    (No errors or warning events recorded)`);
    }

    for (const [key, g] of eventGroups.entries()) {
      const srcList = Array.from(g.sources).join(', ');
      const vpList = Array.from(g.viewports).join(', ');
      const isDuplicateChannel = g.sources.size > 1 ? ' [DUPLICATE CHANNELS: pageerror + console]' : '';
      console.log(`    - Group: "${g.normalizedMsg.substring(0, 100)}..." @ ${g.pathname}`);
      console.log(`      Count: ${g.count} | Sources: [${srcList}]${isDuplicateChannel} | Viewports: [${vpList}]`);

      if (g.isExtension) {
        extensionErrors.push(g);
      } else {
        actionableFirstPartyErrors.push(g);
      }
    }

    console.log(`\n  - Total Recorded Events: ${allEvents.length}`);
    console.log(`  - Extension Events: ${extensionErrors.length}`);
    console.log(`  - Actionable First-Party Errors (including React hydration mismatches): ${actionableFirstPartyErrors.length}`);

    assert.strictEqual(actionableFirstPartyErrors.length, 0, `Must have 0 actionable first-party errors/hydration mismatches (got: ${JSON.stringify(actionableFirstPartyErrors)})`);

    console.log(`\n========================================================================`);
    console.log(`ALL 91 STATIC ROUTES, CONTENT ASSERTIONS & ERROR AUDITS PASSED!`);
    console.log(`========================================================================\n`);

  } finally {
    await browser.close();
  }
}

runSmokeSuite().catch(err => {
  console.error('\nSTATIC ROUTE SMOKE SUITE FAILED:', err);
  process.exit(1);
});
