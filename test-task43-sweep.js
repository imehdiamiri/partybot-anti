const puppeteer = require('./expo/node_modules/puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Parse CLI arguments
const args = process.argv.slice(2);
const baseUrlIdx = args.indexOf('--base-url');
const baseUrl = (baseUrlIdx !== -1 && args[baseUrlIdx + 1] ? args[baseUrlIdx + 1] : 'https://partybot.games').replace(/\/$/, '');
const isLocal = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

let localServer = null;

async function clickElement(page, selector, delayAfter = 400) {
  await page.waitForSelector(selector, { timeout: 15000 });
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }
  }, selector);
  if (delayAfter > 0) {
    await page.evaluate((ms) => new Promise(r => setTimeout(r, ms)), delayAfter);
  }
}

async function dismissHintsIfPresent(page) {
  try {
    const hintBtn = await page.$('text/Got it');
    if (hintBtn) {
      await hintBtn.click();
      await page.evaluate(() => new Promise(r => setTimeout(r, 400)));
    }
  } catch (e) {
    // Ignore if not present
  }
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

async function runTests() {
  console.log(`========================================================================`);
  console.log(`TASK 43/44 RESPONSIVE GAMEPLAY & PROFILE SWEEP`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Target Viewports: Mobile (390x844), Desktop (1440x900)`);
  console.log(`========================================================================\n`);

  if (isLocal) {
    const publicDir = path.join(__dirname, 'website', 'public');
    localServer = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/') reqPath = '/index.html';
      let filePath = path.join(publicDir, reqPath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(publicDir, 'index.html');
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
        '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ttf': 'font/ttf',
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    const port = parseInt(new URL(baseUrl).port) || 8099;
    await new Promise(resolve => localServer.listen(port, resolve));
    console.log(`Local test server started on port ${port}`);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // =========================================================================
    // 1. PROFILE SCREEN RESPONSIVE TESTS
    // =========================================================================
    console.log(`\n--- 1. Profile Page ---`);
    
    // 1A. Mobile (390x844)
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/profile`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="profile-identity-card"]', { timeout: 15000 });

    const mobileProfileBounds = await page.evaluate(() => {
      const identity = document.querySelector('[data-testid="profile-identity-card"]');
      const login = document.querySelector('[data-testid="profile-login-button"]');
      const prefs = document.querySelector('[data-testid="profile-preferences-card"]');
      const wallet = document.querySelector('[data-testid="profile-wallet-section"]');
      return {
        identityWidth: identity ? Math.round(identity.getBoundingClientRect().width) : 0,
        loginWidth: login ? Math.round(login.getBoundingClientRect().width) : 0,
        prefsWidth: prefs ? Math.round(prefs.getBoundingClientRect().width) : 0,
        walletWidth: wallet ? Math.round(wallet.getBoundingClientRect().width) : 0,
      };
    });
    assert(mobileProfileBounds.identityWidth > 320 && mobileProfileBounds.identityWidth <= 390, 'Identity card should span mobile width with padding');
    assert(mobileProfileBounds.loginWidth > 320, 'Login button should span mobile width with padding');

    // Test sound switch
    await clickElement(page, '[data-testid="profile-sound-switch"]');
    await reportCheckpoint(page, '/profile', 'Mobile (390x844)', 'Guest Layout & Sound Switch', mobileProfileBounds);

    // 1B. Desktop (1440x900)
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${baseUrl}/profile`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="profile-identity-card"]', { timeout: 15000 });

    const desktopProfileBounds = await page.evaluate(() => {
      const identity = document.querySelector('[data-testid="profile-identity-card"]');
      const login = document.querySelector('[data-testid="profile-login-button"]');
      const prefs = document.querySelector('[data-testid="profile-preferences-card"]');
      const wallet = document.querySelector('[data-testid="profile-wallet-section"]');
      const doneBtn = document.querySelector('[data-testid="profile-done-button"]');

      const iRect = identity ? identity.getBoundingClientRect() : null;
      const pRect = prefs ? prefs.getBoundingClientRect() : null;
      const wRect = wallet ? wallet.getBoundingClientRect() : null;
      const dRect = doneBtn ? doneBtn.getBoundingClientRect() : null;

      return {
        identity: iRect ? { left: Math.round(iRect.left), width: Math.round(iRect.width) } : null,
        prefs: pRect ? { left: Math.round(pRect.left), width: Math.round(pRect.width) } : null,
        wallet: wRect ? { left: Math.round(wRect.left), width: Math.round(wRect.width) } : null,
        doneBtn: dRect ? { left: Math.round(dRect.left), width: Math.round(dRect.width) } : null,
      };
    });
    assert(desktopProfileBounds.identity.width <= 760, `Identity width (${desktopProfileBounds.identity.width}) exceeds 760px desktop max!`);
    assert(desktopProfileBounds.prefs.width <= 760, `Preferences width (${desktopProfileBounds.prefs.width}) exceeds 760px desktop max!`);
    assert(desktopProfileBounds.wallet.width <= 760, `Wallet section width (${desktopProfileBounds.wallet.width}) exceeds 760px desktop max!`);
    assert(Math.abs(desktopProfileBounds.identity.left - desktopProfileBounds.prefs.left) < 5, 'Identity and Preferences should share common left alignment');
    assert(desktopProfileBounds.doneBtn !== null, 'Done button must be present in header');
    await reportCheckpoint(page, '/profile', 'Desktop (1440x900)', 'Centered Bounded Column (728px)', {
      columnWidth: desktopProfileBounds.identity.width,
      columnLeft: desktopProfileBounds.identity.left,
      doneBtnLeft: desktopProfileBounds.doneBtn.left
    });

    // =========================================================================
    // 2. REACTION TIME RESPONSIVE TESTS
    // =========================================================================
    console.log(`\n--- 2. Reaction Time ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/game/reaction_time/setup?mode=singleDevice`, { waitUntil: 'networkidle0' });
      await clickElement(page, '[data-testid="setup-start-button"]');
      await dismissHintsIfPresent(page);

      // Ready handoff
      await clickElement(page, '[data-testid="game-ready-button"]');
      await page.waitForSelector('[data-testid="reaction-time-press"]', { timeout: 15000 });
      await reportCheckpoint(page, '/game/reaction_time', vp.name, 'Active Play (Waiting Screen)');

      // Tap to complete attempt
      await clickElement(page, '[data-testid="reaction-time-press"]');
      await page.waitForSelector('[data-testid="reaction-time-continue-button"]', { timeout: 15000 });
      await reportCheckpoint(page, '/game/reaction_time', vp.name, 'Attempt Result Feedback');
    }

    // =========================================================================
    // 3. EYE SIGHT RESPONSIVE TESTS
    // =========================================================================
    console.log(`\n--- 3. Eye Sight ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/game/eye_sight/setup?mode=singleDevice`, { waitUntil: 'networkidle0' });
      await clickElement(page, '[data-testid="setup-start-button"]');
      await dismissHintsIfPresent(page);

      // Pick difficulty
      await clickElement(page, '[data-testid="eyesight-diff-easy"]');
      await clickElement(page, '[data-testid="game-ready-button"]');

      // Keypad entry phase
      await page.waitForSelector('[data-testid="eyesight-key-submit"]', { timeout: 15000 });
      await reportCheckpoint(page, '/game/eye_sight', vp.name, 'Keypad Entry Phase');

      // Enter 3 digits and submit
      await clickElement(page, '[data-testid="eyesight-key-1"]', 100);
      await clickElement(page, '[data-testid="eyesight-key-2"]', 100);
      await clickElement(page, '[data-testid="eyesight-key-3"]', 100);
      await clickElement(page, '[data-testid="eyesight-key-submit"]', 300);

      // Result screen
      await page.waitForFunction(() => {
        return !!document.querySelector('[data-testid="eyesight-next-round-button"]') ||
               !!document.querySelector('[data-testid="eyesight-continue-button"]');
      }, { timeout: 15000 });
      await reportCheckpoint(page, '/game/eye_sight', vp.name, 'Round Result Feedback');
    }

    // =========================================================================
    // 4. COLOR MATCH RESPONSIVE TESTS
    // =========================================================================
    console.log(`\n--- 4. Color Match ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/game/color_match/setup?mode=singleDevice`, { waitUntil: 'networkidle0' });
      await clickElement(page, '[data-testid="setup-start-button"]');
      await dismissHintsIfPresent(page);

      // Ready to memorize
      await clickElement(page, '[data-testid="game-ready-button"]');
      // Wait for memorize phase to transition to recreate
      await page.waitForSelector('[data-testid="color-match-submit-button"]', { timeout: 15000 });
      await reportCheckpoint(page, '/game/color_match', vp.name, 'Recreate Phase (Sliders)');

      // Submit match
      await clickElement(page, '[data-testid="color-match-submit-button"]');
      await page.waitForSelector('[data-testid="color-match-continue-button"]', { timeout: 15000 });
      await reportCheckpoint(page, '/game/color_match', vp.name, 'Round Result (Swatches)');
    }

    // =========================================================================
    // 5. COLOR TRAP RESPONSIVE TESTS
    // =========================================================================
    console.log(`\n--- 5. Color Trap ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/game/color_trap/setup?mode=singleDevice`, { waitUntil: 'networkidle0' });
      await clickElement(page, '[data-testid="setup-start-button"]');
      await dismissHintsIfPresent(page);

      // Ready screen
      await clickElement(page, '[data-testid="color-trap-ready-button"]');
      await page.waitForSelector('[data-testid^="color-trap-tile-"]', { timeout: 15000 });

      // Tap active tile
      await page.evaluate(() => {
        const tile = document.querySelector('[data-testid^="color-trap-tile-"]');
        if (tile) {
          tile.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }
      });
      await reportCheckpoint(page, '/game/color_trap', vp.name, 'Active Arena & Tile Interaction');
    }

    // =========================================================================
    // 6. TAP IN ORDER RESPONSIVE TESTS
    // =========================================================================
    console.log(`\n--- 6. Tap In Order ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/game/tap_in_order/setup?mode=singleDevice`, { waitUntil: 'networkidle0' });
      await clickElement(page, '[data-testid="setup-start-button"]');
      await dismissHintsIfPresent(page);

      // Start board
      await clickElement(page, '[data-testid="game-ready-button"]');
      await page.waitForSelector('[data-testid="tap-cell-0"]', { timeout: 15000 });

      const tioMetrics = await page.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('[data-testid^="tap-cell-"]'));
        const cell0 = document.querySelector('[data-testid="tap-cell-0"]');
        const c0Rect = cell0 ? cell0.getBoundingClientRect() : null;
        const grid = cell0 ? cell0.parentElement : null;
        const gRect = grid ? grid.getBoundingClientRect() : null;

        return {
          totalCells: cells.length,
          gridWidth: gRect ? Math.round(gRect.width) : 0,
          cellWidth: c0Rect ? Math.round(c0Rect.width) : 0,
          cellHeight: c0Rect ? Math.round(c0Rect.height) : 0,
          isSquare: c0Rect ? Math.abs(c0Rect.width - c0Rect.height) <= 2 : false,
        };
      });

      assert.strictEqual(tioMetrics.totalCells, 16, 'Tap In Order must render all 16 default cells');
      assert(tioMetrics.gridWidth <= 420, `Grid width (${tioMetrics.gridWidth}) should be <= 420px on desktop`);
      assert(tioMetrics.isSquare, 'Cells must have square geometry');

      // Tap cell 0
      await clickElement(page, '[data-testid="tap-cell-0"]');
      await reportCheckpoint(page, '/game/tap_in_order', vp.name, 'Playable 16-Cell Grid', tioMetrics);
    }

    // =========================================================================
    // 7. IMPOSTER RESPONSIVE TESTS
    // =========================================================================
    console.log(`\n--- 7. Imposter ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/game/imposter/setup?mode=singleDevice`, { waitUntil: 'networkidle0' });
      await clickElement(page, '[data-testid="setup-start-button"]');
      await dismissHintsIfPresent(page);

      // Loop through player role handoffs
      let handoffCount = 0;
      while (true) {
        const readyBtn = await page.$('[data-testid="game-ready-button"]');
        if (readyBtn) {
          handoffCount++;
          await clickElement(page, '[data-testid="game-ready-button"]');
          await page.waitForSelector('[data-testid="imposter-got-it-button"]', { timeout: 8000 });
          await clickElement(page, '[data-testid="imposter-got-it-button"]');
        } else {
          break;
        }
      }
      assert(handoffCount >= 2, 'Imposter must cycle through at least 2 player role reveals');

      // Everyone seen role screen
      await page.waitForSelector('[data-testid="imposter-start-discussion-button"]', { timeout: 15000 });
      await reportCheckpoint(page, '/game/imposter', vp.name, 'Discussion Handoff Complete', { playersRevealed: handoffCount });

      // Start discussion
      await clickElement(page, '[data-testid="imposter-start-discussion-button"]');
      await page.waitForSelector('[data-testid="imposter-skip-to-voting-button"]', { timeout: 15000 });
      await reportCheckpoint(page, '/game/imposter', vp.name, 'Active Discussion Timer');

      // Skip to voting
      await clickElement(page, '[data-testid="imposter-skip-to-voting-button"]');

      // Cast votes
      while (true) {
        await page.waitForSelector('[data-testid^="imposter-suspect-"]', { timeout: 8000 });
        await clickElement(page, '[data-testid^="imposter-suspect-"]');
        await clickElement(page, '[data-testid="imposter-confirm-vote-button"]');
        const isResults = await page.$('[data-testid="imposter-continue-button"]');
        if (isResults) break;
      }
      await reportCheckpoint(page, '/game/imposter', vp.name, 'Voting & Game Results Screen');
    }

    // =========================================================================
    // 8. MEMORY PATH RESPONSIVE TESTS
    // =========================================================================
    console.log(`\n--- 8. Memory Path ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/game/memory_path/setup?mode=singleDevice`, { waitUntil: 'networkidle0' });
      await clickElement(page, '[data-testid="setup-start-button"]');
      await dismissHintsIfPresent(page);

      // Start board
      await clickElement(page, '[data-testid="game-ready-button"]');
      await page.waitForSelector('[data-testid="path-tile-0-0"]', { timeout: 15000 });

      const mpMetrics = await page.evaluate(() => {
        const tiles = Array.from(document.querySelectorAll('[data-testid^="path-tile-"]'));
        const t0 = document.querySelector('[data-testid="path-tile-0-0"]');
        const tRect = t0 ? t0.getBoundingClientRect() : null;

        return {
          totalTiles: tiles.length,
          tileWidth: tRect ? Math.round(tRect.width) : 0,
          tileHeight: tRect ? Math.round(tRect.height) : 0,
          isSquare: tRect ? Math.abs(tRect.width - tRect.height) <= 2 : false,
        };
      });

      assert.strictEqual(mpMetrics.totalTiles, 25, 'Memory Path must render all 25 default tiles (5x5 grid)');
      assert(mpMetrics.tileWidth > 20 && mpMetrics.tileWidth <= 80, `Tile width (${mpMetrics.tileWidth}) should be bounded <= 80px`);
      assert(mpMetrics.isSquare, 'Tiles must have square geometry');

      // Tap path tile
      await clickElement(page, '[data-testid="path-tile-0-0"]');
      await reportCheckpoint(page, '/game/memory_path', vp.name, 'Playable 25-Tile Grid', mpMetrics);
    }

    console.log(`\n========================================================================`);
    console.log(`ALL 8 SUITES COMPLETED WITH ZERO DEFECTS ACROSS MOBILE & DESKTOP!`);
    console.log(`========================================================================\n`);

  } finally {
    await browser.close();
    if (localServer) {
      localServer.close();
      console.log('Local test server stopped.');
    }
  }
}

runTests().catch(err => {
  console.error('\nTEST SUITE FAILED:', err);
  if (localServer) localServer.close();
  process.exit(1);
});