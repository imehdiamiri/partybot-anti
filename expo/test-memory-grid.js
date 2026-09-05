const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  console.log('Navigating to https://partybot.games/game/memory_grid...');
  await page.goto('https://partybot.games/game/memory_grid', { waitUntil: 'networkidle2' });
  
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: 'memory_grid_loaded.png' });
  
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Page body snippet:', bodyText.substring(0, 300));
  
  if (bodyText.includes('Something went wrong') || bodyText.includes('resolveAssetSource')) {
    console.log('FAILED: Error still visible on page!');
  } else {
    console.log('SUCCESS: Memory Grid loaded without error!');
  }

  await browser.close();
})();
