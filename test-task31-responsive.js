const puppeteer = require('./expo/node_modules/puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Simple static file server serving website/public
const publicDir = path.join(__dirname, 'website', 'public');
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  let filePath = path.join(publicDir, reqPath);
  
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(publicDir, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end(`Server Error: ${err.code}`);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

async function getFirstRowCardCount(page) {
  await page.waitForSelector('[data-testid="game-card"]', { timeout: 10000 });
  const cards = await page.$$('[data-testid="game-card"]');
  assert(cards.length > 0, 'No game cards found rendered with data-testid="game-card"');
  
  const boxes = [];
  for (const card of cards) {
    const box = await card.boundingBox();
    if (box) boxes.push(box);
  }
  assert(boxes.length > 0, 'Could not obtain bounding boxes for game cards');

  const firstRowTop = boxes[0].y;
  const firstRowCards = boxes.filter(b => Math.abs(b.y - firstRowTop) < 15);
  return {
    totalCards: boxes.length,
    firstRowCount: firstRowCards.length,
    firstRowWidths: firstRowCards.map(b => Math.round(b.width)),
    firstRowYPositions: firstRowCards.map(b => Math.round(b.y)),
  };
}

async function runTests() {
  await new Promise((resolve) => server.listen(8099, resolve));
  console.log('Local test server running at http://localhost:8099');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore non-fatal audio deprecation warnings or minified hydration notices
        if (!text.includes('expo-av') && !text.includes('Minified React error #418')) {
          errors.push(text);
        }
      }
    });

    console.log('\n--- 1. Testing Mobile Viewport (390x844) ---');
    await page.setViewport({ width: 390, height: 844 });
    await page.goto('http://localhost:8099', { waitUntil: 'networkidle0' });
    await page.waitForSelector('text/Games', { timeout: 10000 });

    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log('Mobile horizontal overflow exists:', mobileOverflow);
    assert.strictEqual(mobileOverflow, false, 'Mobile viewport (390px) must have zero horizontal overflow');

    const mobileGridInfo = await getFirstRowCardCount(page);
    console.log('Mobile first row cards:', mobileGridInfo);
    assert.strictEqual(
      mobileGridInfo.firstRowCount, 
      2, 
      `Mobile viewport (390px) must render exactly 2 columns in row 1, found ${mobileGridInfo.firstRowCount}`
    );

    const tabText = await page.evaluate(() => document.body.innerText);
    assert(tabText.includes('Games'), 'Mobile navigation must show Games tab');
    assert(tabText.includes('Tools'), 'Mobile navigation must show Tools tab');
    assert(tabText.includes('Friends'), 'Mobile navigation must show Friends tab');
    console.log('Mobile bottom navigation tabs: PASS (Games, Tools, Friends all visible)');

    const joinButtonPresent = await page.evaluate(() => {
      const textNodes = Array.from(document.querySelectorAll('*')).map(e => e.textContent);
      return textNodes.some(t => t === 'Join');
    });
    console.log('Join button present in header:', joinButtonPresent);
    assert.strictEqual(joinButtonPresent, false, 'Join button must be hidden on web');

    console.log('\n--- 2. Testing Tablet Viewport (768x1024) ---');
    await page.setViewport({ width: 768, height: 1024 });
    await page.goto('http://localhost:8099', { waitUntil: 'networkidle0' });
    await page.waitForSelector('text/Games', { timeout: 10000 });
    
    const tabletOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log('Tablet horizontal overflow exists:', tabletOverflow);
    assert.strictEqual(tabletOverflow, false, 'Tablet viewport (768px) must have zero horizontal overflow');

    const tabletGridInfo = await getFirstRowCardCount(page);
    console.log('Tablet first row cards:', tabletGridInfo);
    assert.strictEqual(
      tabletGridInfo.firstRowCount, 
      3, 
      `Tablet viewport (768px) must render exactly 3 columns in row 1, found ${tabletGridInfo.firstRowCount}`
    );

    console.log('\n--- 3. Testing Desktop Viewport (1440x900) ---');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:8099', { waitUntil: 'networkidle0' });
    await page.waitForSelector('text/Games', { timeout: 10000 });

    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log('Desktop horizontal overflow exists:', desktopOverflow);
    assert.strictEqual(desktopOverflow, false, 'Desktop viewport (1440px) must have zero horizontal overflow');

    const desktopGridInfo = await getFirstRowCardCount(page);
    console.log('Desktop first row cards:', desktopGridInfo);
    assert.strictEqual(
      desktopGridInfo.firstRowCount, 
      4, 
      `Desktop viewport (1440px) must render exactly 4 columns in row 1, found ${desktopGridInfo.firstRowCount}`
    );

    const fakeChassis = await page.evaluate(() => {
      return !!document.querySelector('[data-testid="dynamic-island"]') || document.body.innerText.includes('📲 Get Full App');
    });
    console.log('Fake iPhone chassis / Get Full App button present:', fakeChassis);
    assert.strictEqual(fakeChassis, false, 'Desktop must not show fake iPhone chassis or Get Full App modal UI');

    console.log('\n--- 4. Testing Game Detail Page & Local-only Mode ---');
    await page.goto('http://localhost:8099/game/reverse_singing', { waitUntil: 'networkidle0' });
    await page.waitForSelector('text/Reverse Singing', { timeout: 10000 });
    const detailText = await page.evaluate(() => document.body.innerText);
    assert(detailText.includes('Reverse Singing'), 'Game detail page must render game title');
    assert(!detailText.includes('Multi Phone') && !detailText.includes('Team Mode'), 'Game detail page must not render multiplayer/team mode cards on web');
    assert(
      detailText.includes('1-Phone') || detailText.includes('Play Local') || detailText.includes('Single Device') || detailText.includes('Choose a Mode'),
      'Game detail page must present local mode on web'
    );

    // Check hero image bounds on desktop (1440x900)
    const heroInfo = await page.evaluate(() => {
      const img = document.querySelector('img[src*="reverse-singing"]') || document.querySelector('img');
      if (!img) return null;
      const rect = img.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        aspectRatio: rect.width / (rect.height || 1),
      };
    });
    console.log('Hero image on desktop 1440px:', heroInfo);
    assert(heroInfo !== null, 'Hero image should be present');
    assert(heroInfo.width <= 720, `Hero image width should be capped on desktop, got ${heroInfo.width}`);
    assert(Math.abs(heroInfo.aspectRatio - 1.5) < 0.15, `Hero aspect ratio should match ~1.5 (3:2), got ${heroInfo.aspectRatio}`);

    // Test Setup screen CTA bounding
    await page.goto('http://localhost:8099/game/memory_grid/setup?mode=singleDevice', { waitUntil: 'networkidle0' });
    await page.waitForSelector('text/Start Game', { timeout: 10000 });
    const setupBtnInfo = await page.evaluate(() => {
      const startBtn = document.querySelector('[data-testid="setup-start-button"]') || 
                       document.querySelector('[role="button"]') ||
                       Array.from(document.querySelectorAll('*')).find(b => b.getAttribute('role') === 'button' && b.textContent && b.textContent.includes('Start Game'));
      if (!startBtn) return null;
      const rect = startBtn.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        x: Math.round(rect.left),
        right: Math.round(rect.right),
      };
    });
    console.log('Setup Start Game button on desktop 1440px:', setupBtnInfo);
    assert(setupBtnInfo !== null, 'Start Game button should be found');
    assert(setupBtnInfo.width <= 680, `Start Game button should be capped (<=680px) on desktop, got ${setupBtnInfo.width}`);
    const viewportWidth = 1440;
    const expectedCenterMargin = (viewportWidth - setupBtnInfo.width) / 2;
    assert(Math.abs(setupBtnInfo.x - expectedCenterMargin) < 30, `Start Game button should be horizontally centered on desktop`);
    console.log('Game detail & setup CTA bounds: PASS');

    console.log('\n--- 5. Testing Setup-to-Gameplay Flow with Shell Scroll Clamping (Memory Grid) ---');
    const gameplayViewports = [
      { width: 390, height: 844, name: 'Mobile (390x844)' },
      { width: 768, height: 1024, name: 'Tablet (768x1024)' },
      { width: 1440, height: 900, name: 'Desktop (1440x900)' },
    ];

    for (const vp of gameplayViewports) {
      console.log(`\nTesting active gameplay at ${vp.name}...`);
      await page.setViewport({ width: vp.width, height: vp.height });

      await page.goto('http://localhost:8099/game/memory_grid/setup?mode=singleDevice', { waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-testid="setup-start-button"]', { timeout: 10000 });

      // Deliberately scroll setup content
      await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*'));
        for (const el of all) {
          if (el.scrollHeight > el.clientHeight + 10) {
            el.scrollTop = 350;
          }
        }
        window.scrollTo(0, 350);
        document.documentElement.scrollTop = 350;
        document.body.scrollTop = 350;
      });

      const startBtn = await page.$('[data-testid="setup-start-button"]');
      assert(startBtn, 'Start Game button must exist');
      await startBtn.click();

      // Dismiss hint overlay if present
      await new Promise(r => setTimeout(r, 600));
      const hintBtn = await page.$('text/Got it');
      if (hintBtn) {
        await hintBtn.click();
        await new Promise(r => setTimeout(r, 600));
      }

      await page.waitForSelector('text/Memory Grid', { timeout: 10000 });

      // Wait for and click the real handoff ready button
      await page.waitForSelector('[data-testid="game-ready-button"]', { timeout: 10000 });
      const readyBtn = await page.$('[data-testid="game-ready-button"]');
      assert(readyBtn, 'Ready button with testID="game-ready-button" must exist');
      await readyBtn.click();
      await new Promise(r => setTimeout(r, 800));

      // Wait for hidden tiles to appear
      await page.waitForSelector('[aria-label^="Hidden tile"]', { timeout: 10000 });

      // Check root scroll offsets and assert active scroll clamp
      const scrollState = await page.evaluate(() => {
        const root = document.getElementById('root');
        return {
          windowScrollY: window.scrollY,
          docScrollTop: document.documentElement.scrollTop,
          bodyScrollTop: document.body.scrollTop,
          rootScrollTop: root ? root.scrollTop : 0,
        };
      });
      console.log(`Scroll state after entering gameplay at ${vp.name}:`, scrollState);
      assert.strictEqual(scrollState.windowScrollY, 0, 'window.scrollY must be strictly 0');
      assert.strictEqual(scrollState.docScrollTop, 0, 'document.documentElement.scrollTop must be strictly 0');
      assert.strictEqual(scrollState.bodyScrollTop, 0, 'document.body.scrollTop must be strictly 0');
      assert.strictEqual(scrollState.rootScrollTop, 0, '#root.scrollTop must be strictly 0');

      // Test scroll clamp resilience: attempt to set root / window scroll
      await page.evaluate(() => {
        window.scrollTo(0, 350);
        const root = document.getElementById('root');
        if (root) root.scrollTop = 350;
      });
      const clampedState = await page.evaluate(() => {
        const root = document.getElementById('root');
        return {
          windowScrollY: window.scrollY,
          rootScrollTop: root ? root.scrollTop : 0,
        };
      });
      console.log(`Scroll state after clamp test at ${vp.name}:`, clampedState);
      assert.strictEqual(clampedState.windowScrollY, 0, 'window.scrollY must be clamped to 0');
      assert.strictEqual(clampedState.rootScrollTop, 0, '#root.scrollTop must be clamped to 0');

      const metrics = await page.evaluate((vpHeight, vpWidth) => {
        const tiles = Array.from(document.querySelectorAll('[aria-label^="Hidden tile"]')).map(t => {
          const r = t.getBoundingClientRect();
          return {
            ariaLabel: t.getAttribute('aria-label'),
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            left: Math.round(r.left),
            right: Math.round(r.right),
            width: Math.round(r.width),
            height: Math.round(r.height),
          };
        });

        const header = Array.from(document.querySelectorAll('*')).find(el => el.textContent && el.textContent.includes('Exit') && el.textContent.includes('Memory Grid') && el.getBoundingClientRect().height > 20);
        const headerRect = header ? header.getBoundingClientRect() : null;
        const overflow = document.documentElement.scrollWidth > vpWidth || document.body.scrollWidth > vpWidth;

        return {
          tilesCount: tiles.length,
          tilesMinTop: tiles.length ? Math.min(...tiles.map(t => t.top)) : null,
          tilesMaxBottom: tiles.length ? Math.max(...tiles.map(t => t.bottom)) : null,
          headerTop: headerRect ? Math.round(headerRect.top) : null,
          tilesSquare: tiles.every(t => Math.abs(t.width - t.height) <= 3),
          horizontalOverflow: overflow,
        };
      }, vp.height, vp.width);

      console.log(`Viewport ${vp.name} metrics:`, metrics);
      assert.strictEqual(metrics.tilesCount, 12, 'Default Memory Grid must render exactly 12 tiles (3x4)');
      assert(metrics.tilesMinTop !== null && metrics.tilesMinTop >= 0, `Tiles min top must be >= 0, got ${metrics.tilesMinTop}`);
      assert(metrics.tilesMaxBottom !== null && metrics.tilesMaxBottom <= vp.height, `Tiles max bottom must fit within viewport (${vp.height}px), got ${metrics.tilesMaxBottom}`);
      assert.strictEqual(metrics.tilesSquare, true, 'Tiles must have square dimensions');
      assert.strictEqual(metrics.horizontalOverflow, false, 'No horizontal overflow allowed in session');
      if (metrics.headerTop !== null) {
        assert(metrics.headerTop >= 0, `Session header top must be >= 0, got ${metrics.headerTop}`);
      }
    }
    console.log('Setup-to-gameplay Memory Grid flow: PASS across all 3 viewports');

    console.log('\n--- 6. Testing Sound Match Desktop & Mobile Flow (1440x900 & 390x844) ---');
    const soundMatchViewports = [
      { width: 1440, height: 900, name: 'Desktop (1440x900)' },
      { width: 390, height: 844, name: 'Mobile (390x844)' },
    ];

    for (const vp of soundMatchViewports) {
      console.log(`\nTesting Sound Match flow at ${vp.name}...`);
      await page.setViewport({ width: vp.width, height: vp.height });

      await page.goto('http://localhost:8099/game/sound_match/setup?mode=singleDevice', { waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-testid="setup-start-button"]', { timeout: 10000 });

      const startBtn = await page.$('[data-testid="setup-start-button"]');
      assert(startBtn, 'Start Game button must exist in Sound Match setup');
      await startBtn.click();

      // Dismiss hint overlay if present
      await new Promise(r => setTimeout(r, 600));
      const hintBtn = await page.$('text/Got it');
      if (hintBtn) {
        await hintBtn.click();
        await new Promise(r => setTimeout(r, 600));
      }

      // Handoff screen
      await page.waitForSelector('[data-testid="game-ready-button"]', { timeout: 10000 });
      const readyBtn = await page.$('[data-testid="game-ready-button"]');
      assert(readyBtn, 'Ready button in handoff must exist');
      await readyBtn.click();
      await new Promise(r => setTimeout(r, 800));

      // Memorize phase (Target Tone screen)
      await page.waitForSelector('[data-testid="sound-match-target-card"]', { timeout: 10000 });
      const memorizeMetrics = await page.evaluate((vpWidth) => {
        const card = document.querySelector('[data-testid="sound-match-target-card"]');
        const readyMatchBtn = document.querySelector('[data-testid="sound-match-ready-button"]');
        const cardRect = card ? card.getBoundingClientRect() : null;
        const btnRect = readyMatchBtn ? readyMatchBtn.getBoundingClientRect() : null;
        const root = document.getElementById('root');

        return {
          cardWidth: cardRect ? Math.round(cardRect.width) : null,
          cardLeft: cardRect ? Math.round(cardRect.left) : null,
          cardRight: cardRect ? Math.round(cardRect.right) : null,
          btnWidth: btnRect ? Math.round(btnRect.width) : null,
          btnLeft: btnRect ? Math.round(btnRect.left) : null,
          windowScrollY: window.scrollY,
          rootScrollTop: root ? root.scrollTop : 0,
        };
      }, vp.width);

      console.log(`Sound Match memorize phase at ${vp.name}:`, memorizeMetrics);
      assert(memorizeMetrics.cardWidth !== null, 'Target Tone card must be rendered');
      assert(memorizeMetrics.cardWidth <= 680, `Target Tone card width must be <= 680px, got ${memorizeMetrics.cardWidth}`);
      assert(memorizeMetrics.btnWidth <= 480, `Ready to match button must be <= 480px, got ${memorizeMetrics.btnWidth}`);
      assert.strictEqual(memorizeMetrics.windowScrollY, 0, 'window.scrollY must be 0 in memorize phase');
      assert.strictEqual(memorizeMetrics.rootScrollTop, 0, 'root.scrollTop must be 0 in memorize phase');

      if (vp.width === 1440) {
        const expectedCenter = (1440 - memorizeMetrics.cardWidth) / 2;
        assert(Math.abs(memorizeMetrics.cardLeft - expectedCenter) < 30, 'Target Tone card must be centered on desktop');
      }

      // Click "I'm Ready to Match"
      const readyMatchBtn = await page.$('[data-testid="sound-match-ready-button"]');
      assert(readyMatchBtn, 'Ready to match button must exist');
      await readyMatchBtn.click();
      await new Promise(r => setTimeout(r, 800));

      // Recreate phase
      await page.waitForSelector('[data-testid="sound-match-recreate-stage"]', { timeout: 10000 });
      const recreateMetrics = await page.evaluate((vpWidth, vpHeight) => {
        const stage = document.querySelector('[data-testid="sound-match-recreate-stage"]');
        const slider = document.querySelector('[data-testid="sound-match-slider-track"]');
        const circle = document.querySelector('[data-testid="sound-match-freq-circle"]');
        const submitBtn = document.querySelector('[data-testid="sound-match-submit-button"]');

        const stageRect = stage ? stage.getBoundingClientRect() : null;
        const sliderRect = slider ? slider.getBoundingClientRect() : null;
        const circleRect = circle ? circle.getBoundingClientRect() : null;
        const submitRect = submitBtn ? submitBtn.getBoundingClientRect() : null;
        const root = document.getElementById('root');
        const overflow = document.documentElement.scrollWidth > vpWidth || document.body.scrollWidth > vpWidth;

        return {
          stageWidth: stageRect ? Math.round(stageRect.width) : null,
          stageLeft: stageRect ? Math.round(stageRect.left) : null,
          sliderLeft: sliderRect ? Math.round(sliderRect.left) : null,
          sliderRight: sliderRect ? Math.round(sliderRect.right) : null,
          circleLeft: circleRect ? Math.round(circleRect.left) : null,
          circleRight: circleRect ? Math.round(circleRect.right) : null,
          submitWidth: submitRect ? Math.round(submitRect.width) : null,
          windowScrollY: window.scrollY,
          rootScrollTop: root ? root.scrollTop : 0,
          horizontalOverflow: overflow,
        };
      }, vp.width, vp.height);

      console.log(`Sound Match recreate phase at ${vp.name}:`, recreateMetrics);
      assert(recreateMetrics.stageWidth !== null, 'Recreate stage must be rendered');
      assert(recreateMetrics.stageWidth <= 760, `Recreate stage width must be <= 760px, got ${recreateMetrics.stageWidth}`);
      assert(recreateMetrics.submitWidth <= 480, `Submit button must be <= 480px, got ${recreateMetrics.submitWidth}`);
      assert.strictEqual(recreateMetrics.windowScrollY, 0, 'window.scrollY must be 0 in recreate phase');
      assert.strictEqual(recreateMetrics.rootScrollTop, 0, 'root.scrollTop must be 0 in recreate phase');
      assert.strictEqual(recreateMetrics.horizontalOverflow, false, 'No horizontal overflow in recreate phase');

      // Assert slider and circle are both inside stage bounds
      if (recreateMetrics.sliderLeft !== null && recreateMetrics.stageLeft !== null) {
        assert(recreateMetrics.sliderLeft >= recreateMetrics.stageLeft - 20, 'Slider must lie within centered stage left');
      }
      if (recreateMetrics.circleRight !== null && recreateMetrics.stageLeft !== null && recreateMetrics.stageWidth !== null) {
        const stageRight = recreateMetrics.stageLeft + recreateMetrics.stageWidth;
        assert(recreateMetrics.circleRight <= stageRight + 20, 'Circle must lie within centered stage right');
      }
    }
    console.log('Sound Match flow: PASS across desktop and mobile');

    console.log('\n--- 7. Testing Card Deck Flow at /cards/penalty (390x844, 768x1024, 1440x900) ---');
    const deckViewports = [
      { width: 390, height: 844, name: 'Mobile (390x844)' },
      { width: 768, height: 1024, name: 'Tablet (768x1024)' },
      { width: 1440, height: 900, name: 'Desktop (1440x900)' },
    ];

    for (const vp of deckViewports) {
      console.log(`\nTesting Card Deck at ${vp.name}...`);
      await page.setViewport({ width: vp.width, height: vp.height });

      await page.goto('http://localhost:8099/cards/penalty', { waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-testid="deck-next-button"]', { timeout: 10000 });

      const deckMetrics = await page.evaluate((vpWidth, vpHeight) => {
        const frontCard = document.querySelector('[data-testid="front-card"]');

        const nextBtn = document.querySelector('[data-testid="deck-next-button"]');
        const nextRect = nextBtn ? nextBtn.getBoundingClientRect() : null;
        const frontRect = frontCard ? frontCard.getBoundingClientRect() : null;
        const root = document.getElementById('root');
        const overflow = document.documentElement.scrollWidth > vpWidth || document.body.scrollWidth > vpWidth;

        // Get progress text
        const progressEl = Array.from(document.querySelectorAll('*')).find(el => /^\d+\s*\/\s*\d+$/.test(el.textContent?.trim() || ''));
        const progressText = progressEl ? progressEl.textContent.trim() : null;

        return {
          cardWidth: frontRect ? Math.round(frontRect.width) : null,
          cardHeight: frontRect ? Math.round(frontRect.height) : null,
          cardLeft: frontRect ? Math.round(frontRect.left) : null,
          cardTop: frontRect ? Math.round(frontRect.top) : null,
          cardBottom: frontRect ? Math.round(frontRect.bottom) : null,
          nextBtnWidth: nextRect ? Math.round(nextRect.width) : null,
          progressText,
          windowScrollY: window.scrollY,
          rootScrollTop: root ? root.scrollTop : 0,
          horizontalOverflow: overflow,
        };
      }, vp.width, vp.height);

      console.log(`Card Deck metrics at ${vp.name}:`, deckMetrics);
      assert(deckMetrics.cardWidth !== null, 'Front card should be found');
      assert(deckMetrics.cardWidth <= 500, `Front card width should be capped (<=500px), got ${deckMetrics.cardWidth}`);
      assert(deckMetrics.cardHeight <= vp.height - 100, `Front card height must fit inside viewport, got ${deckMetrics.cardHeight}`);
      const aspectRatio = deckMetrics.cardHeight / deckMetrics.cardWidth;
      assert(Math.abs(aspectRatio - 1.38) < 0.25, `Card must retain portrait aspect ratio (~1.38), got ${aspectRatio.toFixed(2)}`);
      assert.strictEqual(deckMetrics.windowScrollY, 0, 'window.scrollY must be 0 in card deck');
      assert.strictEqual(deckMetrics.rootScrollTop, 0, 'root.scrollTop must be 0 in card deck');
      assert.strictEqual(deckMetrics.horizontalOverflow, false, 'Zero horizontal overflow allowed');
      assert(deckMetrics.progressText !== null && deckMetrics.progressText.startsWith('1 /'), `Initial progress should be 1 / ..., got ${deckMetrics.progressText}`);

      // Click Next button and verify card advances
      const nextBtn = await page.$('[data-testid="deck-next-button"]');
      assert(nextBtn, 'Next button must exist in card deck');
      await nextBtn.click();
      await new Promise(r => setTimeout(r, 600));

      const updatedProgress = await page.evaluate(() => {
        const progressEl = Array.from(document.querySelectorAll('*')).find(el => /^\d+\s*\/\s*\d+$/.test(el.textContent?.trim() || ''));
        return progressEl ? progressEl.textContent.trim() : null;
      });
      console.log(`Updated progress after Next click at ${vp.name}:`, updatedProgress);
      assert(updatedProgress !== null && updatedProgress.startsWith('2 /'), `Progress should advance to 2 / ..., got ${updatedProgress}`);
    }
    console.log('\n--- 7B. Testing Card Deck No-Reload In-Place Resize & Pointer Drag Threshold ---');
    await page.setViewport({ width: 390, height: 844 });
    await page.goto('http://localhost:8099/cards/penalty', { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="front-card"]', { timeout: 10000 });

    const mobileCardMetrics = await page.evaluate(() => {
      const frontCard = document.querySelector('[data-testid="front-card"]');
      const r = frontCard ? frontCard.getBoundingClientRect() : null;
      return { width: r ? Math.round(r.width) : null, height: r ? Math.round(r.height) : null };
    });
    console.log('Card at mobile (390px) before resize:', mobileCardMetrics);
    assert(mobileCardMetrics.width <= 360, `Mobile card width should be <= 360px, got ${mobileCardMetrics.width}`);

    // In-place resize to Desktop without reloading the page
    console.log('Resizing in-place to Desktop (1440x900) without reload...');
    await page.setViewport({ width: 1440, height: 900 });
    await new Promise(r => setTimeout(r, 200));

    const desktopCardInfo = await page.evaluate(() => {
      const frontCard = document.querySelector('[data-testid="front-card"]');
      const r = frontCard ? frontCard.getBoundingClientRect() : null;
      const progressEl = Array.from(document.querySelectorAll('*')).find(el => /^\d+\s*\/\s*\d+$/.test(el.textContent?.trim() || ''));
      return {
        cardRect: r ? { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) } : null,
        progressText: progressEl ? progressEl.textContent.trim() : null,
      };
    });
    console.log('Card after in-place resize to 1440px:', desktopCardInfo);
    assert.strictEqual(desktopCardInfo.cardRect.width, 460, `Card width must dynamically update to desktop cap 460px, got ${desktopCardInfo.cardRect.width}`);
    assert(desktopCardInfo.progressText.startsWith('1 /'), `Initial progress must be 1 / ..., got ${desktopCardInfo.progressText}`);

    const cardEl = await page.$('[data-testid="front-card"]');
    const box = await cardEl.boundingBox();
    const cardCenterX = Math.round(box.x + box.width / 2);
    const cardCenterY = Math.round(box.y + box.height / 2);

    // Test 1: Sub-threshold drag (drag dx = -70px, which is less than desktop threshold 460 * 0.3 = 138px)
    console.log('Performing sub-threshold pointer drag (dx = -70px)...');
    await page.mouse.move(cardCenterX, cardCenterY);
    await page.mouse.down();
    await page.mouse.move(cardCenterX - 70, cardCenterY, { steps: 10 });
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 600));

    const progressAfterSubDrag = await page.evaluate(() => {
      const progressEl = Array.from(document.querySelectorAll('*')).find(el => /^\d+\s*\/\s*\d+$/.test(el.textContent?.trim() || ''));
      return progressEl ? progressEl.textContent.trim() : null;
    });
    console.log('Progress after sub-threshold drag:', progressAfterSubDrag);
    assert(progressAfterSubDrag.startsWith('1 /'), `Sub-threshold drag must snap back without advancing progress, got ${progressAfterSubDrag}`);

    await new Promise(r => setTimeout(r, 800));

    // Test 2: Over-threshold drag (drag dx = -200px, which is greater than desktop threshold 138px)
    console.log('Performing over-threshold pointer drag (dx = -200px)...');
    const freshCard = await page.$('[data-testid="front-card"]');
    const freshBox = await freshCard.boundingBox();
    const freshCenterX = Math.round(freshBox.x + freshBox.width / 2);
    const freshCenterY = Math.round(freshBox.y + freshBox.height / 2);

    await page.mouse.move(freshCenterX, freshCenterY);
    await page.mouse.down();
    await page.mouse.move(freshCenterX - 200, freshCenterY, { steps: 5 });
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 800));

    const progressAfterOverDrag = await page.evaluate(() => {
      const progressEl = Array.from(document.querySelectorAll('*')).find(el => /^\d+\s*\/\s*\d+$/.test(el.textContent?.trim() || ''));
      return progressEl ? progressEl.textContent.trim() : null;
    });
    console.log('Progress after over-threshold drag:', progressAfterOverDrag);
    assert(progressAfterOverDrag.startsWith('2 /'), `Over-threshold drag must advance progress to 2 / ..., got ${progressAfterOverDrag}`);
    console.log('In-place resize & pointer drag threshold verification: PASS');

    console.log('\n--- 7C. Testing Empty-State Card Deck (Favorites Route) ---');
    const emptyDeckViewports = [
      { width: 1440, height: 900, name: 'Desktop (1440x900)' },
      { width: 390, height: 844, name: 'Mobile (390x844)' },
    ];

    for (const vp of emptyDeckViewports) {
      console.log(`Testing empty Favorites deck at ${vp.name}...`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto('http://localhost:8099/cards/favorites', { waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-testid="cards-empty-deck"]', { timeout: 10000 });

      const emptyMetrics = await page.evaluate((vpWidth, vpHeight) => {
        const emptyEl = document.querySelector('[data-testid="cards-empty-deck"]');
        const r = emptyEl ? emptyEl.getBoundingClientRect() : null;
        const root = document.getElementById('root');
        const text = emptyEl ? emptyEl.textContent : '';
        const overflow = document.documentElement.scrollWidth > vpWidth || document.body.scrollWidth > vpWidth;

        return {
          width: r ? Math.round(r.width) : null,
          height: r ? Math.round(r.height) : null,
          left: r ? Math.round(r.left) : null,
          hasTitle: text.includes('No more cards'),
          hasShuffle: text.includes('Shuffle deck'),
          windowScrollY: window.scrollY,
          rootScrollTop: root ? root.scrollTop : 0,
          horizontalOverflow: overflow,
        };
      }, vp.width, vp.height);

      console.log(`Empty deck metrics at ${vp.name}:`, emptyMetrics);
      assert(emptyMetrics.width !== null, 'Empty deck container must exist');
      assert(emptyMetrics.width <= 500, `Empty deck width should be capped (<=500px), got ${emptyMetrics.width}`);
      assert(emptyMetrics.height <= vp.height - 100, `Empty deck height must fit in viewport, got ${emptyMetrics.height}`);
      const ratio = emptyMetrics.height / emptyMetrics.width;
      assert(Math.abs(ratio - 1.38) < 0.25, `Empty deck must retain portrait ratio ~1.38, got ${ratio.toFixed(2)}`);
      assert(emptyMetrics.hasTitle, 'Empty deck must show "No more cards"');
      assert(emptyMetrics.hasShuffle, 'Empty deck must show "Shuffle deck"');
      assert.strictEqual(emptyMetrics.windowScrollY, 0, 'window.scrollY must be 0');
      assert.strictEqual(emptyMetrics.rootScrollTop, 0, 'root.scrollTop must be 0');
      assert.strictEqual(emptyMetrics.horizontalOverflow, false, 'No horizontal overflow');
    }
    console.log('Empty-state card deck verification: PASS across desktop and mobile');

    console.log('\n--- 8. Testing Direct Multiplayer URLs Redirect ---');
    await page.goto('http://localhost:8099/lobby/join', { waitUntil: 'networkidle0' });
    let url = page.url();
    console.log('/lobby/join redirected to:', url);
    assert(url === 'http://localhost:8099/' || url === 'http://localhost:8099/(tabs)', `/lobby/join must redirect to home/tabs, got ${url}`);

    await page.goto('http://localhost:8099/lobby/ROOM99', { waitUntil: 'networkidle0' });
    url = page.url();
    console.log('/lobby/ROOM99 redirected to:', url);
    assert(url === 'http://localhost:8099/' || url === 'http://localhost:8099/(tabs)', `/lobby/ROOM99 must redirect to home/tabs, got ${url}`);

    await page.goto('http://localhost:8099/game/reaction_time/lobby/create', { waitUntil: 'networkidle0' });
    url = page.url();
    console.log('/game/reaction_time/lobby/create redirected to:', url);
    assert(url.includes('/game/reaction_time/setup?mode=singleDevice'), `/game/reaction_time/lobby/create must redirect to local setup, got ${url}`);

    console.log('\n--- 9. Console Errors Summary ---');
    console.log('Unexpected console errors count:', errors.length);
    assert.strictEqual(errors.length, 0, `Expected 0 unexpected console errors, found ${errors.length}: ${JSON.stringify(errors)}`);

    console.log('\nALL RESPONSIVE WEB REGRESSION ASSERTIONS PASSED SUCCESSFULLY!');
  } finally {
    await browser.close();
    server.close();
  }
}

runTests().catch(err => {
  console.error('TEST ASSERTION FAILURE:', err);
  process.exit(1);
});
