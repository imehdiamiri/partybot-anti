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
      await click('setup-start-button'); await click('game-guide-start'); await click('game-ready-button');
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
    const fits = async (id, height) => {
      const layout = await page.$eval(`[data-testid="${id}"]`, el => {
        const r = el.getBoundingClientRect(); let parent = el.parentElement; const overflow = [];
        while (parent) {
          const css = getComputedStyle(parent);
          if (['auto','scroll'].includes(css.overflowY) && parent.scrollHeight > parent.clientHeight + 2) overflow.push(parent.dataset.testid || parent.tagName);
          parent = parent.parentElement;
        }
        return { top: r.top, bottom: r.bottom, height: r.height, overflow };
      });
      assert(layout.top >= 0 && layout.bottom <= height + 1 && layout.height >= 44, JSON.stringify({id,layout,height}));
      assert.deepEqual(layout.overflow, [], `${id} must not need scrolling`);
    };
    for (const [width,height] of [[320,487],[393,771],[430,851],[768,943]]) {
      await page.setViewport({width,height,deviceScaleFactor:1,hasTouch:true});
      await start('color_match'); await page.waitForSelector('[data-testid="color-slider-hue"]');
      await fits('color-match-submit-button',height);
      for(const slider of ['hue','saturation','brightness']) await drag('color-slider-'+slider,'x');
      await fits('color-match-submit-button',height);
      await page.screenshot({path:`.expo/compact-color-${width}.png`});
      await click('color-match-submit-button'); await page.waitForSelector('[data-testid="color-match-continue-button"]');
      await start('sound_match'); await click('sound-match-ready-button');
      await new Promise(resolve=>setTimeout(resolve,300));
      await fits('sound-match-submit-button',height);
      await drag('sound-match-slider-track','y');
      await click('sound-match-freq-up-button'); await click('sound-match-freq-down-button');
      await click('sound-match-play-guess-button');
      await fits('sound-match-submit-button',height);
      await page.screenshot({path:`.expo/compact-sound-${width}.png`});
      await click('sound-match-submit-button');
      console.log(`${width}x${height}: controls + Submit fit without scrolling; slider touch and submission PASS`);
    }
    assert.deepEqual(errors, []);
    console.log('Reported regressions passed in browser touch emulation; native device appearance is not emulated.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
