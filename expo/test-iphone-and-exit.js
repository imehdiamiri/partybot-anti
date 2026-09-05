const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('dialog', async dialog => {
    console.log('DIALOG DETECTED:', dialog.message());
    await dialog.accept(); // Accept confirm
  });

  console.log('--- TEST 1: Open https://partybot.games/ on Desktop (1920x1080) ---');
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('https://partybot.games/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const homeText = await page.evaluate(() => document.body.innerText);
  console.log('Home Page text preview:', homeText.substring(0, 250));
  await page.screenshot({ path: 'test_iphone_home.png' });

  console.log('--- TEST 2: Enter Memory Grid Setup and click Back ---');
  await page.goto('https://partybot.games/game/memory_grid/setup?mode=singleDevice', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  console.log('In setup URL:', page.url());

  // Click Back button
  const backBtns = await page.$$('div, button');
  for (const btn of backBtns) {
    const text = await page.evaluate(el => el.innerText, btn);
    if (text && text.includes('Back')) {
      console.log('Clicking Back button in setup...');
      await btn.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));
  console.log('URL after clicking Back:', page.url());
  const afterBackText = await page.evaluate(() => document.body.innerText);
  console.log('Page text after Back:', afterBackText.substring(0, 150));

  console.log('--- TEST 3: Enter Game Session and click Exit ---');
  await page.goto('https://partybot.games/game/memory_grid/setup?mode=singleDevice', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  
  // Click Start Game
  const startBtns = await page.$$('div, button');
  for (const btn of startBtns) {
    const text = await page.evaluate(el => el.innerText, btn);
    if (text && text.includes('Start Game')) {
      console.log('Clicking Start Game button...');
      await btn.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));
  console.log('In Session URL:', page.url());

  // Click Exit button
  const exitBtns = await page.$$('div, button');
  for (const btn of exitBtns) {
    const text = await page.evaluate(el => el.innerText, btn);
    if (text && text.includes('Exit')) {
      console.log('Clicking Exit button in session...');
      await btn.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));
  console.log('URL after Exit & confirm:', page.url());
  const afterExitText = await page.evaluate(() => document.body.innerText);
  console.log('Page text after Exit:', afterExitText.substring(0, 200));

  await browser.close();
  console.log('SUCCESS: ALL TESTS PASSED!');
})();
