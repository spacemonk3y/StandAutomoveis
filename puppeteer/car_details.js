// Extract car details from Standvirtual ad pages
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
const path = require('path');
const puppeteer = getPuppeteer();
const scriptDir = __dirname;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { url: null, file: 'car_links.json', limit: null };
  for (const a of args) {
    if (a.startsWith('--url=')) opts.url = a.substring(6);
    else if (a.startsWith('--file=')) opts.file = a.substring(7);
    else if (a.startsWith('--limit=')) {
      const n = parseInt(a.substring(8), 10);
      if (!isNaN(n) && n > 0) opts.limit = n;
    }
  }
  return opts;
}

async function ensureCookieAccepted(page) {
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
}

async function collectImages(page) {
  const seen = new Set();
  const takeFromNodes = async () => {
    const urls = await page.$$eval('[data-testid="main-gallery"] img', nodes => {
      const acc = [];
      for (const img of nodes) {
        let src = img.currentSrc || img.src || null;
        if (!src) {
          const srcset = img.getAttribute('srcset');
          if (srcset) {
            const parts = srcset.split(',').map(s => s.trim());
            const last = parts[parts.length - 1]?.split(' ')[0];
            if (last) src = last;
          }
        }
        if (src) acc.push(src);
      }
      return acc;
    });
    for (const u of urls) seen.add(u);
  };

  await takeFromNodes();
  let stable = 0;
  for (let i = 0; i < 20 && stable < 3; i++) {
    const before = seen.size;
    try {
      // Click next arrow if present
      const clicked = await page.evaluate(() => {
        const next = document.querySelector('[data-testid="next-arrow"], .embla__button--next');
        if (next) { (next instanceof HTMLElement ? next : next.parentElement)?.click(); return true; }
        return false;
      });
      if (!clicked) break;
    } catch {}
    try { await page.waitForTimeout(200); } catch {}
    await takeFromNodes();
    const after = seen.size;
    if (after === before) stable++; else stable = 0;
  }
  return Array.from(seen);
}

async function extractDetails(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('body', { timeout: 15000 });
  await ensureCookieAccepted(page);
  try { await page.waitForSelector('[data-testid="photo-gallery"], h1.offer-title', { timeout: 10000 }); } catch {}
  // Expand key accordions to ensure content is in DOM
  try {
    await page.evaluate(() => {
      const expandById = (id) => {
        const anchor = document.getElementById(id);
        if (!anchor) return;
        const btn = anchor.closest('button');
        if (btn && btn.getAttribute('aria-expanded') === 'false') {
          btn.click();
        }
      };
      expandById('technical_specs');
      expandById('condition_history');
    });
  } catch {}

  const base = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      return el ? (el.textContent || '').trim() : '';
    };
    // Title and price
    const title = pick('h1.offer-title');
    const priceNumber = pick('.offer-price__number');
    const priceCurrency = pick('.offer-price__currency');

    // Helper for data-testid blocks: return {label, value}
    const pairByTestId = (tid) => {
      const wrap = document.querySelector(`[data-testid="${tid}"]`);
      if (!wrap) return { label: '', value: '' };
      const ps = Array.from(wrap.querySelectorAll('p'));
      if (ps.length === 0) {
        const txt = (wrap.textContent || '').trim();
        return { label: tid, value: txt };
      }
      // Heuristic: first <p> is label, last <p> is value
      const label = (ps[0].textContent || '').trim();
      const value = (ps[ps.length - 1].textContent || '').trim();
      return { label, value };
    };

    const tids = [
      'make','model','version','color','door_count','nr_seats',
      'engine_capacity','engine_power','fuel_type','body_type','gearbox','transmission',
      'mileage','first_registration_month','first_registration_year'
    ];
    const fields_pt = {};
    const normalized = {};
    for (const tid of tids) {
      const { label, value } = pairByTestId(tid);
      if (label && value) fields_pt[label] = value;
      // Normalized keys with safer mapping
      switch (tid) {
        case 'make': normalized.make = value; break;
        case 'model': normalized.model = value; break;
        case 'version': normalized.version = value; break;
        case 'color': normalized.color = value; break;
        case 'door_count': normalized.doors = value; break;
        case 'nr_seats': normalized.seats = value; break;
        case 'engine_capacity': normalized.engine_capacity = value; break;
        case 'engine_power': normalized.engine_power = value; break;
        case 'fuel_type': normalized.fuel_type = value; break;
        case 'body_type': normalized.body_type = value; break;
        case 'gearbox': normalized.gearbox = value; break;
        case 'transmission': normalized.transmission = value; break;
        case 'mileage': normalized.mileage = value; break;
        case 'first_registration_month': normalized.registration_month = value; break;
        case 'first_registration_year': normalized.registration_year = value; break;
      }
    }

    // Include high-level fields
    normalized.title = title;
    normalized.priceNumber = priceNumber;
    normalized.priceCurrency = priceCurrency;
    fields_pt['Título'] = title;
    if (priceNumber) fields_pt['Preço'] = priceNumber + (priceCurrency ? ` ${priceCurrency}` : '');

    return { normalized, fields_pt };
  });

  // Images (try to collect several)
  const images = await collectImages(page);
  return { url, ...base.normalized, images };
}

(async () => {
  const opts = parseArgs();
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
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  await page.setUserAgent(userAgent);
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7' });
  if (typeof page.emulateTimezone === 'function') {
    try { await page.emulateTimezone('Europe/Lisbon'); } catch (_) {}
  }

  const started = Date.now();
  let links = [];
  if (opts.url) {
    links = [opts.url];
  } else {
    // Simplificação: lê sempre do mesmo diretório onde está o script,
    // a menos que --file seja absoluto.
    const wanted = opts.file || 'car_links.json';
    const filePath = path.isAbsolute(wanted)
      ? wanted
      : path.resolve(scriptDir, wanted);
    if (!fs.existsSync(filePath)) {
      console.error(`Ficheiro não encontrado: ${filePath}`);
      process.exit(1);
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const json = JSON.parse(raw);
      if (Array.isArray(json)) {
        links = json.filter(Boolean);
      } else if (json && typeof json === 'object') {
        links = Object.values(json).filter(Boolean);
      } else {
        throw new Error('Formato de JSON inesperado (esperado objeto ou array)');
      }
      console.log(`A ler ${links.length} link(s) de: ${filePath}`);
    } catch (e) {
      console.error(`Falha a ler ${filePath}:`, e?.message || e);
      process.exit(1);
    }
    if (opts.limit) links = links.slice(0, opts.limit);
  }

  console.log(`A processar ${links.length} link(s)...`);
  const results = {};
  let idx = 0;
  for (const link of links) {
    idx++;
    const label = `car${idx}`;
    const t0 = Date.now();
    try {
      const details = await extractDetails(page, link);
      results[label] = details;
      console.log(`${label}: ok (${Date.now() - t0}ms)`);
    } catch (e) {
      console.warn(`${label}: erro ${e?.message || e}`);
      results[label] = { url: link, error: e?.message || String(e) };
    }
  }

  // Simplificação: escreve sempre no diretório do script
  const outPath = path.resolve(scriptDir, 'car_details.json');
  try {
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`Ficheiro salvo: ${path.basename(outPath)}`);
  } catch (e) {
    console.error('Falha ao guardar car_details.json:', e?.message || e);
  }

  console.log(`Tempo total: ${Date.now() - started}ms`);
  await browser.close();
})().catch((err) => {
  console.error('Erro ao extrair detalhes:', err);
  process.exit(1);
});
