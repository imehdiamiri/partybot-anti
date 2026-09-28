// Touch-only input regression: local export, external requests blocked, no server/account.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');
const root = path.resolve('dist');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const tap = async selector => {
      const r=await page.$eval(selector, el => {const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
      await page.touchscreen.tap(r.x,r.y);
    };
    const typeByTouch = async (selector, text) => {
      await tap(selector);
      await wait(80);
      assert(await page.$eval(selector,el=>document.activeElement===el), selector+' retains focus after touch');
      // A second tap may select the word on touch browsers; put the caret at its end.
      await page.keyboard.press('End');
      await page.keyboard.type(text);
    };
    const errors = [], warnings = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.text().includes('No route named')) warnings.push(message.text()); });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.hostname !== 'partybot.games') return void request.abort();
      let file = path.resolve(root, '.' + (decodeURIComponent(url.pathname) === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
      if (!file.startsWith(root + path.sep)) return void request.abort();
      if (!fs.existsSync(file) && !path.extname(file)) file += '.html';
      if (!fs.existsSync(file)) file = path.join(root, 'index.html');
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
      void request.respond({ status: 200, contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    });
    const narrow=process.env.REVIEW_WIDTH==='320';
    await page.setViewport({width:narrow?320:390,height:narrow?568:844,isMobile:true,hasTouch:true});
    await page.goto('https://partybot.games/game/color_match/setup', { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="onboarding-continue"]');
    assert.equal(await page.$('[data-testid="setup-start-button"]'), null, 'deep links cannot bypass onboarding');
    await wait(800);
    // Scroll the carousel directly: web has no native momentum-end callback.
    await page.$eval('[data-testid="onboarding-name"]', el => {
      let scroller = el.parentElement;
      while(scroller && !(scroller.scrollWidth > scroller.clientWidth * 3)) scroller=scroller.parentElement;
      if(!scroller) throw new Error('Carousel not found');
      scroller.scrollLeft=scroller.clientWidth*2;
    });
    await wait(700);
    await page.screenshot({path:'.expo/onboarding-swiped.png'});
    await typeByTouch('[data-testid="onboarding-name"]', 'UI');
    await page.keyboard.press('Tab');
    await typeByTouch('[data-testid="onboarding-name"]', ' Reviewer');
    assert.equal(await page.$eval('[data-testid="onboarding-name"]',el=>el.value),'UI Reviewer');
    const nameStyle=await page.$eval('[data-testid="onboarding-name"]',el=>({color:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));
    assert.notEqual(nameStyle.color,nameStyle.bg);
    await page.screenshot({path:'.expo/review-name-touch.png'});
    await page.click('[data-testid="onboarding-continue"]'); await wait(700);
    await page.click('[data-testid="onboarding-continue"]');
    await page.waitForSelector('[data-testid="auth-username"]');
    await page.screenshot({ path: '.expo/review-signup.png' });
    assert.equal(await page.$('[data-testid="tool-card-dice"]'), null);
    // Follow the first-use signup without replacing the document while editing.
    await page.evaluate(() => [...document.querySelectorAll('div')].find(el => el.children.length === 0 && el.textContent === 'Sign Up')?.click());
    await page.waitForSelector('[data-testid="auth-google"]');
    await typeByTouch('[data-testid="auth-username"]', 'ui-');
    await typeByTouch('[data-testid="auth-password"]', 'test-password-only');
    await typeByTouch('[data-testid="auth-username"]', 'review');
    assert.equal(await page.$eval('[data-testid="auth-username"]',el=>el.value),'ui-review');
    await page.screenshot({path:'.expo/review-auth-touch.png'});
    assert(await page.$eval('[data-testid="auth-submit"]',el=>el.getAttribute('aria-disabled')!=='true'));
    assert.deepEqual(errors, []); assert.deepEqual(warnings, []);
    console.log('PASS: touch focus, blur and re-focus, name contrast, editable email/password and enabled submit/Google buttons. No account created.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
