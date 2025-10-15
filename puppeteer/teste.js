const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: puppeteer.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // 👈 estas duas flags resolvem
  });

  const page = await browser.newPage();
  await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForNetworkIdle({ idleTime: 1000, timeout: 15000 });

  const title = await page.title();
  console.log('Título da página:', title);

  // Guardar screenshot na pasta partilhada (working_dir = /puppeteer)
  await page.screenshot({ path: 'example.png' });
  console.log('Screenshot guardada em ./example.png');

  await browser.close();
})();
