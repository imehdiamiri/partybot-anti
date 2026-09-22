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
      const types = { '.wav': 'audio/wav', '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
      void request.respond({ status: 200, contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    });

    await page.evaluateOnNewDocument(() => {
      window.playedClips = [];
      const original = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        window.playedClips.push({ duration: this.buffer?.duration, loop: this.loop, length: this.buffer?.length });
        return original.apply(this, args);
      };
    });
    const click = async id => { await page.waitForSelector(`[data-testid="${id}"]`); await page.click(`[data-testid="${id}"]`); };
    for (const [width,height] of [[320,568],[393,852],[768,1024]]) {
      await page.setViewport({width,height,isMobile:true,hasTouch:true,deviceScaleFactor:1});
      for (const game of ['color_match','imposter']) {
        await page.goto('https://layout.invalid/game/'+game+'/setup',{waitUntil:'networkidle0'});
        await click('setup-start-button'); await click('game-guide-start');
        await page.waitForSelector('[data-testid="handoff-screen"]');
        await new Promise(r=>setTimeout(r,1200));
        const rect = await page.$eval('[data-testid="handoff-screen"]',el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,height:r.height};});
        assert(rect.left<1 && rect.right>=width-1, 'handoff spans available width');
        assert(rect.bottom>=height-2, 'handoff spans available height');
        const card = await page.$eval('[data-testid="handoff-card"]',el=>({border:getComputedStyle(el).borderTopWidth,background:getComputedStyle(el).backgroundColor}));
        assert.equal(card.border,'0px'); assert.equal(card.background,'rgba(0, 0, 0, 0)');
        await page.screenshot({path:`.expo/handoff-${game}-${width}.png`});
        await click('game-ready-button');
        await page.waitForFunction(()=>!document.querySelector('[data-testid="handoff-screen"]'));
        console.log(`${game} fullscreen handoff ${width}x${height} PASS`);
      }
    }
    await page.setViewport({width:393,height:852,isMobile:true,hasTouch:true,deviceScaleFactor:1});
    for (const [tool,button,duration,loop] of [['bottle','bottle-spin-btn',.7,true],['dice','dice-roll-btn',.13,false],['wheel','wheel-spin-btn',.055,false]]) {
      await page.goto('https://layout.invalid/'+tool,{waitUntil:'networkidle0'});
      await click(button);
      await page.waitForFunction((duration,loop)=>window.playedClips.some(c=>Math.abs(c.duration-duration)<.001 && c.loop===loop),{},duration,loop);
      console.log(tool+': actual recorded WAV playback PASS');
    }
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
