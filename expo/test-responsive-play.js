const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  console.log('--- TEST 1: Desktop Viewport (1920x1080) on https://partybot.games/play ---');
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('https://partybot.games/play', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));

  const desktopText = await page.evaluate(() => document.body.innerText);
  console.log('Desktop Play Page Text snippet:', desktopText.substring(0, 300));
  await page.screenshot({ path: 'desktop_play_frame.png' });

  console.log('--- TEST 2: Check phone frame dimensions ---');
  const frameInfo = await page.evaluate(() => {
    const root = document.getElementById('root');
    return {
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      rootWidth: root ? root.offsetWidth : 0,
      rootHeight: root ? root.offsetHeight : 0,
    };
  });
  console.log('Frame Info:', frameInfo);

  console.log('--- TEST 3: Navigating to Home https://partybot.games/ and clicking "Play Online" ---');
  await page.goto('https://partybot.games/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  
  const playButton = await page.$('a[href="/play"]');
  if (playButton) {
    console.log('Clicking Play Online button on home page...');
    await playButton.click();
    await new Promise(r => setTimeout(r, 2000));
    console.log('Current URL after click:', page.url());
  }

  await browser.close();
  console.log('ALL TESTS COMPLETED!');
})();
