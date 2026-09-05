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

async function typeVisibleElement(page, selector, text, timeout = 15000) {
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
        await h.type(text, { delay: 20 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 200)));
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
  console.log(`TASK 48 TOOLS RESPONSIVE, INTERACTION & BOUNDS VERIFICATION`);
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
    // 1. TOOLS TAB NAVIGATION & CARDS (/tools)
    // =========================================================================
    console.log(`\n--- 1. Tools Tab Navigation & Card Clicking (/tools) ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/tools`, { waitUntil: 'networkidle0' });

      // Verify bottom tab bar
      const tabBarRect = await getElementRect(page, '[data-testid="bottom-tab-bar"]');
      assert(tabBarRect && tabBarRect.visible, 'Bottom tab bar must be visible');

      // Measure tool cards grid
      const toolsMetrics = await page.evaluate(() => {
        const firstCard = document.querySelector('[data-testid="tool-card-dice"]');
        const rect = firstCard ? firstCard.getBoundingClientRect() : null;
        return {
          cardWidth: rect ? Math.round(rect.width) : 0,
          cardHeight: rect ? Math.round(rect.height) : 0,
        };
      });

      if (vp.w >= 1000) {
        assert(toolsMetrics.cardWidth <= 260, `Desktop tool cards must be bounded <= 260px (got ${toolsMetrics.cardWidth}px)`);
      } else {
        assert(toolsMetrics.cardWidth <= 130, `Mobile tool cards must fit on phone <= 130px (got ${toolsMetrics.cardWidth}px)`);
      }

      await reportCheckpoint(page, '/tools', vp.name, 'Tools Tab Grid Rendered', toolsMetrics);

      // Real Card-based Navigation for all 6 tools
      for (const toolId of ['dice', 'bottle', 'hourglass', 'coin', 'teams', 'wheel']) {
        await clickVisibleElement(page, `[data-testid="tool-card-${toolId}"]`);
        await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
        const currentUrl = page.url();
        assert(currentUrl.includes(`/${toolId}`), `Clicking card ${toolId} must navigate to /${toolId} (got ${currentUrl})`);

        // Click Done to return to /tools
        await clickVisibleElement(page, '[data-testid="tool-header-back-btn"]');
        await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
        assert(page.url().includes('tools'), `Clicking Done must return to /tools (got ${page.url()})`);
      }

      // Real Profile Navigation from Tools tab
      await clickVisibleElement(page, '[data-testid="tools-profile-btn"]');
      await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
      assert(page.url().includes('/profile'), `Clicking profile button must navigate to /profile (got ${page.url()})`);
      await clickVisibleElement(page, '[data-testid="profile-done-button"]');
      await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
      assert(page.url().includes('tools'), `Returning from profile must go to /tools (got ${page.url()})`);

      // Real Category Navigation from Tools tab
      await clickVisibleElement(page, '[data-testid="cards-category-act"]');
      await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
      assert(page.url().includes('/cards/act'), `Clicking category must navigate to /cards/act (got ${page.url()})`);
      await clickVisibleElement(page, '[data-testid="cards-back-btn"]');
      await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
      assert(page.url().includes('tools'), `Returning from cards category must go to /tools (got ${page.url()})`);

      await reportCheckpoint(page, '/tools', vp.name, 'All Tools Card/Profile/Category Navigation Verified');
    }

    // =========================================================================
    // 2. DICE TOOL (/dice)
    // =========================================================================
    console.log(`\n--- 2. Dice Tool (/dice) ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/dice`, { waitUntil: 'networkidle0' });

      // Measure stage before action
      const stageBefore = await getElementRect(page, '[data-testid="dice-stage"]');
      const rollBtnBefore = await getElementRect(page, '[data-testid="dice-roll-btn"]');
      assert(stageBefore && stageBefore.visible, 'Dice stage must be visible');
      assert(rollBtnBefore && rollBtnBefore.visible, 'Dice roll button must be visible');

      // Change dice count to 2
      await clickVisibleElement(page, '[data-testid="dice-count-btn-2"]');

      // Roll
      await clickVisibleElement(page, '[data-testid="dice-roll-btn"]');
      
      // Wait for roll animation
      await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));

      const diceVal = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('[data-testid="dice-total-value"]')).find(e => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        return el ? parseInt(el.textContent.trim(), 10) : NaN;
      });
      assert(diceVal >= 2 && diceVal <= 12, `Dice total with 2 dice must be between 2 and 12 (got ${diceVal})`);

      await reportCheckpoint(page, '/dice', vp.name, 'Dice Rolled Result', { count: 2, total: diceVal, stage: stageBefore });

      // In-place dynamic resize check (390 -> 1440)
      if (vp.w === 390) {
        await page.setViewport({ width: 1440, height: 900 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
        const stageResized = await getElementRect(page, '[data-testid="dice-stage"]');
        assert(stageResized && stageResized.visible, 'Dice stage must be visible after resize');
        assert(stageResized.width <= 620, `Resized Dice stage width must be <= 620px (got ${stageResized.width}px)`);
        assert(stageResized.x >= 0 && stageResized.x + stageResized.width <= 1440, `Dice stage must be centered inside viewport (x=${stageResized.x})`);
        await reportCheckpoint(page, '/dice', 'In-Place Resized (1440x900)', 'Dice Bounded Stage Measured', { stageResized });
      }

      // Done button navigates back to /tools
      await clickVisibleElement(page, '[data-testid="tool-header-back-btn"]');
      await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
    }

    // =========================================================================
    // 3. BOTTLE TOOL (/bottle)
    // =========================================================================
    console.log(`\n--- 3. Bottle Tool (/bottle) ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/bottle`, { waitUntil: 'networkidle0' });

      // Measure bottle stage
      const stageBefore = await getElementRect(page, '[data-testid="bottle-stage"]');
      const spinBtnBefore = await getElementRect(page, '[data-testid="bottle-spin-btn"]');
      assert(stageBefore && stageBefore.visible, 'Bottle stage must be visible');
      assert(stageBefore.width <= 360 && stageBefore.height <= 360, `Bottle stage must be <= 360px (got ${stageBefore.width}x${stageBefore.height})`);
      assert(spinBtnBefore && spinBtnBefore.visible, 'Bottle spin button must be visible');

      // Add names: Alex, Sam, Taylor
      const addedNames = ['Alex', 'Sam', 'Taylor'];
      for (const name of addedNames) {
        await typeVisibleElement(page, '[data-testid="bottle-name-input"]', name);
        await clickVisibleElement(page, '[data-testid="bottle-add-name-btn"]');
      }

      // Spin bottle
      await clickVisibleElement(page, '[data-testid="bottle-spin-btn"]');
      await reportCheckpoint(page, '/bottle', vp.name, 'Bottle Spinning Action');

      // Wait for spin to complete (8.05s animation)
      await page.evaluate(() => new Promise(r => setTimeout(r, 8400)));

      // Assert factual landed result: selected turn pill must exist and contain one of the added names
      const selectedName = await page.evaluate(() => {
        const pill = Array.from(document.querySelectorAll('[data-testid="bottle-selected-pill"]')).find(e => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        return pill ? pill.textContent.trim() : null;
      });
      assert(addedNames.includes(selectedName), `Selected bottle name must be one of ${JSON.stringify(addedNames)} (got "${selectedName}")`);

      await reportCheckpoint(page, '/bottle', vp.name, 'Bottle Landed Result Verified', { selectedName, stage: stageBefore });

      // In-place dynamic resize check (390 -> 1440)
      if (vp.w === 390) {
        await page.setViewport({ width: 1440, height: 900 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
        const stageResized = await getElementRect(page, '[data-testid="bottle-stage"]');
        assert(stageResized && stageResized.visible, 'Bottle stage must be visible after resize');
        assert(stageResized.width <= 360 && stageResized.height <= 360, `Bottle stage must stay <= 360px after resize (got ${stageResized.width}x${stageResized.height})`);
        assert(Math.abs(stageResized.width - stageResized.height) <= 2, `Bottle stage must be square (got ${stageResized.width}x${stageResized.height})`);
        assert(stageResized.x >= 0 && stageResized.x + stageResized.width <= 1440, 'Bottle stage must be inside viewport');
        await reportCheckpoint(page, '/bottle', 'In-Place Resized (1440x900)', 'Bottle Stage Bounded Measured', { stageResized });
      }

      // Done button back to /tools
      await clickVisibleElement(page, '[data-testid="tool-header-back-btn"]');
      await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
    }

    // =========================================================================
    // 4. HOURGLASS TOOL (/hourglass)
    // =========================================================================
    console.log(`\n--- 4. Hourglass Tool (/hourglass) ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/hourglass`, { waitUntil: 'networkidle0' });

      // Measure stage
      const stageBefore = await getElementRect(page, '[data-testid="hourglass-stage"]');
      assert(stageBefore && stageBefore.visible, 'Hourglass stage must be visible');

      // Select 30s preset
      await clickVisibleElement(page, '[data-testid="hourglass-preset-30s"]');
      const timerInit = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('[data-testid="hourglass-timer-text"]')).find(e => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        return el ? el.textContent.trim() : '';
      });
      assert.strictEqual(timerInit, '00:30', `Initial 30s timer must show 00:30 (got ${timerInit})`);

      // Start timer
      await clickVisibleElement(page, '[data-testid="hourglass-btn-start"]');
      await reportCheckpoint(page, '/hourglass', vp.name, 'Hourglass Started Counting');

      // Wait 1.5s and check countdown
      await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));
      const timerRunning = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('[data-testid="hourglass-timer-text"]')).find(e => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        return el ? el.textContent.trim() : '';
      });
      const secondsRemaining = parseInt(timerRunning.split(':')[1], 10);
      assert(secondsRemaining <= 29, `Timer should tick down (got ${timerRunning})`);

      // Pause and Cancel
      await clickVisibleElement(page, '[data-testid="hourglass-btn-pause"]');
      await clickVisibleElement(page, '[data-testid="hourglass-btn-cancel"]');
      await reportCheckpoint(page, '/hourglass', vp.name, 'Hourglass Paused & Cancelled');

      // In-place dynamic resize check (390 -> 1440)
      if (vp.w === 390) {
        await page.setViewport({ width: 1440, height: 900 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
        const stageResized = await getElementRect(page, '[data-testid="hourglass-stage"]');
        assert(stageResized && stageResized.visible, 'Hourglass stage must be visible after resize');
        assert(stageResized.width <= 620, `Hourglass stage must be <= 620px (got ${stageResized.width}px)`);
        assert(stageResized.x >= 0 && stageResized.x + stageResized.width <= 1440, 'Hourglass stage must be centered');
        await reportCheckpoint(page, '/hourglass', 'In-Place Resized (1440x900)', 'Hourglass Stage Bounded Measured', { stageResized });
      }

      // Done button
      await clickVisibleElement(page, '[data-testid="tool-header-back-btn"]');
      await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
    }

    // =========================================================================
    // 5. COIN FLIP TOOL (/coin)
    // =========================================================================
    console.log(`\n--- 5. Coin Flip Tool (/coin) ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/coin`, { waitUntil: 'networkidle0' });

      // Measure stage
      const stageBefore = await getElementRect(page, '[data-testid="coin-stage"]');
      const flipBtnBefore = await getElementRect(page, '[data-testid="coin-flip-btn"]');
      assert(stageBefore && stageBefore.visible, 'Coin stage must be visible');
      assert(flipBtnBefore && flipBtnBefore.visible, 'Coin flip button must be visible');

      // Flip 1 coin
      await clickVisibleElement(page, '[data-testid="coin-flip-btn"]');
      await reportCheckpoint(page, '/coin', vp.name, 'Coin Flipping Animation');

      // Wait for settle (approx 3.2s)
      await page.evaluate(() => new Promise(r => setTimeout(r, 3300)));

      const resultText = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('[data-testid="coin-result-text"]')).find(e => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        return el ? el.textContent.trim() : '';
      });
      assert(resultText === 'HEADS' || resultText === 'TAILS', `Result text must be HEADS or TAILS (got ${resultText})`);

      // Verify stats updated
      const heads = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('[data-testid="coin-heads-count"]')).find(e => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        return el ? parseInt(el.textContent.trim(), 10) : 0;
      });
      const tails = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('[data-testid="coin-tails-count"]')).find(e => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        return el ? parseInt(el.textContent.trim(), 10) : 0;
      });
      assert(heads + tails >= 1, `Total flips in stats must be at least 1 (got heads=${heads}, tails=${tails})`);

      await reportCheckpoint(page, '/coin', vp.name, 'Coin Result & Stats Updated', { result: resultText, heads, tails, stage: stageBefore });

      // In-place dynamic resize check (390 -> 1440)
      if (vp.w === 390) {
        await page.setViewport({ width: 1440, height: 900 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
        const stageResized = await getElementRect(page, '[data-testid="coin-stage"]');
        assert(stageResized && stageResized.visible, 'Coin stage must be visible after resize');
        assert(stageResized.width <= 620, `Coin stage must be <= 620px (got ${stageResized.width}px)`);
        assert(stageResized.x >= 0 && stageResized.x + stageResized.width <= 1440, 'Coin stage must be centered');
        await reportCheckpoint(page, '/coin', 'In-Place Resized (1440x900)', 'Coin Stage Bounded Measured', { stageResized });
      }

      // Done button
      await clickVisibleElement(page, '[data-testid="tool-header-back-btn"]');
      await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
    }

    // =========================================================================
    // 6. TEAM SPLITTER TOOL (/teams)
    // =========================================================================
    console.log(`\n--- 6. Team Splitter Tool (/teams) ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/teams`, { waitUntil: 'networkidle0' });

      // Measure stage
      const stageBefore = await getElementRect(page, '[data-testid="teams-stage"]');
      const splitBtnBefore = await getElementRect(page, '[data-testid="teams-split-btn"]');
      assert(stageBefore && stageBefore.visible, 'Teams stage must be visible');
      assert(splitBtnBefore && splitBtnBefore.visible, 'Teams split button must be visible');

      // Add 4 players: Emma, Lucas, Olivia, Noah
      const playerList = ['Emma', 'Lucas', 'Olivia', 'Noah'];
      for (const p of playerList) {
        await typeVisibleElement(page, '[data-testid="teams-name-input"]', p);
        await clickVisibleElement(page, '[data-testid="teams-add-name-btn"]');
      }

      // Select 2 teams
      await clickVisibleElement(page, '[data-testid="teams-count-btn-2"]');

      // Click Split
      await clickVisibleElement(page, '[data-testid="teams-split-btn"]');

      // Wait for shuffle animation (approx 600ms)
      await page.evaluate(() => new Promise(r => setTimeout(r, 700)));

      // Verify all 4 players are present in the teams exactly once
      const assignedMembers = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('[data-testid="teams-member-name"]')).filter(e => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        return els.map(e => e.textContent.trim());
      });
      assert.strictEqual(assignedMembers.length, 4, `All 4 players must be assigned (got ${assignedMembers.length})`);
      for (const p of playerList) {
        assert(assignedMembers.includes(p), `Player ${p} must be assigned to a team`);
      }

      await reportCheckpoint(page, '/teams', vp.name, 'Teams Distributed Correctly', { teamsCount: 2, members: assignedMembers, stage: stageBefore });

      // In-place dynamic resize check (390 -> 1440)
      if (vp.w === 390) {
        await page.setViewport({ width: 1440, height: 900 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
        const stageResized = await getElementRect(page, '[data-testid="teams-stage"]');
        assert(stageResized && stageResized.visible, 'Teams stage must be visible after resize');
        assert(stageResized.width <= 620, `Teams stage must be <= 620px (got ${stageResized.width}px)`);
        assert(stageResized.x >= 0 && stageResized.x + stageResized.width <= 1440, 'Teams stage must be centered');
        await reportCheckpoint(page, '/teams', 'In-Place Resized (1440x900)', 'Teams Stage Bounded Measured', { stageResized });
      }

      // Done button
      await clickVisibleElement(page, '[data-testid="tool-header-back-btn"]');
      await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
    }

    // =========================================================================
    // 7. WHEEL TOOL (/wheel)
    // =========================================================================
    console.log(`\n--- 7. Wheel Tool (/wheel) ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/wheel`, { waitUntil: 'networkidle0' });

      // Measure wheel stage
      const stageBefore = await getElementRect(page, '[data-testid="wheel-stage"]');
      const spinBtnBefore = await getElementRect(page, '[data-testid="wheel-spin-btn"]');
      assert(stageBefore && stageBefore.visible, 'Wheel stage must be visible');
      assert(stageBefore.width <= 360 && stageBefore.height <= 360, `Wheel stage must be <= 360px (got ${stageBefore.width}x${stageBefore.height})`);
      assert(spinBtnBefore && spinBtnBefore.visible, 'Wheel spin button must be visible');

      // Add a 3rd option "Pass"
      await typeVisibleElement(page, '[data-testid="wheel-option-input"]', 'Pass');
      await clickVisibleElement(page, '[data-testid="wheel-add-option-btn"]');

      // Spin wheel
      await clickVisibleElement(page, '[data-testid="wheel-spin-btn"]');
      await reportCheckpoint(page, '/wheel', vp.name, 'Wheel Spinning Action');

      // Wait for spin to complete (10s animation + buffer)
      await page.evaluate(() => new Promise(r => setTimeout(r, 10500)));

      // Verify winner is selected
      const winner = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('[data-testid="wheel-result-value"]')).find(e => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        return el ? el.textContent.trim() : '';
      });
      assert(winner === 'Truth' || winner === 'Dare' || winner === 'Pass', `Winner must be one of Truth/Dare/Pass (got ${winner})`);

      await reportCheckpoint(page, '/wheel', vp.name, 'Wheel Winner Selected', { winner, stage: stageBefore });

      // In-place dynamic resize check (390 -> 1440)
      if (vp.w === 390) {
        await page.setViewport({ width: 1440, height: 900 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
        const stageResized = await getElementRect(page, '[data-testid="wheel-stage"]');
        assert(stageResized && stageResized.visible, 'Wheel stage must be visible after resize');
        assert(stageResized.width <= 360 && stageResized.height <= 360, `Wheel stage must stay <= 360px after resize (got ${stageResized.width}x${stageResized.height})`);
        assert(Math.abs(stageResized.width - stageResized.height) <= 2, `Wheel stage must be square (got ${stageResized.width}x${stageResized.height})`);
        assert(stageResized.x >= 0 && stageResized.x + stageResized.width <= 1440, 'Wheel stage must be centered');
        await reportCheckpoint(page, '/wheel', 'In-Place Resized (1440x900)', 'Wheel Stage Bounded Measured', { stageResized });
      }

      // Done button
      await clickVisibleElement(page, '[data-testid="tool-header-back-btn"]');
      await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
    }

    console.log(`\n========================================================================`);
    console.log(`ALL TOOLS SUITES COMPLETED WITH ZERO DEFECTS ACROSS MOBILE & DESKTOP!`);
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
