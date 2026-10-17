// Static export verification: every request is intercepted; no server or real account.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');
const root = path.resolve(process.env.EXPO_REVIEW_DIR || '.expo/card-review');
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
      if ((!fs.existsSync(file) || fs.statSync(file).isDirectory()) && !path.extname(file)) file += '.html';
      if (!fs.existsSync(file)) file = path.join(root, 'index.html');
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
      void request.respond({ status: 200, contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    });

    const click=async id=>{await page.waitForSelector('[data-testid="'+id+'"]');await page.click('[data-testid="'+id+'"]');};
    await page.goto('https://layout.invalid/onboarding',{waitUntil:'networkidle0'});
    for(let i=0;i<2;i++){await click('onboarding-continue');await wait(500);}
    await page.type('[data-testid="onboarding-name"]','UI Reviewer');
    await click('onboarding-continue');await wait(500);await click('onboarding-continue');
    await page.waitForSelector('[data-testid="auth-username"]');
    await page.type('[data-testid="auth-username"]','layout-review');
    await page.type('[data-testid="auth-password"]','test-password-only');await click('auth-submit');
    await page.waitForSelector('[data-testid="games-grid"]');
    let transitions = 0;
    for (const [width, height] of [[320,568],[390,844],[1440,900]]) {
      await page.setViewport({width,height});
      for (const category of ['act','talk','challenges','penalty','couple','mostLikelyTo']) {
        await page.goto('https://layout.invalid/cards/'+category,{waitUntil:'networkidle0'});
        await page.waitForSelector('[data-testid="stack-card-1"]');
        for (const translated of [false,true]) {
          if (translated) await click('card-language-fa');
          const result = await page.evaluate(async () => {
            const preview = document.querySelector('[data-testid="stack-card-1"]');
            const face = preview.querySelector('[data-testid^="card-face-"]');
            const text = preview.querySelector('[data-testid^="card-preview-text-"]');
            const geometry = () => ({top:text.offsetTop,height:text.offsetHeight,area:text.parentElement.clientHeight,content:text.parentElement.scrollHeight});
            const before = geometry(), faceID = face.dataset.testid;
            const inaccessible = preview.getAttribute('aria-hidden') === 'true';
            const buttons = [...preview.querySelectorAll('[role="radio"]')];
            const previewControls = buttons.length===5 && buttons.every(b=>b.tabIndex===-1);
            const frontTranslation = !!document.querySelector('[data-testid="card-translation-text"]');
            const previewTranslation = !!preview.querySelector('[aria-live="off"]');
            const frames = [];
            document.querySelector('[data-testid="deck-next-button"]').click();
            const started = performance.now();
            while (performance.now()-started < 900) {
              await new Promise(requestAnimationFrame);
              frames.push(geometry());
            }
            const front = document.querySelector('[data-testid="front-card"]');
            return {before,after:geometry(),frames,faceID,promotedID:front.querySelector('[data-testid^="card-face-"]').dataset.testid,
              sameNode:front.contains(text)&&text.isConnected,inaccessible,previewControls,frontTranslation,previewTranslation,
              interactive:front.querySelectorAll('[data-testid^="card-language-"]').length===5,
              singleEnglish:document.querySelectorAll('[data-testid="card-english-text"]').length===1};
          });
          assert.equal(result.promotedID,result.faceID,'the preview card is promoted');
          assert(result.sameNode,'the same text node remains mounted');
          assert(result.inaccessible && result.previewControls,'background controls are not focusable or announced');
          assert(result.interactive && result.singleEnglish,'only front controls become active');
          assert.equal(result.frontTranslation,translated);
          if (translated) assert(result.previewTranslation,'selected translation is already laid out behind');
          for (const frame of [...result.frames,result.after]) for (const key of ['top','height','area','content']) {
            assert(Math.abs(frame[key]-result.before[key])<1.1,category+' text '+key+' jumps at '+width+': '+JSON.stringify(result));
          }
          transitions++;
        }
        // Returning to the previous card remains available after promotion.
        await click('deck-previous-button'); await wait(550);
        assert(await page.$('[data-testid="front-card"]'));
      }
      await page.screenshot({path:'.expo/review-card-motion-'+width+'.png'});
      console.log(width+'x'+height+': stable text geometry throughout 12 transitions PASS');
    }
    assert.deepEqual(errors,[]);
    console.log('PASS '+transitions+' card promotions across six decks, English/Persian and three viewports. Offline mocked identity; no account/server/native device.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
