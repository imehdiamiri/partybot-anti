const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  console.log('Navigating to setup: https://partybot.games/game/memory_grid/setup?mode=singleDevice');
  await page.goto('https://partybot.games/game/memory_grid/setup?mode=singleDevice', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  const setupText = await page.evaluate(() => document.body.innerText);
  console.log('Setup text:', setupText.substring(0, 300));
  
  await browser.close();
})();
