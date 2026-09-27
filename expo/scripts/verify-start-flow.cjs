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
    const start = async (game, grid) => {
      await page.goto('https://layout.invalid/game/'+game+'/setup', {waitUntil:'networkidle0'});
      if(grid) await page.evaluate(text => [...document.querySelectorAll('div')].find(el=>el.textContent===text&&el.children.length===0).click(),grid);
      await click('setup-start-button');
      await page.waitForSelector('[data-testid="game-start-guide"], [data-testid="handoff-screen"], [data-testid="game-active-player"]');
      if (await page.$('[data-testid="game-guide-start"]')) await click('game-guide-start');
      await page.waitForSelector('[data-testid="handoff-screen"], [data-testid="game-active-player"]');
      if (await page.$('[data-testid="game-ready-button"]')) await click('game-ready-button');
    };

    await page.setViewport({width:393,height:771,hasTouch:true});
    await page.goto('https://layout.invalid/game/color_match',{waitUntil:'networkidle0'});
    await page.waitForSelector('[data-testid="game-detail-mode-singleDevice"]');
    const cta=await page.$eval('[data-testid="game-detail-mode-singleDevice"]',el=>({text:el.textContent,height:el.getBoundingClientRect().height}));
    assert(cta.text.includes('Play Now') && cta.height>=100);
    await page.screenshot({path:'.expo/start-flow-detail.png'});
    await click('game-detail-mode-singleDevice');
    await click('setup-player-minus');
    await click('setup-start-button'); await click('game-guide-start');
    await page.waitForSelector('[data-testid="color-slider-hue"]');
    assert.equal(await page.$('[data-testid="handoff-screen"]'),null,'solo skips handoff');
    await click('color-match-submit-button'); await click('color-match-continue-button');
    // Reload the app: guide history must survive a full document load.
    await page.goto('https://layout.invalid/game/color_match/setup',{waitUntil:'networkidle0'});
    await click('setup-player-minus'); await click('setup-start-button'); await page.waitForSelector('[data-testid="color-slider-hue"]');
    assert.equal(await page.$('[data-testid="game-start-guide"]'),null,'guide stays dismissed after reload');
    assert.equal(await page.$('[data-testid="handoff-screen"]'),null);
    await page.goto('https://layout.invalid/game/color_match/setup',{waitUntil:'networkidle0'});
    await click('setup-player-plus'); await click('setup-start-button');
    await page.waitForSelector('[data-testid="handoff-screen"]');
    assert.equal(await page.$('[data-testid="game-start-guide"]'),null);
    await click('game-ready-button'); await page.waitForSelector('[data-testid="color-slider-hue"]');
    await page.goto('https://layout.invalid/game/sound_match/setup',{waitUntil:'networkidle0'});
    await click('setup-player-minus'); await click('setup-start-button');
    await click('game-guide-start');
    await page.waitForSelector('[data-testid="sound-match-ready-button"]');
    assert.equal(await page.$('[data-testid="handoff-screen"]'),null);
    assert.deepEqual(errors,[]);
    console.log('PASS: prominent web Play, first guide, persisted skip, solo bypass and multiplayer handoff');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
