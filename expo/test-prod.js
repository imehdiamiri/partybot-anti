const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText || request.response()?.status()));
  page.on('response', response => {
    if (!response.ok()) {
      console.log('RESPONSE FAILED:', response.url(), response.status());
    }
  });

  console.log('Navigating to https://partybot.games/game/memory_grid...');
  await page.goto('https://partybot.games/game/memory_grid', { waitUntil: 'networkidle2' });
  
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'screenshot_prod.png' });
  console.log('Done.');
  await browser.close();
})();
