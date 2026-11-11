// Run after `expo export --platform web`. Uses request interception, no server.
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true);
    const root = path.resolve('dist');
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.hostname !== 'layout.invalid') return void request.abort();
      let file = path.resolve(root, '.' + (decodeURIComponent(url.pathname) === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
      if (!file.startsWith(root + path.sep)) return void request.abort();
      if ((!fs.existsSync(file) || fs.statSync(file).isDirectory()) && !path.extname(file)) file += '.html';
      if (!fs.existsSync(file)) return void request.respond({ status: 404, body: 'Not found' });
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
      void request.respond({ status: 200, contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    });

    const click = async id => { await page.waitForSelector(`[data-testid="${id}"]`); await page.click(`[data-testid="${id}"]`); };
    const openGame = id => page.goto(`https://layout.invalid/game/${id}`, { waitUntil: 'networkidle0' });
    const assertNoGuide = async () => assert.equal(await page.$('[data-testid="game-start-guide"]'), null);
    const assertSolo = async id => {
      await page.waitForFunction(game => location.pathname === `/game/${game}/session`, {}, id);
      for (const testId of ['handoff-screen', 'game-active-player', 'session-skip-button', 'setup-start-button']) {
        assert.equal(await page.$(`[data-testid="${testId}"]`), null, `solo hides ${testId}`);
      }
      await assertNoGuide();
    };

    await page.setViewport({width:393,height:771,hasTouch:true});
    await openGame('color_match');
    await page.waitForSelector('[data-testid="game-detail-play-solo"]');
    const help = await page.$eval('[data-testid="game-detail-instructions"]', el => el.textContent);
    assert.match(help, /color/i);
    assert.doesNotMatch(help, /This game is ready to play/);
    await page.screenshot({path:'.expo/start-flow-detail.png'});
    await click('game-detail-play-solo');
    await page.waitForSelector('[data-testid="color-slider-hue"]');
    await assertSolo('color_match');
    await click('color-match-submit-button'); await click('color-match-continue-button');
    await page.waitForSelector('[data-testid="final-results"]');

    await openGame('color_match');
    await click('game-detail-mode-singleDevice');
    await click('setup-start-button');
    await page.waitForSelector('[data-testid="handoff-screen"]');
    await assertNoGuide();
    await click('game-ready-button'); await page.waitForSelector('[data-testid="color-slider-hue"]');

    await openGame('sound_match');
    await click('game-detail-play-solo');
    await page.waitForSelector('[data-testid="sound-match-ready-button"]');
    await assertSolo('sound_match');

    await openGame('pass_guess');
    await click('game-detail-mode-singleDevice');
    assert.equal(await page.$('[data-testid="game-detail-play-solo"]'), null);
    await click('setup-start-button');
    await click('pass-guess-start-round');
    await page.waitForSelector('[data-testid="handoff-screen"]');
    await assertNoGuide();
    assert.deepEqual(errors,[]);
    console.log('PASS: direct solo launch, hero instructions, no entry guide and group handoff');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
