const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  console.log('Navigating to https://partybot.games/play...');
  await page.goto('https://partybot.games/play', { waitUntil: 'networkidle2' });
  
  const gameTitles = await page.$$eval('#panel-games .card-title', elements => elements.map(el => el.textContent.trim()));
  console.log('Visible Games on Play page:', gameTitles);

  const excluded = ['Pass & Guess', 'Draw & Rush', 'Truth & Dare', 'Pass Guess', 'Draw Rush', 'Truth or Dare'];
  const foundExcluded = gameTitles.filter(t => excluded.includes(t));
  console.log('Excluded games found (should be empty):', foundExcluded);

  await browser.close();
})();
