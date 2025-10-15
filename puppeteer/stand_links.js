// Collect first 5 car detail links from Standvirtual listings
function getPuppeteer() {
  try {
    const ppe = require('puppeteer-extra');
    try {
      const StealthPlugin = require('puppeteer-extra-plugin-stealth');
      ppe.use(StealthPlugin());
    } catch (_) {}
    return ppe;
  } catch (_) {
    return require('puppeteer');
  }
}

const fs = require('fs');
const puppeteer = getPuppeteer();

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--lang=pt-PT',
      '--window-size=1366,900'
    ]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  // Realistic UA/headers
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  await page.setUserAgent(userAgent);
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7' });
  if (typeof page.emulateTimezone === 'function') {
    try { await page.emulateTimezone('Europe/Lisbon'); } catch (_) {}
  }

  const url = 'https://www.standvirtual.com/carros/audi--ford--kia--peugeot--renault--seat--skoda?search%5Bfilter_float_price%3Ato%5D=19000&search%5Border%5D=created_at%3Adesc';
  const t0 = Date.now();
  const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  if (resp && resp.status() === 403) {
    console.warn('Aviso: resposta 403 (pode ser anti-bot).');
  }
  await page.waitForSelector('body', { timeout: 20000 });
  try { await page.waitForSelector('[data-testid="search-loading-indicator"]', { hidden: true, timeout: 60000 }); } catch {}

  // Accept cookies if present
  try {
    const cookieSelectors = [
      '#onetrust-accept-btn-handler',
      'button#onetrust-accept-btn-handler',
      'button[data-testid="uc-accept-all-button"]',
      'button[aria-label="Aceitar"], button[aria-label="Aceitar todos"]'
    ];
    for (const sel of cookieSelectors) {
      const btn = await page.$(sel);
      if (btn) { await btn.click(); break; }
    }
  } catch {}

  await page.waitForSelector('[data-testid="search-results"] article[data-id]', { timeout: 40000 });
  const articles = await page.$$('[data-testid="search-results"] article[data-id]');
  const take = Math.min(15, articles.length);
  console.log(`Encontrados ${articles.length} anúncios. A recolher ${take} links...`);

  const links = {};
  for (let i = 0; i < take; i++) {
    const label = `car${i + 1}`;
    const art = articles[i];
    try { await art.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' })); } catch {}
    // Espera breve pelo link dentro do artigo (para lidar com hidratação/virtualização)
    try {
      await art.waitForSelector('h2 a[href*="/carros/anuncio/"], div[hidden] a[href*="/carros/anuncio/"], [data-testid="carousel-container"] a[href*="/carros/anuncio/"], a[href*="/carros/anuncio/"]', { timeout: 5000 });
    } catch {}

    let href = null;
    // Preferir o link do título
    try {
      href = await art.$eval('h2 a[href*="/carros/anuncio/"]', a => a.href);
    } catch {}
    // Fallback para link escondido sempre presente
    if (!href) {
      try { href = await art.$eval('div[hidden] a[href*="/carros/anuncio/"]', a => a.href); } catch {}
    }
    // Fallback para link no carrossel
    if (!href) {
      try { href = await art.$eval('[data-testid="carousel-container"] a[href*="/carros/anuncio/"]', a => a.href); } catch {}
    }
    // Fallback genérico
    if (!href) {
      try { href = await art.$eval('a[href*="/carros/anuncio/"]', a => a.href); } catch {}
    }
    links[label] = href || '';
    console.log(`${label}: ${href || 'link não encontrado'}`);
  }

  try {
    await fs.promises.writeFile('car_links.json', JSON.stringify(links, null, 2), 'utf-8');
    console.log('Ficheiro salvo: ./car_links.json');
  } catch (e) {
    console.error('Falha ao guardar car_links.json:', e?.message || e);
  }

  const totalMs = Date.now() - t0;
  console.log(`Tempo total: ${totalMs}ms`);

  await browser.close();
})().catch((err) => {
  console.error('Erro ao recolher links:', err);
  process.exit(1);
});
