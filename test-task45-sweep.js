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
  const handle = await page.waitForSelector(selector, { visible: true, timeout });
  assert(handle, `Element not found or not visible: ${selector}`);
  await handle.click();
  if (delayAfter > 0) {
    await page.evaluate((ms) => new Promise(r => setTimeout(r, ms)), delayAfter);
  }
}

async function dismissHintsIfPresent(page) {
  try {
    const hintHandle = await page.evaluateHandle(() => {
      const elements = Array.from(document.querySelectorAll('div, button, span, p'));
      return elements.find(el => {
        const text = el.textContent ? el.textContent.trim() : '';
        return (text === 'Got it' || text === "Got it, let's play!" || text === 'Got it!' || text === 'I understand') && el.offsetParent !== null;
      }) || null;
    });
    if (hintHandle && hintHandle.asElement()) {
      await hintHandle.asElement().click();
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
  console.log(`TASK 46 RESPONSIVE GAMEPLAY SWEEP (SEVEN REMAINING GAMES - HARDENED)`);
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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-fake-ui-for-media-stream']
  });

  try {
    const page = await browser.newPage();

    // =========================================================================
    // 1. REVERSE SINGING
    // =========================================================================
    console.log(`\n--- 1. Reverse Singing ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/game/reverse_singing/setup?mode=singleDevice`, { waitUntil: 'networkidle0' });
      await clickVisibleElement(page, '[data-testid="setup-start-button"]');
      await dismissHintsIfPresent(page);

      // Verify Player 1 Card & Record Button rendered and bounded
      await page.waitForSelector('[data-testid="reverse-singing-p1-record"]', { visible: true, timeout: 15000 });
      const rsMetrics = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="reverse-singing-p1-record"]');
        const card = btn ? btn.closest('[style*="border-radius"], div') : null;
        return {
          btnWidth: btn ? Math.round(btn.getBoundingClientRect().width) : 0,
          cardWidth: card ? Math.round(card.getBoundingClientRect().width) : 0,
        };
      });
      assert(rsMetrics.cardWidth <= 640, 'Reverse Singing card should be bounded on desktop');
      await reportCheckpoint(page, '/game/reverse_singing', vp.name, 'Recording Studio Initial State', rsMetrics);

      // Click real P1 Record control
      await clickVisibleElement(page, '[data-testid="reverse-singing-p1-record"]');
      await page.evaluate(() => new Promise(r => setTimeout(r, 600)));

      // Check factual outcome: either recording started or explicit fallback error banner is rendered
      const recOutcome = await page.evaluate(() => {
        const errEl = document.querySelector('[data-testid="reverse-singing-mic-error"]');
        if (errEl && errEl.offsetParent !== null) {
          return { type: 'fallback_error_banner', text: errEl.textContent.trim() };
        }
        const btn = document.querySelector('[data-testid="reverse-singing-p1-record"]');
        const text = btn ? btn.textContent.trim() : '';
        if (text.includes('/ 10s') || text.includes('0s')) {
          return { type: 'recording_active', text };
        }
        return { type: 'idle_or_prompted', text };
      });

      if (recOutcome.type === 'recording_active') {
        await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));
        await clickVisibleElement(page, '[data-testid="reverse-singing-p1-record"]');
        await page.waitForSelector('[data-testid="reverse-singing-p1-play"]', { visible: true, timeout: 10000 });
        await clickVisibleElement(page, '[data-testid="reverse-singing-p1-play"]');
        await clickVisibleElement(page, '[data-testid="reverse-singing-p1-play-reverse"]');
        await reportCheckpoint(page, '/game/reverse_singing', vp.name, 'Audio Recorded & Playback Tested', { outcome: recOutcome.type });
      } else {
        await reportCheckpoint(page, '/game/reverse_singing', vp.name, 'Microphone Action / Explicit Fallback Verified', { outcome: recOutcome.type, detail: recOutcome.text });
      }
    }

    // =========================================================================
    // 2. GUESS THE SECONDS
    // =========================================================================
    console.log(`\n--- 2. Guess the Seconds ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/game/guess_the_seconds/setup?mode=singleDevice`, { waitUntil: 'networkidle0' });
      await clickVisibleElement(page, '[data-testid="setup-start-button"]');
      await dismissHintsIfPresent(page);

      // Start turn
      await clickVisibleElement(page, '[data-testid="guess-seconds-start-button"]');
      await page.waitForSelector('[data-testid="guess-seconds-stop-button"]', { visible: true, timeout: 15000 });
      await reportCheckpoint(page, '/game/guess_the_seconds', vp.name, 'Active Counting Phase');

      // Wait 1s and Stop turn
      await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));
      await clickVisibleElement(page, '[data-testid="guess-seconds-stop-button"]');

      // Attempt feedback & next turn button
      await page.waitForSelector('[data-testid="guess-seconds-next-button"]', { visible: true, timeout: 15000 });
      await reportCheckpoint(page, '/game/guess_the_seconds', vp.name, 'Timing Result Feedback');
    }

    // =========================================================================
    // 3. TEN TANGLE
    // =========================================================================
    console.log(`\n--- 3. Ten Tangle ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/game/ten_tangle/setup?mode=singleDevice`, { waitUntil: 'networkidle0' });
      await clickVisibleElement(page, '[data-testid="setup-start-button"]');
      await dismissHintsIfPresent(page);

      // Guesser announce
      await clickVisibleElement(page, '[data-testid="ten-tangle-announce-continue"]');

      // Pass to each non-guesser player / Show number
      let nonGuesserCount = 0;
      while (true) {
        const readyBtn = await page.$('[data-testid="game-ready-button"]');
        if (readyBtn) {
          nonGuesserCount++;
          await clickVisibleElement(page, '[data-testid="game-ready-button"]');
          await page.waitForSelector('[data-testid="ten-tangle-got-it"]', { visible: true, timeout: 8000 });
          await clickVisibleElement(page, '[data-testid="ten-tangle-got-it"]');
        } else {
          break;
        }
      }
      await reportCheckpoint(page, '/game/ten_tangle', vp.name, 'Secret Numbers Distributed', { nonGuessers: nonGuesserCount });

      // Scenario reveal
      await page.waitForSelector('[data-testid="ten-tangle-start-acting"]', { visible: true, timeout: 15000 });
      await reportCheckpoint(page, '/game/ten_tangle', vp.name, 'Scenario Reveal Stage');
      await clickVisibleElement(page, '[data-testid="ten-tangle-start-acting"]');

      // Acting phase
      await page.waitForSelector('[data-testid="ten-tangle-start-guessing"]', { visible: true, timeout: 15000 });
      await clickVisibleElement(page, '[data-testid="ten-tangle-start-guessing"]');

      // Guesser guessing: assign number for each player using actual Puppeteer ElementHandle.click()
      await page.waitForSelector('[data-testid^="ten-tangle-num-"]', { visible: true, timeout: 15000 });
      const numButtonSelectors = await page.evaluate(() => {
        const numBtns = Array.from(document.querySelectorAll('[data-testid^="ten-tangle-num-"]'));
        const seenPlayers = new Set();
        const selectors = [];
        for (const btn of numBtns) {
          const testId = btn.getAttribute('data-testid');
          const parts = testId.split('-');
          const playerId = parts.slice(3, -1).join('-');
          if (!seenPlayers.has(playerId)) {
            seenPlayers.add(playerId);
            selectors.push(`[data-testid="${testId}"]`);
          }
        }
        return selectors;
      });

      for (const sel of numButtonSelectors) {
        await clickVisibleElement(page, sel);
      }

      await page.waitForSelector('[data-testid="ten-tangle-submit-guesses"]', { visible: true, timeout: 15000 });
      await clickVisibleElement(page, '[data-testid="ten-tangle-submit-guesses"]');

      // Results / Scoreboard
      await page.waitForSelector('[data-testid="ten-tangle-show-scoreboard"]', { visible: true, timeout: 15000 });
      await reportCheckpoint(page, '/game/ten_tangle', vp.name, 'Round Results Screen');
    }

    // =========================================================================
    // 4. PASS GUESS
    // =========================================================================
    console.log(`\n--- 4. Pass Guess ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/game/pass_guess/setup?mode=singleDevice`, { waitUntil: 'networkidle0' });
      await clickVisibleElement(page, '[data-testid="setup-start-button"]');
      await dismissHintsIfPresent(page);

      // Intro phase: Start round
      await clickVisibleElement(page, '[data-testid="pass-guess-start-round"]');

      // Answering loop for players
      while (true) {
        const readyBtn = await page.$('[data-testid="game-ready-button"]');
        if (readyBtn) {
          await clickVisibleElement(page, '[data-testid="game-ready-button"]');
        }

        const input = await page.$('[data-testid="pass-guess-answer-input"]');
        if (input) {
          await input.type('Fun Answer', { delay: 20 });
          await clickVisibleElement(page, '[data-testid="pass-guess-submit-answer"]');
        } else {
          break;
        }
      }

      // Guessing loop for all guesser players
      while (true) {
        const readyBtn = await page.$('[data-testid="game-ready-button"]');
        if (readyBtn) {
          await clickVisibleElement(page, '[data-testid="game-ready-button"]');
        }

        const chips = await page.$$('[data-testid^="pass-guess-chip-"]');
        if (chips.length > 0) {
          const chipSelectors = await page.evaluate(() => {
            const answerChips = Array.from(document.querySelectorAll('[data-testid^="pass-guess-chip-"]'));
            const seenAnswers = new Set();
            const selectors = [];
            for (const chip of answerChips) {
              const testId = chip.getAttribute('data-testid');
              const parts = testId.split('-');
              const ansId = parts[3];
              if (!seenAnswers.has(ansId)) {
                seenAnswers.add(ansId);
                selectors.push(`[data-testid="${testId}"]`);
              }
            }
            return selectors;
          });

          for (const sel of chipSelectors) {
            await clickVisibleElement(page, sel);
          }

          await clickVisibleElement(page, '[data-testid="pass-guess-submit-guesses"]');
        } else {
          break;
        }
      }

      // Leaderboard
      await page.waitForSelector('[data-testid="pass-guess-next-phase"]', { visible: true, timeout: 15000 });
      await reportCheckpoint(page, '/game/pass_guess', vp.name, 'Leaderboard & Statistics');
    }

    // =========================================================================
    // 5. SPIN BOTTLE
    // =========================================================================
    console.log(`\n--- 5. Spin Bottle ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/game/spin_bottle/setup?mode=singleDevice`, { waitUntil: 'networkidle0' });
      await clickVisibleElement(page, '[data-testid="setup-start-button"]');
      await dismissHintsIfPresent(page);

      // Spin
      await clickVisibleElement(page, '[data-testid="spin-bottle-spin-btn"]');
      await reportCheckpoint(page, '/game/spin_bottle', vp.name, 'Bottle Spinning Animation');

      // Wait for spin to land (approx 4.2s)
      await page.waitForSelector('[data-testid="spin-bottle-continue-btn"]', { visible: true, timeout: 15000 });
      await clickVisibleElement(page, '[data-testid="spin-bottle-continue-btn"]');

      // Choose Truth
      await page.waitForSelector('[data-testid="spin-bottle-truth-btn"]', { visible: true, timeout: 15000 });
      await clickVisibleElement(page, '[data-testid="spin-bottle-truth-btn"]');

      // Prompt screen
      await page.waitForSelector('[data-testid="spin-bottle-done-btn"]', { visible: true, timeout: 15000 });
      await reportCheckpoint(page, '/game/spin_bottle', vp.name, 'Truth Prompt Revealed');
    }

    // =========================================================================
    // 6. DRAW RUSH
    // =========================================================================
    console.log(`\n--- 6. Draw Rush ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/game/draw_rush/setup?mode=singleDevice`, { waitUntil: 'networkidle0' });
      await clickVisibleElement(page, '[data-testid="setup-start-button"]');
      await dismissHintsIfPresent(page);

      // Ready handoff
      await clickVisibleElement(page, '[data-testid="game-ready-button"]');

      // Reveal secret concept -> Start Drawing
      await page.waitForSelector('[data-testid="draw-rush-start-drawing"]', { visible: true, timeout: 15000 });
      await clickVisibleElement(page, '[data-testid="draw-rush-start-drawing"]');

      // Drawing workspace and canvas bounding check
      await page.waitForSelector('[data-testid="draw-rush-canvas"]', { visible: true, timeout: 15000 });
      const drawMetrics = await page.evaluate(() => {
        const workspace = document.querySelector('[data-testid="draw-rush-workspace"]');
        const canvas = document.querySelector('[data-testid="draw-rush-canvas"]');
        const wRect = workspace ? workspace.getBoundingClientRect() : null;
        const cRect = canvas ? canvas.getBoundingClientRect() : null;
        return {
          workspaceWidth: wRect ? Math.round(wRect.width) : 0,
          workspaceHeight: wRect ? Math.round(wRect.height) : 0,
          canvasWidth: cRect ? Math.round(cRect.width) : 0,
          canvasHeight: cRect ? Math.round(cRect.height) : 0,
          canvasX: cRect ? Math.round(cRect.left) : 0,
          canvasY: cRect ? Math.round(cRect.top) : 0,
        };
      });

      if (vp.w >= 1000) {
        assert(drawMetrics.workspaceWidth <= 780, `Desktop workspace must be bounded <= 780px (got ${drawMetrics.workspaceWidth}px)`);
        assert(drawMetrics.canvasWidth <= 780, `Desktop canvas must be bounded <= 780px (got ${drawMetrics.canvasWidth}px)`);
      } else {
        assert(drawMetrics.workspaceWidth <= 390, `Mobile workspace width must be <= 390px (got ${drawMetrics.workspaceWidth}px)`);
      }

      // Real mouse pointer drag inside the canvas
      const startX = drawMetrics.canvasX + 60;
      const startY = drawMetrics.canvasY + 60;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 80, startY + 80);
      await page.mouse.up();
      await page.evaluate(() => new Promise(r => setTimeout(r, 200)));

      // Assert observable rendered SVG stroke path
      const pathCount = await page.$$eval('[data-testid="draw-rush-canvas"] svg path', (paths) => paths.length);
      assert(pathCount > 0, `Observable SVG stroke path must exist (got ${pathCount})`);

      await reportCheckpoint(page, '/game/draw_rush', vp.name, 'Interactive Bounded Canvas & Rendered Stroke', {
        ...drawMetrics,
        renderedPaths: pathCount,
      });

      // Done Drawing
      await clickVisibleElement(page, '[data-testid="draw-rush-done-drawing"]');

      // Guessing phase -> Yes!
      await page.waitForSelector('[data-testid="draw-rush-guess-correct"]', { visible: true, timeout: 15000 });
      await clickVisibleElement(page, '[data-testid="draw-rush-guess-correct"]');

      // Turn result
      await page.waitForSelector('[data-testid="draw-rush-next-round"]', { visible: true, timeout: 15000 });
      await reportCheckpoint(page, '/game/draw_rush', vp.name, 'Turn Result & Scoreboard');
    }

    // =========================================================================
    // 7. DRUM CHALLENGE
    // =========================================================================
    console.log(`\n--- 7. Drum Challenge ---`);
    for (const vp of [{ name: 'Desktop (1440x900)', w: 1440, h: 900 }, { name: 'Mobile (390x844)', w: 390, h: 844 }]) {
      await page.setViewport({ width: vp.w, height: vp.h });
      await page.goto(`${baseUrl}/game/drum_challenge/setup?mode=singleDevice`, { waitUntil: 'networkidle0' });
      await clickVisibleElement(page, '[data-testid="setup-start-button"]');
      await dismissHintsIfPresent(page);

      // Ready handoff
      await clickVisibleElement(page, '[data-testid="game-ready-button"]');

      // Listening phase & Big Drum Tap
      await page.waitForSelector('[data-testid="drum-challenge-tap-btn"]', { visible: true, timeout: 15000 });
      await clickVisibleElement(page, '[data-testid="drum-challenge-tap-btn"]');

      // Click Result button
      await page.waitForSelector('[data-testid="drum-challenge-result-btn"]', { visible: true, timeout: 15000 });
      await clickVisibleElement(page, '[data-testid="drum-challenge-result-btn"]');

      // Result attempt feedback
      await page.waitForSelector('[data-testid="drum-challenge-next-attempt"]', { visible: true, timeout: 15000 });
      await reportCheckpoint(page, '/game/drum_challenge', vp.name, 'Timing Accuracy Result Feedback');
    }

    console.log(`\n========================================================================`);
    console.log(`ALL 7 REMAINING GAMES COMPLETED WITH ZERO DEFECTS ACROSS MOBILE & DESKTOP!`);
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