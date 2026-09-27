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

    const touch = await page.createCDPSession();
    for (const width of [320,393,430]) {
      await page.setViewport({width,height:771,deviceScaleFactor:1,isMobile:true,hasTouch:true});
      await page.goto('https://layout.invalid/game/guess_the_seconds/setup',{waitUntil:'networkidle0'});
      await click('setup-start-button');
      await page.waitForSelector('[data-testid="game-guide-start"], [data-testid="guess-seconds-plus"]');
      if (await page.$('[data-testid="game-guide-start"]')) await click('game-guide-start');
      await page.waitForSelector('[data-testid="guess-seconds-plus"]');
      const value=()=>page.$eval('[data-testid="guess-seconds-target"]',el=>Number(el.textContent));
      const initial=await value();
      for (const [id, expected] of [['plus',initial+6],['minus',initial]]) {
        const el=await page.$('[data-testid="guess-seconds-'+id+'"]'); await el.evaluate(el=>el.scrollIntoView({block:'center'}));
        const box=await el.boundingBox();
        for(let i=0;i<6;i++) {await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2); await new Promise(r=>setTimeout(r,45));}
        assert.equal(await value(),expected,'Every rapid tap changes the target');
      }
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width/2-30,y:300},{x:width/2+30,y:300}]});
      for(let i=1;i<=5;i++) await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:width/2-30-i*10,y:300},{x:width/2+30+i*10,y:300}]});
      await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      const state=await page.evaluate(()=>({scale:visualViewport.scale,touch:getComputedStyle(document.documentElement).touchAction,viewports:document.querySelectorAll('meta[name="viewport"]').length,overflow:document.documentElement.scrollWidth>innerWidth}));
      assert.equal(state.scale,1); assert.equal(state.viewports,1); assert.equal(state.overflow,false); assert.equal(state.touch,'pan-x pan-y');
      assert(await page.evaluate(()=>{const e=new Event('gesturestart',{bubbles:true,cancelable:true});document.getElementById('root').dispatchEvent(e);return e.defaultPrevented;}));
      await page.screenshot({path:'.expo/web-touch-'+width+'.png'});
      console.log(width+': rapid +/- taps, pinch, Safari gesture cancellation and viewport PASS');
    }
    await page.goto('https://layout.invalid/tools',{waitUntil:'networkidle0'});
    await page.waitForSelector('[data-testid="tool-card-dice"]');
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:210,y:600}]});
    for(let i=1;i<=8;i++) await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:210,y:600-i*40}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(()=>[...document.querySelectorAll('div')].some(el=>el.scrollTop>20));
    assert.deepEqual(errors,[]);
    console.log('PASS: one-finger scrolling remains available');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
