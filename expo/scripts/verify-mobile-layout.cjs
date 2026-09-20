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
      if (!fs.existsSync(file) && !path.extname(file)) file += '.html';
      if (!fs.existsSync(file)) return void request.respond({ status: 404, body: 'Not found' });
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
      void request.respond({ status: 200, contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    });
    for (const [width, height] of process.argv.includes('--gameplay-only') ? [] : [[320, 568], [390, 844], [768, 1024]]) {
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      const games = ['reverse_singing', 'guess_the_seconds', 'imposter', 'pass_guess', 'memory_grid', 'memory_path', 'tap_in_order', 'ten_tangle', 'color_trap', 'spin_bottle', 'draw_rush', 'reaction_time', 'eye_sight', 'drum_challenge', 'color_match', 'sound_match'];
      for (const route of ['', 'friends', 'profile', 'tools', 'dice', 'coin', 'hourglass', 'bottle', 'wheel', 'teams', ...games.map(id => `game/${id}/setup`)]) {
        await page.goto('https://layout.invalid/' + route, { waitUntil: 'networkidle0' });
        const info = await page.evaluate(() => ({ text: document.body.innerText, overflow: document.documentElement.scrollWidth > innerWidth + 1 }));
        assert(!info.text.includes('Something went wrong'), route + ' error');
        assert(!info.overflow, route + ' horizontal overflow');
        if (route === 'tools') assert.equal(await page.$$eval('[data-testid^="tool-card-"]', els => els.length), 6);
        if (width === 320 && ['tools', 'dice', 'hourglass'].includes(route)) await page.screenshot({ path: '.expo/layout-' + route + '.png' });
        console.log(`${width}x${height} ${route} PASS`);
      }
    }
    for (const [width, height] of [[320, 568], [390, 844], [768, 1024]]) {
      await page.setViewport({ width, height });
      await page.goto('https://layout.invalid/game/memory_grid/setup', { waitUntil: 'networkidle0' });
      await page.evaluate(() => [...document.querySelectorAll('div')].find(el => el.textContent === '6×6' && el.children.length === 0).click());
      await page.click('[data-testid="setup-start-button"]');
      await page.waitForSelector('[data-testid="game-guide-start"]');
      await page.click('[data-testid="game-guide-start"]');
      await page.waitForSelector('[data-testid="game-ready-button"]');
      await page.click('[data-testid="game-ready-button"]');
      await page.waitForSelector('[data-testid="memory-tile-35"]');
      await page.waitForFunction(() => document.querySelector('[data-testid="memory-tile-35"]').getBoundingClientRect().height > 1);
      const tiles = await page.$$eval('[data-testid^="memory-tile-"]', els => els.map(el => {
        const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      }));
      assert.equal(tiles.length, 36);
      assert.equal(new Set(tiles.map(tile => Math.round(tile.y))).size, 6, 'exactly six rows');
      assert(tiles.every(tile => tile.x >= 0 && tile.right <= width + 1 && tile.y >= 0 && tile.bottom <= height + 1), 'all memory tiles fit');
      await page.screenshot({ path: `.expo/layout-memory-${width}.png` });
      console.log(`${width}x${height} memory 6x6 gameplay PASS`);
    }
    assert.deepEqual(errors, []);
    console.log('Responsive checks passed; no page exceptions. Native device appearance requires device QA.');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
