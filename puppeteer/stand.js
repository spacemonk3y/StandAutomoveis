// Try to use puppeteer-extra + stealth if installed; fall back to puppeteer
function getPuppeteer() {
  try {
    const ppe = require('puppeteer-extra');
    try {
      const StealthPlugin = require('puppeteer-extra-plugin-stealth');
      ppe.use(StealthPlugin());
    } catch (_) {
      // stealth plugin not installed; continue without it
    }
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
  // Use a realistic UA and headers
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  await page.setUserAgent(userAgent);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7'
  });
  if (typeof page.emulateTimezone === 'function') {
    try { await page.emulateTimezone('Europe/Lisbon'); } catch (_) {}
  }

  const url = 'https://www.standvirtual.com/carros';
  const t0 = Date.now();
  const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  if (resp && resp.status() === 403) {
    console.warn('Aviso: resposta 403 ao abrir a página (pode ser anti-bot).');
  }
  await page.waitForSelector('body', { timeout: 20000 });
  // Espera o loader terminar, se existir
  try {
    await page.waitForSelector('[data-testid="search-loading-indicator"]', { hidden: true, timeout: 60000 });
  } catch {}

  // Tenta aceitar cookies se o botão existir (não falha se não existir)
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

  // Aguarda resultados e garante que o primeiro anúncio e imagens do carrossel estão presentes
  await page.waitForSelector('[data-testid="search-results"] article', { timeout: 40000 });
  // Traz o primeiro anúncio para a área visível (algumas imagens só carregam em viewport)
  await page.$eval('[data-testid="search-results"] article', el => el.scrollIntoView({behavior: 'instant', block: 'center'}));
  // Aguarda até haver imagens no carrossel do primeiro anúncio (tolerante a timeout)
  let carouselReady = false;
  try {
    await page.waitForFunction(() => {
      const res = document.querySelector('[data-testid="search-results"]');
      const art = res?.querySelector('article');
      const car = art?.querySelector('[data-testid] [data-testid="carousel-container"], [data-testid="carousel-container"]');
      return !!car && car.querySelectorAll('img').length > 0;
    }, { timeout: 45000 });
    carouselReady = true;
  } catch {
    // segue para fallback mesmo sem imagens visíveis no carrossel
  }
  // Pequena folga para lazy-load/intersection
  try { await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }); } catch {}

  // Extrai as imagens do primeiro anúncio (carrossel)
  let imageUrls = await page.evaluate(() => {
    const res = document.querySelector('[data-testid="search-results"]');
    if (!res) return [];
    const firstArticle = res.querySelector('article');
    if (!firstArticle) return [];
    const collect = (root) => {
      const urls = [];
      const imgs = Array.from(root.querySelectorAll('img'));
      for (const img of imgs) {
        // Restrito ao artigo principal (evita logos dentro de artigos aninhados)
        const ownerArticle = img.closest('article');
        if (ownerArticle && ownerArticle !== firstArticle) continue;
        let src = img.currentSrc || img.src || img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
        if (!src) {
          const srcset = img.getAttribute('srcset');
          if (srcset) {
            const first = srcset.split(',')[0]?.trim().split(' ')[0];
            if (first) src = first;
          }
        }
        if (!src) continue;
        try {
          const abs = new URL(src, location.href).href;
          // Ignora ícone de "ver mais" do carrossel e imagens que não são do CDN esperado
          if (/\/listing\/gallery-cta\.svg$/i.test(abs)) continue;
          if (!/ireland\.apollo\.olxcdn\.com\/v1\/files\/.+\/image/i.test(abs)) continue;
          // Filtra imagens pequenas (logos), mantendo thumbnails/fotos
          const rect = img.getBoundingClientRect();
          if (rect.width < 160 || rect.height < 120) continue;
          if (!urls.includes(abs)) urls.push(abs);
        } catch {}
      }
      return urls;
    };
    const carousel = firstArticle.querySelector('[data-testid="carousel-container"]');
    const fromCarousel = carousel ? collect(carousel) : [];
    if (fromCarousel.length > 0) return fromCarousel;
    return collect(firstArticle);
  });

  // Fallback: se vazio, tenta clicar no primeiro indicador do carrossel e recolher de novo
  if (!imageUrls || imageUrls.length === 0) {
    try {
      await page.click('[data-testid="search-results"] article [data-testid^="indicator-"] button');
      await page.waitForNetworkIdle({ idleTime: 600, timeout: 8000 });
    } catch {}
    const secondTry = await page.evaluate(() => {
      const res = document.querySelector('[data-testid="search-results"]');
      const firstArticle = res?.querySelector('article');
      if (!firstArticle) return [];
      const collect = (root) => {
        const urls = [];
        const imgs = Array.from(root.querySelectorAll('img'));
        for (const img of imgs) {
          const ownerArticle = img.closest('article');
          if (ownerArticle && ownerArticle !== firstArticle) continue;
          let src = img.currentSrc || img.src || img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
          if (!src) {
            const srcset = img.getAttribute('srcset');
            if (srcset) {
              const first = srcset.split(',')[0]?.trim().split(' ')[0];
              if (first) src = first;
            }
          }
          if (!src) continue;
          try {
            const abs = new URL(src, location.href).href;
            if (/\/listing\/gallery-cta\.svg$/i.test(abs)) continue;
            if (!/ireland\.apollo\.olxcdn\.com\/v1\/files\/.+\/image/i.test(abs)) continue;
            const rect = img.getBoundingClientRect();
            if (rect.width < 160 || rect.height < 120) continue;
            if (!urls.includes(abs)) urls.push(abs);
          } catch {}
        }
        return urls;
      };
      const carousel = firstArticle.querySelector('[data-testid="carousel-container"]');
      const fromCarousel = carousel ? collect(carousel) : [];
      if (fromCarousel.length > 0) return fromCarousel;
      return collect(firstArticle);
    });
    if (secondTry && secondTry.length > 0) {
      imageUrls = secondTry;
      console.log('Imagens (tentativa 2):', secondTry);
    }
  }

  // Fallback final: abrir a página do anúncio e extrair lá
  if (!imageUrls || imageUrls.length === 0) {
    try {
      const firstLink = await page.$eval('[data-testid="search-results"] article a[href*="/carros/anuncio/"]', a => a.href);
      if (firstLink) {
        await page.goto(firstLink, { waitUntil: 'networkidle2', timeout: 60000 });
        try { await page.waitForSelector('body', { timeout: 10000 }); } catch {}
        try { await page.waitForNetworkIdle({ idleTime: 800, timeout: 12000 }); } catch {}
        const detailImgs = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('img'));
          const urls = [];
          for (const img of imgs) {
            let src = img.currentSrc || img.src || img.getAttribute('src') || img.getAttribute('data-src');
            if (!src) continue;
            try {
              const abs = new URL(src, location.href).href;
              if (!/ireland\.apollo\.olxcdn\.com\/v1\/files\/.+\/image/i.test(abs)) continue;
              const rect = img.getBoundingClientRect();
              if (rect.width < 160 || rect.height < 120) continue;
              if (!urls.includes(abs)) urls.push(abs);
            } catch {}
          }
          return urls;
        });
        if (detailImgs && detailImgs.length > 0) {
          imageUrls = detailImgs;
          console.log('Imagens (detalhe):', detailImgs);
        }
      }
    } catch {}
  }

  console.log('Imagens do primeiro anúncio:', imageUrls);
  // Screenshot opcional para depuração
  try {
    await page.screenshot({ path: 'standscreen.png', fullPage: true });
    console.log('Screenshot guardada em ./standscreen.png');
  } catch (e) {
    console.warn('Não foi possível tirar screenshot:', e?.message || e);
  }

  // ========= Coleta imagens para os primeiros 10 anúncios e mede performance =========
  try {
    if (!page.url().startsWith(url)) {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      try { await page.waitForSelector('body', { timeout: 15000 }); } catch {}
      try { await page.waitForSelector('[data-testid="search-loading-indicator"]', { hidden: true, timeout: 30000 }); } catch {}
    }

    await page.waitForSelector('[data-testid="search-results"] article', { timeout: 40000 });
    const articleHandles = await page.$$('[data-testid="search-results"] article');
    const maxCars = Math.min(10, articleHandles.length);
    const results = {};
    console.log(`Encontrados ${articleHandles.length} anúncios. A processar ${maxCars}...`);

    for (let i = 0; i < maxCars; i++) {
      const label = `car${i + 1}`;
      const carStart = Date.now();
      const art = articleHandles[i];
      try {
        await art.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
      } catch {}
      try { await page.waitForNetworkIdle({ idleTime: 400, timeout: 6000 }); } catch {}
      // Tenta acionar lazy-load do carrossel
      try {
        const nextBtn = await art.$('button[aria-label="Next slide"]');
        if (nextBtn) {
          await nextBtn.click();
          try { await page.waitForNetworkIdle({ idleTime: 300, timeout: 5000 }); } catch {}
        }
      } catch {}

      let urls = await page.evaluate((article) => {
        const firstArticle = article;
        const collect = (root) => {
          const urls = [];
          const imgs = Array.from(root.querySelectorAll('img'));
          for (const img of imgs) {
            const ownerArticle = img.closest('article');
            if (ownerArticle && ownerArticle !== firstArticle) continue;
            let src = img.currentSrc || img.src || img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
            if (!src) {
              const srcset = img.getAttribute('srcset');
              if (srcset) {
                const first = srcset.split(',')[0]?.trim().split(' ')[0];
                if (first) src = first;
              }
            }
            if (!src) continue;
            try {
              const abs = new URL(src, location.href).href;
              if (/\/listing\/gallery-cta\.svg$/i.test(abs)) continue;
              if (!/ireland\.apollo\.olxcdn\.com\/v1\/files\/.+\/image/i.test(abs)) continue;
              const rect = img.getBoundingClientRect();
              if (rect.width < 160 || rect.height < 120) continue;
              if (!urls.includes(abs)) urls.push(abs);
            } catch {}
          }
          return urls;
        };
        const carousel = firstArticle.querySelector('[data-testid="carousel-container"]');
        const fromCarousel = carousel ? collect(carousel) : [];
        if (fromCarousel.length > 0) return fromCarousel;
        return collect(firstArticle);
      }, art);

      // Fallback para página de detalhe se poucas imagens no cartão
      if (!urls || urls.length < 2) {
        try {
          const href = await art.$eval('a[href*="/carros/anuncio/"]', a => a.href);
          if (href) {
            const detail = await browser.newPage();
            try {
              await detail.goto(href, { waitUntil: 'networkidle2', timeout: 60000 });
              try { await detail.waitForSelector('body', { timeout: 10000 }); } catch {}
              try { await detail.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }); } catch {}
              const durls = await detail.evaluate(() => {
                const imgs = Array.from(document.querySelectorAll('img'));
                const urls = [];
                for (const img of imgs) {
                  let src = img.currentSrc || img.src || img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
                  if (!src) continue;
                  try {
                    const abs = new URL(src, location.href).href;
                    if (!/ireland\.apollo\.olxcdn\.com\/v1\/files\/.+\/image/i.test(abs)) continue;
                    const rect = img.getBoundingClientRect();
                    if (rect.width < 160 || rect.height < 120) continue;
                    if (!urls.includes(abs)) urls.push(abs);
                  } catch {}
                }
                return urls;
              });
              if (durls && durls.length > 0) {
                urls = durls;
              }
            } finally {
              await detail.close();
            }
          }
        } catch {}
      }

      results[label] = urls;
      const carMs = Date.now() - carStart;
      console.log(`${label}: ${urls.length} imagens em ${carMs}ms`);
    }

    try {
      await fs.promises.writeFile('car_images.json', JSON.stringify(results, null, 2), 'utf-8');
      console.log('Ficheiro salvo: ./car_images.json');
    } catch (e) {
      console.error('Falha ao guardar car_images.json:', e?.message || e);
    }

    const totalMs = Date.now() - t0;
    const denom = Math.max(1, maxCars);
    console.log(`Tempo total: ${totalMs}ms (média ~${Math.round(totalMs / denom)}ms por carro)`);
  } catch (e) {
    console.warn('Coleta de múltiplos anúncios falhou:', e?.message || e);
  }

  await browser.close();
})().catch((err) => {
  console.error('Erro ao capturar screenshot:', err);
  process.exit(1);
});
