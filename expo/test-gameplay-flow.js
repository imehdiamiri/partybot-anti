const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  console.log('1. Navigating to https://partybot.games/game/memory_grid...');
  await page.goto('https://partybot.games/game/memory_grid', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  console.log('2. Clicking "1 Phone" mode...');
  // Find element containing "1 Phone" and click it
  const modeCards = await page.$$('div, button');
  let clicked = false;
  for (const card of modeCards) {
    const text = await page.evaluate(el => el.innerText, card);
    if (text && text.includes('1 Phone') && text.includes('Everyone plays on 1 phone')) {
      await card.click();
      clicked = true;
      break;
    }
  }

  if (clicked) {
    console.log('Mode card clicked! Waiting for setup/session navigation...');
    await new Promise(r => setTimeout(r, 2000));
    console.log('Current URL:', page.url());
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('Setup / Game Page Text snippet:', bodyText.substring(0, 300));
    
    // If there is a Start button, click it
    const buttons = await page.$$('div, button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.innerText, btn);
      if (text && (text === 'Start Game' || text === 'Start' || text === 'Play' || text === "Let's Play")) {
        console.log('Clicking Start button...');
        await btn.click();
        break;
      }
    }
    
    await new Promise(r => setTimeout(r, 2000));
    console.log('After Start URL:', page.url());
    const gamePlayText = await page.evaluate(() => document.body.innerText);
    console.log('Active Gameplay Text snippet:', gamePlayText.substring(0, 300));
    await page.screenshot({ path: 'memory_grid_gameplay.png' });
  }

  await browser.close();
})();
