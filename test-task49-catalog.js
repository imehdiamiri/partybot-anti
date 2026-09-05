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

const ALL_16_GAMES = [
  'reverse_singing',
  'guess_the_seconds',
  'imposter',
  'memory_grid',
  'reaction_time',
  'eye_sight',
  'drum_challenge',
  'color_match',
  'sound_match',
  'ten_tangle',
  'memory_path',
  'pass_guess',
  'tap_in_order',
  'color_trap',
  'draw_rush',
  'spin_bottle'
];

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

async function runTests() {
  console.log(`========================================================================`);
  console.log(`TASK 49 CATALOG, GAME CARDS, DETAIL & SETUP VERIFICATION`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Target Viewports: Mobile (390x844), Desktop (1440x900), Dynamic Resize`);
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
    // 1. ROOT / AND /PLAY AUDIT & NAVIGATION CONTROLS
    // =========================================================================
    console.log(`\n--- 1. Root / and /play Catalog Route Audit ---`);
    for (const testUrl of [`${baseUrl}`, `${baseUrl}/play`]) {
      for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
        await page.setViewport({ width: vp.w, height: vp.h });
        await page.goto(testUrl, { waitUntil: 'networkidle0' });

        // Verify key layout elements
        const logo = await getElementRect(page, '[data-testid="home-logo-img"]');
        assert(logo && logo.visible, `Logo must be visible on ${testUrl} (${vp.name})`);

        const profileBtn = await getElementRect(page, '[data-testid="home-profile-btn"]');
        assert(profileBtn && profileBtn.visible, `Profile button must be visible on ${testUrl} (${vp.name})`);

        const gamesTab = await getElementRect(page, '[data-testid="tab-library-games"]');
        const ideasTab = await getElementRect(page, '[data-testid="tab-library-ideas"]');
        assert(gamesTab && gamesTab.visible, `Games tab button must be visible`);
        assert(ideasTab && ideasTab.visible, `Ideas tab button must be visible`);

        const bottomTabBar = await getElementRect(page, '[data-testid="bottom-tab-bar"]');
        assert(bottomTabBar && bottomTabBar.visible, `Bottom tab bar must be visible`);

        // Check for Factory/AI / Room Join absence on web
        const hasJoinBtn = await page.$('[data-testid="home-join-btn"]');
        assert.strictEqual(hasJoinBtn, null, `Join Room button must NOT be rendered on web`);

        const hasFactoryTab = await page.evaluate(() => {
          const text = document.body.innerText;
          return text.includes('AI Generate') || text.includes('Create Game with AI');
        });
        assert.strictEqual(hasFactoryTab, false, `AI/Factory generation controls must NOT be rendered on web`);

        await reportCheckpoint(page, testUrl, vp.name, 'Catalog Root Verified Clean', { logo, profileBtn });
      }
    }

    // =========================================================================
    // 2. IDEAS TAB VERIFICATION
    // =========================================================================
    console.log(`\n--- 2. Ideas Tab Static Content Audit ---`);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });
    await clickVisibleElement(page, '[data-testid="tab-library-ideas"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 400)));

    const ideasTitle = await page.evaluate(() => {
      const el = document.body;
      return el ? el.innerText.includes('Party Game Ideas') : false;
    });
    assert.strictEqual(ideasTitle, true, `Ideas tab must display 'Party Game Ideas' static collection`);
    await reportCheckpoint(page, '/', 'Desktop (1440x900)', 'Ideas Tab Rendered');

    // Switch back to Games tab
    await clickVisibleElement(page, '[data-testid="tab-library-games"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 400)));

    // =========================================================================
    // 3. 16 GAME CARDS RENDERING & RESPONSIVE GRID
    // =========================================================================
    console.log(`\n--- 3. 16 Game Cards Grid Geometry & In-Place Resize ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });

      // Verify all 16 game cards exist and have non-zero dimensions
      const cardCounts = await page.evaluate((expectedGames) => {
        const found = [];
        for (const gId of expectedGames) {
          const card = document.querySelector(`[data-testid="game-card-${gId}"]`);
          if (card) {
            const r = card.getBoundingClientRect();
            found.push({ id: gId, width: Math.round(r.width), height: Math.round(r.height) });
          }
        }
        return found;
      }, ALL_16_GAMES);

      assert.strictEqual(cardCounts.length, 16, `All 16 game cards must be rendered in grid (found ${cardCounts.length})`);
      const sampleCard = cardCounts[0];

      if (vp.w >= 1000) {
        // Desktop 4-column layout
        assert(sampleCard.width >= 200 && sampleCard.width <= 320, `Desktop card width should be ~260-280px (got ${sampleCard.width}px)`);
      } else {
        // Mobile 2-column layout
        assert(sampleCard.width >= 150 && sampleCard.width <= 200, `Mobile card width should be ~165-180px (got ${sampleCard.width}px)`);
      }

      await reportCheckpoint(page, '/', vp.name, 'All 16 Game Cards Grid Measured', {
        cardsCount: cardCounts.length,
        sampleCardWidth: sampleCard.width,
        sampleCardHeight: sampleCard.height
      });

      // In-place dynamic resize (390 -> 1440)
      if (vp.w === 390) {
        await page.setViewport({ width: 1440, height: 900 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 400)));

        const resizedCards = await page.evaluate((expectedGames) => {
          const first = document.querySelector(`[data-testid="game-card-${expectedGames[0]}"]`);
          const r = first ? first.getBoundingClientRect() : null;
          return r ? { width: Math.round(r.width), height: Math.round(r.height) } : null;
        }, ALL_16_GAMES);

        assert(resizedCards && resizedCards.width >= 200 && resizedCards.width <= 320, `Resized desktop card width must be ~200-320px (got ${resizedCards?.width}px)`);
        await reportCheckpoint(page, '/', 'In-Place Resized (1440x900)', 'Catalog Grid Reflowed Bounded', { resizedCards });
      }
    }

    // =========================================================================
    // 4. ALL 16 GAME CARD CLICKS & DETAIL BACK NAVIGATION
    // =========================================================================
    console.log(`\n--- 4. All 16 Game Card Clicks & Detail Navigation Flow ---`);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });

    for (const gameId of ALL_16_GAMES) {
      // Click card
      await clickVisibleElement(page, `[data-testid="game-card-touch-${gameId}"]`);
      await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

      // Assert pathname
      assert(page.url().includes(`/game/${gameId}`), `Card click must navigate to /game/${gameId} (got ${page.url()})`);

      // Verify hero image, mode card, instructions
      const heroRect = await getElementRect(page, '[data-testid="game-detail-hero"]');
      const heroImgRect = await getElementRect(page, '[data-testid="game-detail-hero-img"]');
      assert(heroRect && heroRect.visible, `Game ${gameId} must render hero container`);
      assert(heroImgRect && heroImgRect.visible, `Game ${gameId} must render hero image`);
      assert(heroRect.width <= 720, `Hero container must be bounded <= 720px (got ${heroRect.width}px)`);

      // Verify single web mode (1-Phone Pass & Play) and absence of multi-phone
      const singleDeviceMode = await getElementRect(page, '[data-testid="game-detail-mode-singleDevice"]');
      assert(singleDeviceMode && singleDeviceMode.visible, `1-Phone mode card must be visible on detail page for ${gameId}`);
      const multiDeviceMode = await page.$('[data-testid="game-detail-mode-multiDevice"]');
      assert.strictEqual(multiDeviceMode, null, `Multi-Phone mode must NOT be rendered on web for ${gameId}`);

      // Click Back to return to catalog
      await clickVisibleElement(page, '[data-testid="game-detail-back-btn"]');
      await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
      assert(!page.url().includes('/game/'), `Back button must return to Games catalog (got ${page.url()})`);
    }

    await reportCheckpoint(page, '/', 'Desktop (1440x900)', 'All 16 Game Card Navigations & Detail Pages Verified');

    // =========================================================================
    // 5. REPRESENTATIVE HERO BOUNDS & GEOMETRY (Mobile & Desktop)
    // =========================================================================
    console.log(`\n--- 5. Representative Hero Bounds & Geometry Audit ---`);
    const REPRESENTATIVE_GAMES = ['memory_grid', 'reverse_singing', 'imposter', 'draw_rush', 'sound_match'];
    const representativeHeroBounds = {};

    for (const gId of REPRESENTATIVE_GAMES) {
      representativeHeroBounds[gId] = {};
      for (const vp of [{ name: 'Desktop', w: 1440, h: 900 }, { name: 'Mobile', w: 390, h: 844 }]) {
        await page.setViewport({ width: vp.w, height: vp.h });
        await page.goto(`${baseUrl}/game/${gId}`, { waitUntil: 'networkidle0' });

        const heroRect = await getElementRect(page, '[data-testid="game-detail-hero"]');
        const heroImgRect = await getElementRect(page, '[data-testid="game-detail-hero-img"]');
        assert(heroRect && heroRect.visible, `Hero container visible for ${gId} (${vp.name})`);
        assert(heroImgRect && heroImgRect.visible, `Hero image visible for ${gId} (${vp.name})`);

        if (vp.w >= 1000) {
          assert(heroRect.width <= 720, `Desktop hero container bounded <= 720px (got ${heroRect.width}px)`);
        } else {
          assert(heroRect.width <= 390, `Mobile hero container fits phone width (got ${heroRect.width}px)`);
        }

        representativeHeroBounds[gId][vp.name] = {
          container: `${heroRect.width}x${heroRect.height}`,
          image: `${heroImgRect.width}x${heroImgRect.height}`,
          x: heroRect.x,
        };

        await reportCheckpoint(page, `/game/${gId}`, vp.name, 'Representative Hero Bounds Measured', {
          heroContainer: representativeHeroBounds[gId][vp.name].container,
          heroImg: representativeHeroBounds[gId][vp.name].image,
        });
      }
    }

    // =========================================================================
    // 6. 5 REPRESENTATIVE DETAIL-TO-SETUP TRANSITIONS
    // =========================================================================
    console.log(`\n--- 6. Representative Detail-to-Setup Transitions & Controls ---`);
    for (const gId of REPRESENTATIVE_GAMES) {
      await page.setViewport({ width: 1440, height: 900 });
      await page.goto(`${baseUrl}/game/${gId}`, { waitUntil: 'networkidle0' });

      // Click 1-Phone mode card to enter setup
      await clickVisibleElement(page, '[data-testid="game-detail-mode-singleDevice"]');
      await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

      assert(page.url().includes(`/game/${gId}/setup`), `Clicking 1-Phone mode must navigate to setup for ${gId} (got ${page.url()})`);

      // Verify Back button and Start button exist and are bounded
      const backBtn = await getElementRect(page, '[data-testid="setup-back-btn"]');
      const startBtn = await getElementRect(page, '[data-testid="setup-start-button"]');
      assert(backBtn && backBtn.visible, `Setup Back button must be visible for ${gId}`);
      assert(startBtn && startBtn.visible, `Setup Start button must be visible for ${gId}`);
      assert(startBtn.width <= 700, `Setup Start button bounded <= 700px (got ${startBtn.width}px)`);

      await reportCheckpoint(page, `/game/${gId}/setup`, 'Desktop (1440x900)', 'Setup Controls Rendered Bounded', {
        startBtnWidth: startBtn.width,
      });

      // Click Back button to return to detail page
      await clickVisibleElement(page, '[data-testid="setup-back-btn"]');
      await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
      assert(page.url().includes(`/game/${gId}`) && !page.url().includes('setup'), `Setup Back must return to detail page for ${gId} (got ${page.url()})`);
    }

    // =========================================================================
    // 7. DIRECT DEEP LINK BACK BEHAVIOR
    // =========================================================================
    console.log(`\n--- 7. Direct Deep Link Back Navigation Audit ---`);
    // Direct link to detail
    await page.goto(`${baseUrl}/game/memory_grid`, { waitUntil: 'networkidle0' });
    await clickVisibleElement(page, '[data-testid="game-detail-back-btn"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
    assert(!page.url().includes('/game/'), `Direct detail deep link back must return to Games catalog (got ${page.url()})`);
    await reportCheckpoint(page, '/game/memory_grid', 'Desktop (1440x900)', 'Direct Detail Deep Link Back Returned to Catalog');

    // Direct link to setup
    await page.goto(`${baseUrl}/game/memory_grid/setup?mode=singleDevice`, { waitUntil: 'networkidle0' });
    await clickVisibleElement(page, '[data-testid="setup-back-btn"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
    assert(page.url().includes('/game/memory_grid') && !page.url().includes('setup'), `Direct setup deep link back must return to detail page (got ${page.url()})`);
    await reportCheckpoint(page, '/game/memory_grid/setup', 'Desktop (1440x900)', 'Direct Setup Deep Link Back Returned to Detail');

    console.log(`\n========================================================================`);
    console.log(`ALL CATALOG, CARD, DETAIL & SETUP SUITES PASSED WITH ZERO DEFECTS!`);
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
