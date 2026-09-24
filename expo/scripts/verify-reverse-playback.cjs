// Run after `expo export --platform web`. Uses request interception, no server.
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
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

    await browser.defaultBrowserContext().overridePermissions('https://layout.invalid', ['microphone']);
    await page.setViewport({width:393,height:771,hasTouch:true});
    const click = async id => { await page.waitForSelector(`[data-testid="${id}"]`); await page.waitForFunction(id => document.querySelector(`[data-testid="${id}"]`)?.getAttribute('aria-disabled') !== 'true', {}, id); await page.click(`[data-testid="${id}"]`); };
    const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
    await page.goto('https://layout.invalid/game/reverse_singing/setup',{waitUntil:'networkidle0'});
    await click('setup-start-button'); await click('game-guide-start');
    await click('reverse-singing-p1-record'); await wait(2500); await click('reverse-singing-p1-record');
    await page.waitForFunction(()=>document.querySelector('[data-testid="reverse-singing-p1-play-slow"]')?.getAttribute('aria-disabled')!=='true');
    await click('reverse-singing-p1-play'); await wait(600); await click('reverse-singing-stop-playback');
    await click('reverse-singing-p1-play-reverse'); await wait(600); await click('reverse-singing-stop-playback');
    await click('reverse-singing-p1-play-slow'); await wait(3000);
    assert(await page.$('[data-testid="reverse-singing-stop-playback"]'),'Slow take must still play after normal take duration');
    await page.waitForFunction(()=>!document.querySelector('[data-testid="reverse-singing-stop-playback"]'),{timeout:8000});
    await click('reverse-singing-p2-record'); await wait(1500); await click('reverse-singing-p2-record');
    await click('reverse-singing-p2-play'); await wait(400); await click('reverse-singing-stop-playback');
    await click('reverse-singing-p2-result'); await wait(400); await click('reverse-singing-stop-playback');
    await click('reverse-singing-retry');
    assert.equal(await page.$eval('[data-testid="reverse-singing-p1-play-slow"]',el=>el.getAttribute('aria-disabled')),'true');
    assert.deepEqual(errors, []);
    console.log('Real browser microphone PCM: original/reverse/half-speed/natural completion/mimic/result/Stop/Retry PASS');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
