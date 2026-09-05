const puppeteer = require('./expo/node_modules/puppeteer');
const https = require('https');
const http = require('http');
const assert = require('assert');

// Parse CLI arguments
const args = process.argv.slice(2);
const baseUrlIdx = args.indexOf('--base-url');
const baseUrl = (baseUrlIdx !== -1 && args[baseUrlIdx + 1] ? args[baseUrlIdx + 1] : 'https://partybot.games').replace(/\/$/, '');

async function clickVisibleElement(page, selector, timeout = 15000, delayAfter = 400) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const handles = await page.$$(selector);
    for (const h of handles) {
      const isVis = await h.evaluate(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
      });
      if (isVis) {
        await h.click();
        if (delayAfter > 0) {
          await page.evaluate((ms) => new Promise(r => setTimeout(r, ms)), delayAfter);
        }
        return;
      }
    }
    await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
  }
  throw new Error(`Element not found or not visible: ${selector}`);
}

async function getElementRect(page, selector) {
  return await page.evaluate((sel) => {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        return {
          x: Math.round(r.x),
          y: Math.round(r.y),
          width: Math.round(r.width),
          height: Math.round(r.height),
          visible: true,
        };
      }
    }
    return null;
  }, selector);
}

async function reportCheckpoint(page, route, vpName, phaseName, extraDetails = {}) {
  const metrics = await page.evaluate(() => {
    const root = document.getElementById('root');
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      windowScrollY: window.scrollY,
      rootScrollTop: root ? root.scrollTop : 0,
      bodyScrollTop: document.body.scrollTop,
    };
  });

  const isPassing = !metrics.overflow && metrics.windowScrollY === 0 && metrics.rootScrollTop === 0;
  const detailStrings = Object.entries(extraDetails).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`);
  const detailsLine = detailStrings.length > 0 ? `  - Details: ${detailStrings.join(', ')}` : null;

  console.log(`[CHECKPOINT] Route: ${route} | Viewport: ${vpName} | Phase: ${phaseName}`);
  console.log(`  - #root.scrollTop: ${metrics.rootScrollTop} | window.scrollY: ${metrics.windowScrollY} | Overflow: ${metrics.overflow}`);
  if (detailsLine) console.log(detailsLine);
  console.log(`  - Status: ${isPassing ? 'PASS' : 'FAIL'}`);

  assert.strictEqual(metrics.overflow, false, `[${route} ${vpName} ${phaseName}] Horizontal overflow detected!`);
  assert.strictEqual(metrics.windowScrollY, 0, `[${route} ${vpName} ${phaseName}] window.scrollY must be 0`);
  assert.strictEqual(metrics.rootScrollTop, 0, `[${route} ${vpName} ${phaseName}] #root.scrollTop must be 0`);

  return metrics;
}

function verifyFaviconHttp(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          contentType: res.headers['content-type'] || '',
          sizeBytes: body.length
        });
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log(`========================================================================`);
  console.log(`TASK 51 PRODUCTION-RELEASE INTEGRITY, BOTTLE ART & OFFLINE VERIFICATION`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Target Viewports: Mobile (390x844), Desktop (1440x900)`);
  console.log(`========================================================================\n`);

  // =========================================================================
  // 1. DIRECT HTTP FAVICON VERIFICATION (NO EXCLUSIONS)
  // =========================================================================
  console.log(`--- 1. Direct HTTP Favicon Verification ---`);
  const faviconUrl = `${baseUrl}/favicon.ico`;
  const faviconResult = await verifyFaviconHttp(faviconUrl);
  console.log(`Favicon Check: ${faviconUrl} -> Status: ${faviconResult.statusCode}, Content-Type: "${faviconResult.contentType}", Size: ${faviconResult.sizeBytes} bytes`);
  assert.strictEqual(faviconResult.statusCode, 200, `Favicon must return HTTP 200 (got ${faviconResult.statusCode})`);
  assert(faviconResult.sizeBytes > 0, `Favicon body must be nonzero (got ${faviconResult.sizeBytes} bytes)`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const allEvents = [];
  const networkErrors = [];
  const dynamicRequests = new Set();
  const forbiddenRequests = [];

  let isOffline = false;
  let currentViewportName = 'Desktop (1440x900)';

  // Patterns for forbidden multiplayer / server / AI / paywall requests during 1-phone local play
  const FORBIDDEN_PATTERNS = [
    'firebaseio.com',
    'firestore.googleapis.com',
    'cloudfunctions.net',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    '/api/',
    'api.revenuecat.com',
    'api.stripe.com',
    'genkit',
    'openai',
    'anthropic',
    'vertexai'
  ];

  try {
    const page = await browser.newPage();

    // Auto-accept confirmation / alert dialogs (e.g. Leave Game)
    page.on('dialog', async dialog => {
      console.log(`  [Dialog] ${dialog.type()}: "${dialog.message()}" -> Auto Accepting`);
      await dialog.accept();
    });

    // Error tracking: Record every pageerror and console error with exact details
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

    page.on('request', req => {
      const url = req.url();
      // Track non-static asset dynamic requests
      const isStatic = url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.html') ||
                       url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.webp') ||
                       url.endsWith('.ico') || url.endsWith('.ttf') || url.endsWith('.svg') ||
                       url.includes('/_expo/static/') || url.includes('/assets/');
      if (!isStatic) {
        dynamicRequests.add(url);
        for (const fp of FORBIDDEN_PATTERNS) {
          if (url.includes(fp)) {
            console.error(`  [FORBIDDEN REQUEST DETECTED] ${req.method()} ${url}`);
            forbiddenRequests.push(`${req.method()} ${url}`);
          }
        }
      }
    });

    page.on('requestfailed', req => {
      const url = req.url();
      const failure = req.failure()?.errorText || '';
      if (!isOffline && !failure.includes('net::ERR_INTERNET_DISCONNECTED') && !url.includes('chrome-extension://')) {
        console.error(`  [Request Failed] ${req.method()} ${url} (${failure})`);
        networkErrors.push(`Failed: ${url}`);
      }
    });

    page.on('response', res => {
      const status = res.status();
      const url = res.url();
      if (status >= 400) {
        console.error(`  [HTTP ${status}] ${url}`);
        networkErrors.push(`HTTP ${status}: ${url}`);
      }
    });

    // =========================================================================
    // 2. RECORD ENTRY BUNDLE & INITIAL PROD VERIFICATION
    // =========================================================================
    console.log(`\n--- 2. Record Live Production Bundle ---`);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });

    const entryBundle = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      for (const s of scripts) {
        const src = s.getAttribute('src') || '';
        if (src.includes('entry-')) return src;
      }
      return 'not found';
    });

    console.log(`Served Live Bundle: ${entryBundle}`);
    assert(entryBundle.includes('entry-'), `Production domain must serve an exported entry bundle`);
    await reportCheckpoint(page, '/', 'Desktop (1440x900)', 'Live Root Catalog Loaded', { entryBundle });

    // =========================================================================
    // 3. COMPACT PRIMARY PATH: Catalog -> Detail -> Setup -> Session -> Offline -> Exit
    // =========================================================================
    console.log(`\n--- 3. Compact Primary Path (Memory Grid Factual Offline State Proof) ---`);
    // Click Memory Grid card
    await clickVisibleElement(page, '[data-testid="game-card-touch-memory_grid"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
    assert(page.url().includes('/game/memory_grid'), `Must navigate to /game/memory_grid`);

    // Verify single 1-Phone mode
    const singleMode = await getElementRect(page, '[data-testid="game-detail-mode-singleDevice"]');
    assert(singleMode && singleMode.visible, `1-Phone mode card must be visible`);
    const multiMode = await page.$('[data-testid="game-detail-mode-multiDevice"]');
    assert.strictEqual(multiMode, null, `Multi-Phone mode must not exist on web`);

    // Click 1-Phone mode card
    await clickVisibleElement(page, '[data-testid="game-detail-mode-singleDevice"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
    assert(page.url().includes('/game/memory_grid/setup'), `Must navigate to setup`);

    // Click Start Game button
    await clickVisibleElement(page, '[data-testid="setup-start-button"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
    assert(page.url().includes('/game/memory_grid/session'), `Must navigate to session`);

    // Dismiss first-time hint overlay if present
    try {
      await clickVisibleElement(page, '[data-testid="first-time-hint-got-it"]', 1500);
      await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
    } catch (_) {}

    // In Ready phase, click Ready button to start playing
    await clickVisibleElement(page, '[data-testid="game-ready-button"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 600)));

    // Active playing phase: Capture factual initial state before offline
    const tile0Before = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="memory-tile-0"]');
      return {
        exists: !!el,
        ariaSelected: el ? el.getAttribute('aria-selected') : null,
        ariaLabel: el ? el.getAttribute('aria-label') : null,
      };
    });
    const moveCountBefore = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="memory-grid-move-count"]');
      return el ? el.textContent.trim() : null;
    });

    console.log(`  [State Before Offline] Tile 0 aria-selected: ${tile0Before.ariaSelected}, Move Count: "${moveCountBefore}"`);
    assert.strictEqual(tile0Before.exists, true, `Tile 0 must exist before offline`);
    assert.strictEqual(tile0Before.ariaSelected, 'false', `Tile 0 must start face-down (aria-selected="false")`);
    assert.strictEqual(moveCountBefore, '0', `Move count must start at "0"`);

    // PROVE OFFLINE GAMEPLAY: Set browser offline
    console.log(`  [Offline Test] Switching browser to OFFLINE mode...`);
    isOffline = true;
    await page.setOfflineMode(true);
    await page.evaluate(() => new Promise(r => setTimeout(r, 200)));

    // Click tile 0 offline
    await clickVisibleElement(page, '[data-testid="memory-tile-0"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

    // Assert tile 0 transitioned to face-up (aria-selected="true")
    const tile0AfterFirst = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="memory-tile-0"]');
      return {
        ariaSelected: el ? el.getAttribute('aria-selected') : null,
        ariaLabel: el ? el.getAttribute('aria-label') : null,
      };
    });
    const moveCountAfterFirst = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="memory-grid-move-count"]');
      return el ? el.textContent.trim() : null;
    });

    console.log(`  [State After 1st Click Offline] Tile 0 aria-selected: ${tile0AfterFirst.ariaSelected} (was false), Move Count: "${moveCountAfterFirst}"`);
    assert.strictEqual(tile0AfterFirst.ariaSelected, 'true', `Tile 0 must transition to face-up (aria-selected="true") while offline`);
    assert.strictEqual(moveCountAfterFirst, '0', `Move count remains "0" while first tile of pair is open`);

    // Click tile 1 (distinct tile) offline
    await clickVisibleElement(page, '[data-testid="memory-tile-1"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

    // Assert move count transitioned from "0" to "1"
    const moveCountAfterSecond = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="memory-grid-move-count"]');
      return el ? el.textContent.trim() : null;
    });

    console.log(`  [State After 2nd Click Offline] Move Count: "${moveCountAfterSecond}" (was 0)`);
    assert.strictEqual(moveCountAfterSecond, '1', `Move count must transition from "0" to "1" after second tile click while offline`);

    // Restore network
    await page.setOfflineMode(false);
    isOffline = false;
    await page.evaluate(() => new Promise(r => setTimeout(r, 200)));
    console.log(`  [Offline Test] Restored browser network connection.`);

    // Assert NO forbidden dynamic requests occurred during the local session flow
    console.log(`  [Network Audit] Unique Dynamic Requests: ${Array.from(dynamicRequests).length}`);
    if (dynamicRequests.size > 0) {
      console.log(`  [Network Audit] Dynamic Destinations:`, Array.from(dynamicRequests));
    }
    assert.strictEqual(forbiddenRequests.length, 0, `Forbidden requests found: ${JSON.stringify(forbiddenRequests)}`);

    // Click Exit button to leave session
    await clickVisibleElement(page, '[data-testid="session-exit-button"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
    assert(!page.url().includes('/session') && !page.url().includes('/game/'), `Exit button must return to catalog (got ${page.url()})`);
    await reportCheckpoint(page, '/', 'Desktop (1440x900)', 'Returned from Memory Grid Session');

    // =========================================================================
    // 4. SHARED BOTTLE ARTWORK & ALL 6 TOOLS HEADER HIERARCHY AUDIT
    // =========================================================================
    console.log(`\n--- 4. Shared Bottle Artwork & Tool Headers (Dice, Bottle, Hourglass, Coin, Teams, Wheel) ---`);
    const TOOL_PAGES = [
      { id: 'dice', path: '/dice', title: 'Dice' },
      { id: 'bottle', path: '/bottle', title: 'Bottle' },
      { id: 'hourglass', path: '/hourglass', title: 'Hourglass' },
      { id: 'coin', path: '/coin', title: 'Coin Flip' },
      { id: 'teams', path: '/teams', title: 'Team Splitter' },
      { id: 'wheel', path: '/wheel', title: 'Wheel' },
    ];

    for (const tool of TOOL_PAGES) {
      console.log(`\n  [Tool Audit: ${tool.title}] Navigating from /tools to ${tool.path}...`);
      await page.goto(`${baseUrl}/tools`, { waitUntil: 'networkidle0' });
      await clickVisibleElement(page, `[data-testid="tool-card-${tool.id}"]`);
      await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
      assert(page.url().includes(tool.path), `Navigated to ${tool.path}`);

      // Verify custom Back button
      const backBtn = await getElementRect(page, '[data-testid="tool-header-back-btn"]');
      assert(backBtn && backBtn.visible, `[${tool.title}] Tool Back button must be visible`);
      assert(backBtn.width >= 44 && backBtn.height >= 44, `[${tool.title}] Tool Back button must have >=44px touch target (got ${backBtn.width}x${backBtn.height})`);

      // Verify NO Done button on web
      const doneBtn = await page.$('[data-testid="tool-header-done-btn"]');
      assert.strictEqual(doneBtn, null, `[${tool.title}] Must not render duplicate Done button`);

      // For Bottle tool: Factually sample rendered image transparency via Canvas
      if (tool.id === 'bottle') {
        const bottleSampling = await page.evaluate(async () => {
          const img = document.querySelector('img[src*="bottle"]') || document.querySelector('[data-testid="beer-bottle-img"] img') || document.querySelector('[data-testid="beer-bottle-img"]');
          if (!img) return { error: 'Bottle image not found in DOM' };
          
          const imgSrc = img.src || img.getAttribute('src');
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          
          return new Promise((resolve) => {
            const sampleImg = new Image();
            sampleImg.crossOrigin = 'anonymous';
            sampleImg.onload = () => {
              canvas.width = sampleImg.naturalWidth;
              canvas.height = sampleImg.naturalHeight;
              ctx.drawImage(sampleImg, 0, 0);
              
              const w = canvas.width;
              const h = canvas.height;
              
              const tl = ctx.getImageData(0, 0, 1, 1).data;
              const tr = ctx.getImageData(w - 1, 0, 1, 1).data;
              const bl = ctx.getImageData(0, h - 1, 1, 1).data;
              const br = ctx.getImageData(w - 1, h - 1, 1, 1).data;
              const center = ctx.getImageData(Math.floor(w / 2), Math.floor(h / 2), 1, 1).data;
              
              resolve({
                naturalWidth: w,
                naturalHeight: h,
                corners: [
                  { x: 0, y: 0, alpha: tl[3], rgb: [tl[0], tl[1], tl[2]] },
                  { x: w - 1, y: 0, alpha: tr[3], rgb: [tr[0], tr[1], tr[2]] },
                  { x: 0, y: h - 1, alpha: bl[3], rgb: [bl[0], bl[1], bl[2]] },
                  { x: w - 1, y: h - 1, alpha: br[3], rgb: [br[0], br[1], br[2]] },
                ],
                center: { alpha: center[3], rgb: [center[0], center[1], center[2]] }
              });
            };
            sampleImg.onerror = (e) => resolve({ error: 'Failed to load bottle image for sampling' });
            sampleImg.src = imgSrc;
          });
        });

        console.log(`  [Bottle Alpha Sampling] Dimensions: ${bottleSampling.naturalWidth}x${bottleSampling.naturalHeight}`);
        console.log(`  [Bottle Alpha Sampling] Corner Alphas:`, bottleSampling.corners?.map(c => c.alpha));
        console.log(`  [Bottle Alpha Sampling] Center Alpha:`, bottleSampling.center?.alpha);
        
        assert(!bottleSampling.error, `Bottle sampling error: ${bottleSampling.error}`);
        assert(bottleSampling.corners.every(c => c.alpha <= 5), `All 4 corners of bottle image must have transparent alpha <= 5`);
        assert(bottleSampling.center.alpha >= 200, `Bottle center body must have opaque alpha >= 200`);
      }

      // Click Back button -> returns to /tools
      await clickVisibleElement(page, '[data-testid="tool-header-back-btn"]');
      await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
      assert(page.url().includes('/tools'), `[${tool.title}] Tool Back click must return to /tools (got ${page.url()})`);
    }

    // =========================================================================
    // 5. SPIN BOTTLE GAME SESSION VERIFICATION
    // =========================================================================
    console.log(`\n--- 5. Spin Bottle Game Session Verification ---`);
    await page.goto(`${baseUrl}/game/spin_bottle/setup?mode=singleDevice`, { waitUntil: 'networkidle0' });
    await clickVisibleElement(page, '[data-testid="setup-start-button"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
    assert(page.url().includes('/game/spin_bottle/session'), `Navigated to spin bottle session`);

    // Dismiss first-time hint overlay if present
    try {
      await clickVisibleElement(page, '[data-testid="first-time-hint-got-it"]', 1500);
      await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
    } catch (_) {}

    // Measure bottle element bounds in session
    const sessionBottleBounds = await page.evaluate(() => {
      const img = document.querySelector('img[src*="bottle"]') || document.querySelector('[data-testid="beer-bottle-img"] img');
      if (!img) return null;
      const r = img.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    });
    console.log(`  [Spin Bottle Session] Rendered Bottle Bounds:`, sessionBottleBounds);

    // Verify session exit returns to catalog
    await clickVisibleElement(page, '[data-testid="session-exit-button"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
    assert(!page.url().includes('/session'), `Returned from spin bottle session`);

    // =========================================================================
    // 6. AUXILIARY PRIMARY PATHS (Sound Match, Cards, Profile)
    // =========================================================================
    console.log(`\n--- 6. Sound Match, Cards, and Profile Primary Paths ---`);
    // Audio game: Sound Match
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });
    await clickVisibleElement(page, '[data-testid="game-card-touch-sound_match"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
    assert(page.url().includes('/game/sound_match'), `Must navigate to Sound Match detail`);
    await clickVisibleElement(page, '[data-testid="game-detail-back-btn"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
    assert(!page.url().includes('/game/'), `Returned from Sound Match to catalog`);

    // Cards category: /cards/act
    await page.goto(`${baseUrl}/cards/act`, { waitUntil: 'networkidle0' });
    const cardsBack = await getElementRect(page, '[data-testid="cards-back-btn"]');
    assert(cardsBack && cardsBack.visible, `Cards back button must be visible`);
    await clickVisibleElement(page, '[data-testid="cards-back-btn"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

    // Profile: /profile
    await page.goto(`${baseUrl}/profile`, { waitUntil: 'networkidle0' });
    const profileBack = await getElementRect(page, '[data-testid="profile-done-button"]');
    assert(profileBack && profileBack.visible, `Profile back button must be visible`);
    await clickVisibleElement(page, '[data-testid="profile-done-button"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

    await reportCheckpoint(page, '/', 'Desktop (1440x900)', 'All Auxiliary Primary Paths Verified');

    // =========================================================================
    // 7. HARD REFRESH / DIRECT ENTRY AUDIT (8 REQUIRED ROUTES)
    // =========================================================================
    console.log(`\n--- 7. Hard Refresh / Direct Entry on 8 Required Routes ---`);
    const REQUIRED_ROUTES = [
      { path: '/', expectedBack: null },
      { path: '/play', expectedBack: null },
      { path: '/game/memory_grid', backSel: '[data-testid="game-detail-back-btn"]' },
      { path: '/game/memory_grid/setup?mode=singleDevice', backSel: '[data-testid="setup-back-btn"]' },
      { path: '/tools', expectedBack: null },
      { path: '/dice', backSel: '[data-testid="tool-header-back-btn"]' },
      { path: '/cards/act', backSel: '[data-testid="cards-back-btn"]' },
      { path: '/profile', backSel: '[data-testid="profile-done-button"]' },
    ];

    for (const route of REQUIRED_ROUTES) {
      for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
        currentViewportName = vp.name;
        await page.setViewport({ width: vp.w, height: vp.h });
        await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle0' });

        // Hard refresh
        await page.reload({ waitUntil: 'networkidle0' });

        if (route.backSel) {
          const backBtn = await getElementRect(page, route.backSel);
          assert(backBtn && backBtn.visible, `Back button ${route.backSel} must be visible on direct load of ${route.path}`);
        }

        await reportCheckpoint(page, route.path, vp.name, 'Direct Load & Hard Refresh Succeeded');
      }
    }

    // =========================================================================
    // 8. BROWSER BACK & FORWARD HISTORY TRAVERSAL
    // =========================================================================
    console.log(`\n--- 8. Browser History Back & Forward Traversal ---`);
    currentViewportName = 'Desktop (1440x900)';
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });

    // Step 1: Click Memory Grid
    await clickVisibleElement(page, '[data-testid="game-card-touch-memory_grid"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
    assert(page.url().includes('/game/memory_grid'), `Traversed to detail: ${page.url()}`);

    // Step 2: Click 1-Phone mode -> Setup
    await clickVisibleElement(page, '[data-testid="game-detail-mode-singleDevice"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
    assert(page.url().includes('/game/memory_grid/setup'), `Traversed to setup: ${page.url()}`);

    // Browser Back -> Detail
    await page.goBack();
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
    assert(page.url().includes('/game/memory_grid') && !page.url().includes('setup'), `Browser back must return to detail: ${page.url()}`);

    // Browser Back -> Catalog
    await page.goBack();
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
    assert(!page.url().includes('/game/'), `Browser back must return to catalog: ${page.url()}`);

    // Browser Forward -> Detail
    await page.goForward();
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
    assert(page.url().includes('/game/memory_grid') && !page.url().includes('setup'), `Browser forward must return to detail: ${page.url()}`);

    // Browser Forward -> Setup
    await page.goForward();
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
    assert(page.url().includes('/game/memory_grid/setup'), `Browser forward must return to setup: ${page.url()}`);

    await reportCheckpoint(page, '/game/memory_grid/setup', 'Desktop (1440x900)', 'Browser History Back/Forward Fully Traversed');

    // =========================================================================
    // 9. HONEST & ACTIONABLE ERROR ACCOUNTING
    // =========================================================================
    console.log(`\n--- 9. Error Accounting & Audit Summary ---`);

    // Group recorded events by normalized message + pathname
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

    console.log(`\n  - Total Recorded Event Count: ${allEvents.length}`);
    console.log(`  - Extension Events (if any): ${extensionErrors.length}`);
    console.log(`  - Actionable First-Party Errors (including React hydration mismatches): ${actionableFirstPartyErrors.length}`);
    console.log(`  - Network/HTTP Errors: ${networkErrors.length}`);
    console.log(`  - Forbidden Dynamic Requests: ${forbiddenRequests.length}`);

    assert.strictEqual(actionableFirstPartyErrors.length, 0, `Must have 0 actionable first-party errors/hydration mismatches (got: ${JSON.stringify(actionableFirstPartyErrors)})`);
    assert.strictEqual(networkErrors.length, 0, `Must have 0 network/HTTP errors (got: ${JSON.stringify(networkErrors)})`);
    assert.strictEqual(forbiddenRequests.length, 0, `Must have 0 forbidden requests (got: ${JSON.stringify(forbiddenRequests)})`);

    console.log(`\n========================================================================`);
    console.log(`ALL PRODUCTION RELEASE INTEGRITY, BOTTLE ART & OFFLINE SUITES PASSED!`);
    console.log(`========================================================================\n`);

  } finally {
    await browser.close();
  }
}

runTests().catch(err => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
