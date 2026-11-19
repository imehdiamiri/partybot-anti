// Static export verification: every request is intercepted; no server or real account.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');
const root = path.resolve(process.env.EXPO_REVIEW_DIR || '.expo/layout-review');
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
    await click('onboarding-continue');
    await page.waitForSelector('[data-testid="auth-username"], [data-testid="web-install-continue"]');
    if (await page.$('[data-testid="web-install-continue"]')) await click('web-install-continue');
    await page.waitForSelector('[data-testid="auth-username"]');
    await page.type('[data-testid="auth-username"]','layout-review');
    await page.type('[data-testid="auth-password"]','test-password-only');await click('auth-submit');
    await page.waitForSelector('[data-testid="games-grid"]');
    const games=await page.$$eval('[data-testid^="game-card-"]:not([data-testid^="game-card-touch-"])',es=>es.map(e=>e.dataset.testid.replace('game-card-','')));
    assert.deepEqual(games.slice(-2),['pass_guess','ten_tangle']);
    await page.goto('https://layout.invalid/tools',{waitUntil:'networkidle0'});
    await page.waitForSelector('[data-testid^="cards-category-"]');
    const categories=await page.$$eval('[data-testid^="cards-category-"]',es=>es.map(e=>e.dataset.testid.replace('cards-category-','')));
    // Resize the mounted screen as well as testing fresh route entries below.
    for (const width of [320, 360, 375, 390, 430, 768, 844, 1440]) {
      await page.setViewport({width, height: width === 844 ? 390 : 844});
      await page.waitForFunction(w => innerWidth === w, {}, width);
      const tiles = await page.$$eval('[data-testid^="tool-card-"]', elements => elements.map(el => {
        const rect = el.getBoundingClientRect();
        const label = [...el.querySelectorAll('*')].find(child =>
          child.childElementCount === 0 && child.textContent === el.getAttribute('aria-label'));
        const box = label?.getBoundingClientRect();
        return {x:rect.x, y:rect.y, width:rect.width, height:rect.height,
          labelFits: !!box && box.top >= rect.top && box.bottom <= rect.bottom + 1
            && label.scrollHeight <= label.clientHeight + 1 && label.scrollWidth <= label.clientWidth + 1};
      }));
      assert.equal(tiles.length, 6);
      tiles.forEach((tile, i) => {
        assert(Math.abs(tile.width - tile.height) <= 1 && tile.width >= 44, 'square touch target at '+width);
        assert(tile.labelFits, 'tool label fits at '+width);
        assert(Math.abs(tile.y - tiles[i < 3 ? 0 : 3].y) <= 1, 'three tools per row at '+width);
        assert(Math.abs(tile.x - tiles[i % 3].x) <= 1, 'columns align at '+width);
        if (i % 3) assert(tile.x > tiles[i-1].x + tiles[i-1].width, 'column gap at '+width);
      });
      assert(tiles[3].y > tiles[0].y + tiles[0].height, 'separate tool rows at '+width);
      if (width === 320 || width === 390) await page.screenshot({path:'.expo/review-tools-'+width+'.png'});
    }
    async function header(width, route){
      const box=await page.evaluate(()=>{
        const h=[...document.querySelectorAll('[data-testid="screen-header"]')].find(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.left>=-1&&r.right<=innerWidth+1;});
        if(!h)return null;
        const r=h.getBoundingClientRect(),title=h.querySelector('[data-testid="screen-header-title"]'),t=title.getBoundingClientRect();
        return {left:r.left,right:r.right,center:t.left+t.width/2,titleClipped:title.scrollHeight>title.clientHeight+1,buttons:[...h.querySelectorAll('[role="button"]')].map(e=>{const b=e.getBoundingClientRect();return {left:b.left,right:b.right,height:b.height,width:b.width};})};
      });
      assert(box,route+' has a visible shared header');
      assert(Math.abs(box.center-width/2)<1.1,route+' centered title');
      assert(!box.titleClipped,route+' title is not vertically clipped');
      assert(box.left>=-1&&box.right<=width+1,route+' bounded header');
      assert(box.buttons.every(b=>b.height>=44&&b.width>=44&&b.left>=box.left&&b.right<=box.right),route+' accessible bounded navigation targets');
      return box;
    }
    const reviewed=[];
    const viewports=process.env.LAYOUT_REVIEW_VIEWPORTS?JSON.parse(process.env.LAYOUT_REVIEW_VIEWPORTS):[[320,568],[390,844],[844,390],[768,1024],[1440,900],[2560,1440]];
    for(const [width,height] of viewports){
      await page.setViewport({width,height});
      await page.goto('https://layout.invalid/',{waitUntil:'networkidle0'});await page.waitForSelector('[data-testid="games-grid"]');
      const align=await page.evaluate(()=>{
        const rect=id=>{const r=document.querySelector('[data-testid="'+id+'"]').getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};};
        return {grid:rect('games-grid'),logo:rect('home-logo-img'),profile:rect('home-profile-btn')};
      });
      assert(Math.abs(align.logo.left-align.grid.left)<1.1,'logo aligned to grid at '+width);
      assert(Math.abs(align.profile.right-align.grid.right)<1.1,'profile aligned to grid at '+width);
      assert(align.profile.height>=44,'profile target');
      assert(await page.$$eval('[data-testid="library-card-title"]',es=>es.every(e=>e.scrollHeight<=e.clientHeight+1)),'library titles fit two lines at '+width);
      await page.screenshot({path:'.expo/review-library-'+width+'.png'});
      // All setup routes at phone and desktop widths; representative ones elsewhere.
      const ids=[320,390,1440].includes(width)?games:['drum_challenge','color_match','sound_match'];
      for(const game of ids){
        await page.goto('https://layout.invalid/game/'+game+'/setup',{waitUntil:'networkidle0'});await page.waitForSelector('[data-testid="setup-start-button"]');
        await header(width,game+' setup');
        const geometry=await page.evaluate(()=>{
          const rect=id=>{const r=document.querySelector('[data-testid="'+id+'"]').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height};};
          const card=rect('setup-players-card');
          const buttons=[...document.querySelector('[data-testid="setup-players-card"]').querySelectorAll('[role="button"]')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};});
          return {card,buttons,footer:rect('setup-start-button'),back:rect('setup-back-btn'),scroll:rect('setup-scroll')};
        });
        assert(Math.abs(geometry.card.left-geometry.back.left)<1.1,game+' back matches content gutter');
        assert(geometry.buttons.every(b=>b.left>=geometry.card.left&&b.right<=geometry.card.right&&b.height>=44),game+' player controls remain inside their card');
        assert(Math.abs(geometry.footer.left-geometry.card.left)<1.1&&Math.abs(geometry.footer.right-geometry.card.right)<1.1,game+' start footer matches cards');
        assert(geometry.footer.bottom<=height+1&&geometry.footer.top>=geometry.scroll.bottom-1,game+' footer visible without overlapping scroller');
        assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),game+' no document overflow');
        reviewed.push(width+':'+game);
        if(game==='drum_challenge')await page.screenshot({path:'.expo/review-setup-'+width+'.png'});
      }
      await page.goto('https://layout.invalid/friends',{waitUntil:'networkidle0'});
      await page.waitForSelector('[data-testid="friends-scroll"]');
      const segments = await page.$$eval('[data-testid^="friends-segment-"]', elements =>
        elements.map(element => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && box.left >= 0 && box.right <= innerWidth + 1
            && element.scrollWidth <= element.clientWidth + 1;
        }));
      assert(segments.length > 0 && segments.every(Boolean), 'friends tabs fit at '+width);
      const detailGames = [320,1440].includes(width) ? games : ['color_match'];
      for(const route of [...detailGames.map(id=>'/game/'+id),'/dice','/bottle','/hourglass','/coin','/wheel','/teams','/profile','/invite','/paywall','/purchase-detail',...categories.map(id=>'/cards/'+id)]){
        await page.goto('https://layout.invalid'+route,{waitUntil:'networkidle0'});
        await page.waitForSelector('[data-testid="screen-header"]');await header(width,route);
      }
      if([320,1440].includes(width)) for(const game of games){
        await page.goto('https://layout.invalid/game/'+game+'/setup',{waitUntil:'networkidle0'});
        await click('setup-start-button');await page.waitForSelector('[data-testid="session-exit-button"]');
        await header(width,game+' session');
        await click('session-exit-button');await click('action-cancel');
        assert(page.url().includes('/session'),game+' cancel keeps session');
        await click('session-exit-button');await click('action-confirm');
        await page.waitForSelector('[data-testid="games-grid"]');
      }
      console.log(width+'x'+height+': library alignment, setup headers/footers and menu headers PASS');
    }
    assert.deepEqual(errors,[]);
    console.log('PASS '+reviewed.length+' setup viewport cases. Offline mock identity; no real account/server/native device.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
