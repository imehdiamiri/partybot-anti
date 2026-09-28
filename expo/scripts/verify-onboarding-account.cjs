// Static export verification: every request is intercepted; no server or real account.
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
    await page.setViewport({ width: 390, height: 844 });
    const errors = [], warnings = [], authRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.text().includes('No route named')) warnings.push(message.text()); });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.hostname === 'identitytoolkit.googleapis.com') {
        authRequests.push({ path: url.pathname, method: request.method() });
        const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
        if (request.method() === 'OPTIONS') return void request.respond({ status: 200, headers });
        const payload = { sub: 'ui-review-user', user_id: 'ui-review-user', aud: 'partyplay-8', iss: 'https://securetoken.google.com/partyplay-8', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600, auth_time: Math.floor(Date.now()/1000), firebase: { sign_in_provider: 'password', identities: { email: ['ui-review@partygames.app'] } } };
        const token = Buffer.from('{"alg":"none"}').toString('base64url') + '.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.test';
        const user = { localId: 'ui-review-user', email: 'ui-review@partygames.app', emailVerified: false, providerUserInfo: [{ providerId: 'password', email: 'ui-review@partygames.app', rawId: 'ui-review@partygames.app' }], lastLoginAt: String(Date.now()), createdAt: String(Date.now()) };
        const body = url.pathname.endsWith(':lookup') ? { users: [user] } : { ...user, idToken: token, refreshToken: 'test-only-refresh', expiresIn: '3600' };
        return void request.respond({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(body) });
      }
      if (url.hostname !== 'layout.invalid') return void request.abort();
      let file = path.resolve(root, '.' + (decodeURIComponent(url.pathname) === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
      if (!file.startsWith(root + path.sep)) return void request.abort();
      if (!fs.existsSync(file) && !path.extname(file)) file += '.html';
      if (!fs.existsSync(file)) file = path.join(root, 'index.html');
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
      void request.respond({ status: 200, contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    });
    for (const [width,height] of [[320,568],[390,844],[768,1024],[1280,900]]) {
      await page.setViewport({width,height});
      await page.goto('https://layout.invalid/onboarding', {waitUntil:'networkidle0'});
      await page.waitForSelector('[data-testid="onboarding-continue"]');
      await wait(700);
      const layout = await page.evaluate(() => {
        const button=document.querySelector('[data-testid="onboarding-continue"]').getBoundingClientRect();
        const subtitle=[...document.querySelectorAll('div')].find(el=>el.children.length===0&&el.textContent==="Phones dead. Vibes deader. We've all been there.").getBoundingClientRect();
        return {bottom:subtitle.bottom,button:button.top,buttonBottom:button.bottom,height:innerHeight};
      });
      assert(layout.bottom <= layout.button-8, 'onboarding copy must not overlap CTA');
      assert(layout.buttonBottom <= layout.height, 'onboarding CTA stays visible');
      await page.screenshot({path:`.expo/review-onboarding-${width}.png`});
    }
    await page.setViewport({width:390,height:844});
    await page.goto('https://layout.invalid/game/color_match/setup', { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="onboarding-continue"]');
    assert.equal(await page.$('[data-testid="setup-start-button"]'), null, 'deep links cannot bypass onboarding');
    for (let i = 0; i < 2; i++) { await page.click('[data-testid="onboarding-continue"]'); await wait(700); }
    await page.type('input', 'UI Reviewer');
    await page.click('[data-testid="onboarding-continue"]'); await wait(700);
    await page.click('[data-testid="onboarding-continue"]');
    await page.waitForSelector('[data-testid="auth-username"]');
    await page.screenshot({ path: '.expo/review-signup.png' });
    // The name/slides alone must not unlock tools or games, even after reload.
    await page.goto('https://layout.invalid/tools', { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="auth-submit"]');
    assert.equal(await page.$('[data-testid="tool-card-dice"]'), null);
    // Select signup after testing the returning signed-out user's login view.
    await page.evaluate(() => [...document.querySelectorAll('div')].find(el => el.children.length === 0 && el.textContent === 'Sign Up').click());
    await page.type('[data-testid="auth-username"]', 'ui-review');
    await page.type('[data-testid="auth-password"]', 'test-password-only');
    await page.click('[data-testid="auth-submit"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid="auth-submit"]'));
    assert(authRequests.some(r => r.path.endsWith(':signUp')), 'signup uses Firebase, not local guest');
    for (const [width,height] of [[320,568],[390,844],[768,1024],[1280,900]]) {
      await page.setViewport({ width, height });
      await page.goto('https://layout.invalid/tools', { waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-testid="tool-card-dice"]');
      const cards = await page.$$eval('[data-testid^="tool-card-"]', els => els.map(el => { const r=el.getBoundingClientRect(); return { width:r.width,height:r.height,text:el.textContent }; }));
      assert.equal(cards.length,6);
      assert(cards.every(c => Math.abs(c.width-c.height)<1), 'tool cards must be square');
      assert(!cards.some(c => /Roll 1|Spin to|Set a timer|Heads or tails|Split into/.test(c.text)), 'tool subtitles removed');
      assert(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth+1)), 'no horizontal overflow');
      await page.screenshot({ path: `.expo/review-tools-${width}.png` });
    }
    assert.deepEqual(errors, []); assert.deepEqual(warnings, []);
    console.log('PASS: first-use slides, protected deep links, real signup request, restored account, square tools at four widths. Firebase responses were mocked; no real account created.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
