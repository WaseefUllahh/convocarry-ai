const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:5173/screenshots/copy-fallback', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'assets/chrome-store/copy-fallback.png' });
  await browser.close();
  console.log('Screenshot exported to assets/chrome-store/copy-fallback.png');
})();
