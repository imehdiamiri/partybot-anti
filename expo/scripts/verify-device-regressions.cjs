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
    const touch = await page.createCDPSession();
    async function drag(id, axis) {
      const selector=`[data-testid="${id}"]`;
      await page.$eval(selector, el=>el.scrollIntoView({block:'center'}));
      const box=await (await page.$(selector)).boundingBox();
      const x=box.x+box.width/2,y=box.y+box.height/2;
      const before=await page.$eval(selector, el=>el.getAttribute('aria-valuenow') || (el.dataset.testid==='sound-match-slider-track' ? document.querySelector('[data-testid="sound-match-freq-circle"]').textContent : el.parentElement.textContent));
      console.log('slider before',id,before);
      const scrollBefore=await page.evaluate(()=>[...document.querySelectorAll('div')].map(el=>el.scrollTop).filter(Boolean));
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      for(let step=1;step<=5;step++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(axis==='x'?step*10:0),y:y-(axis==='y'?step*15:0)}]});
      await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await new Promise(resolve=>setTimeout(resolve,100));
      const after=await page.$eval(selector, el=>el.getAttribute('aria-valuenow') || (el.dataset.testid==='sound-match-slider-track' ? document.querySelector('[data-testid="sound-match-freq-circle"]').textContent : el.parentElement.textContent));
      console.log('slider after',id,after);
      assert(parseFloat(after.replace(/[^0-9.]/g,''))>parseFloat(before.replace(/[^0-9.]/g,'')),`${id} must follow finger: ${before} -> ${after}`);
      const scrollAfter=await page.evaluate(()=>[...document.querySelectorAll('div')].map(el=>el.scrollTop).filter(Boolean));
      assert.deepEqual(scrollAfter,scrollBefore,`${id} must not move the parent scroll`);
      assert(page.url().includes('/session'), 'drag must not leave game');
    }
    for (const [width,height] of [[320,568],[393,852],[430,932],[768,1024]]) {
      await page.setViewport({width,height,deviceScaleFactor:1,hasTouch:true});
      await page.goto('https://layout.invalid/tools',{waitUntil:'networkidle0'});
      await page.waitForSelector('[data-testid^="tool-card-"]');
      const cards=await page.$$eval('[data-testid^="tool-card-"]',els=>els.map(el=>el.getBoundingClientRect().height));
      assert.equal(cards.length,6); assert(cards.every(height=>height>=150&&height<=220),'bounded tool cards');
      await page.screenshot({path:`.expo/device-tools-${width}.png`});
      await start('tap_in_order','6×6');
      await page.waitForSelector('[data-testid="tap-cell-35"]');
      const rows=await page.$$eval('[data-testid^="tap-cell-"]',els=>els.map(el=>{const r=el.getBoundingClientRect();return {y:Math.round(r.y),right:r.right,bottom:r.bottom};}));
      assert.equal(rows.length,36); assert.equal(new Set(rows.map(r=>r.y)).size,6,'6 exact rows');
      assert(rows.every(r=>r.right<=width+1&&r.bottom<=height+1),'tap grid fits screen');
      await page.screenshot({path:`.expo/device-tap-${width}.png`});
      await start('reaction_time');
      const text=await page.evaluate(()=>{const el=[...document.querySelectorAll('div')].find(el=>el.textContent==='Tap the screen when it turns green'&&el.children.length===0);const r=el.getBoundingClientRect();return {align:getComputedStyle(el).textAlign,left:r.left,right:r.right};});
      assert.equal(text.align,'center');assert(text.left>=20&&text.right<=width-20);
      await page.screenshot({path:`.expo/device-reaction-${width}.png`});
      await start('color_match');await page.waitForSelector('[data-testid="color-slider-hue"]');
      for(const slider of ['hue','saturation','brightness']) await drag('color-slider-'+slider,'x');
      await page.screenshot({path:`.expo/device-color-${width}.png`});
      // A cancel preserves the session; only explicit confirmation leaves it.
      await click('session-exit-button'); await click('action-cancel');
      assert(page.url().includes('/session'));
      await click('session-exit-button'); await click('action-confirm');
      await page.waitForFunction(()=>!location.pathname.includes('/session'));
      await start('sound_match');await click('sound-match-ready-button');
      await drag('sound-match-slider-track','x');
      await page.screenshot({path:`.expo/device-sound-${width}.png`});
      console.log(`${width}x${height}: tools, Tap in Order, Reaction, touch sliders and confirmed Exit PASS`);
    }
    assert.deepEqual(errors, []);
    console.log('Reported regressions passed in browser touch emulation; native device appearance is not emulated.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
