import { getDBClient } from '../core/dbAuth/mongoAuth';
import puppeteer from 'puppeteer';

interface ProductData {
  idProduct: number;
  name: string;
  url: string;
  // Dati che estrarremo dallo scraping
  scrapedData?: {
    description?: string;
    image?: string;
    availability?: string;
    priceRange?: {
      min?: number;
      max?: number;
      avg?: number;
    };
    sellers?: number;
    listings?: any[];
    lastUpdated?: Date;
  };
}

/**
 * Lista di proxy da rotare (aggiungi i tuoi proxy qui)
 * Formato: 'http://username:password@host:port' oppure 'http://host:port'
 */
const PROXY_LIST: string[] = [
  // Esempio: 'http://proxy1.example.com:8080',
  // Esempio: 'http://user:pass@proxy2.example.com:8080',
  // Lascia vuoto per usare connessione diretta
];

let currentProxyIndex = 0;

/**
 * Ottieni il prossimo proxy dalla lista (rotazione)
 */
function getNextProxy(): string | null {
  if (PROXY_LIST.length === 0) return null;

  const proxy = PROXY_LIST[currentProxyIndex];
  currentProxyIndex = (currentProxyIndex + 1) % PROXY_LIST.length;
  return proxy ?? null;
}

/**
 * Delay tra le richieste per evitare rate limiting
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Browser instance condivisa per tutti gli scraping
let browser: any = null;
let currentProxy: string | null = null;

/**
 * Inizializza il browser Puppeteer con proxy (se disponibile)
 */
async function initBrowser(forceNewBrowser = false) {
  if (browser && !forceNewBrowser) {
    return browser;
  }

  // Chiudi browser esistente se richiesto nuovo
  if (browser && forceNewBrowser) {
    await browser.close();
    browser = null;
  }

  console.log('Launching browser...');

  const proxy = getNextProxy();
  currentProxy = proxy ?? null;

  const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'];

  if (proxy) {
    console.log(`Using proxy: ${proxy.replace(/\/\/.*:.*@/, '//***:***@')}`); // Nascondi credenziali nel log
    args.push(`--proxy-server=${proxy}`);
  } else {
    console.log('No proxy configured, using direct connection');
  }

  browser = await puppeteer.launch({
    headless: true,
    args,
  });

  return browser;
}

/**
 * Scrape una singola pagina prodotto CardMarket usando Puppeteer
 */
async function scrapeProductPage(idProduct: number, retryCount = 0): Promise<any> {
  const url = `https://www.cardmarket.com/en/OnePiece/Products?idProduct=${idProduct}`;

  let page = null;
  try {
    const browserInstance = await initBrowser();
    page = await browserInstance.newPage();

    // Imposta user agent realistico
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Imposta viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Extra headers per sembrare più realistico
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    // Naviga alla pagina
    console.log(`  Navigating to ${url}...`);
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    if (!response) {
      console.warn(`  ⚠️ No response for product ${idProduct}`);
      await page.close();
      return null;
    }

    const status = response.status();
    console.log(`  Response status: ${status}`);

    // Gestione rate limiting con retry e cambio proxy
    if (status === 429) {
      await page.close();

      if (retryCount < 3) {
        // Cambia proxy se disponibili
        if (PROXY_LIST.length > 1) {
          console.warn(`  ⚠️ Rate limited (429). Switching to next proxy and retrying ${retryCount + 1}/3...`);
          await initBrowser(true); // Forza nuovo browser con proxy diverso
          const waitTime = 10000; // 10 secondi
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          const waitTime = (retryCount + 1) * 60000; // 1min, 2min, 3min
          console.warn(`  ⚠️ Rate limited (429). No proxies available. Waiting ${waitTime / 1000}s before retry ${retryCount + 1}/3...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
        return scrapeProductPage(idProduct, retryCount + 1);
      } else {
        console.error(`  ✗ Rate limit exceeded after 3 retries for product ${idProduct}`);
        return null;
      }
    }

    if (status === 403 || status === 202) {
      console.warn(`  ⚠️ Anti-bot detection (${status}) for product ${idProduct}`);
      await page.close();
      return null;
    }

    if (status !== 200) {
      console.warn(`  ⚠️ Failed to fetch product ${idProduct}: ${status}`);
      await page.close();
      return null;
    }

    // Attendi che la pagina carichi i contenuti
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Rimuovi/chiudi banner cookie con JavaScript diretto
    try {
      await page.evaluate(() => {
        // Cerca e clicca pulsanti di accettazione cookie
        const cookieButtons = [...document.querySelectorAll('button, a, div')].filter((el) => {
          const text = el.textContent?.toLowerCase() || '';
          const id = el.id?.toLowerCase() || '';
          const className = el.className?.toLowerCase() || '';
          return text.includes('accept') || text.includes('agree') || id.includes('accept') || id.includes('agree') || className.includes('accept') || className.includes('agree');
        });

        if (cookieButtons.length > 0) {
          console.log('Found cookie button, clicking...');
          (cookieButtons[0] as HTMLElement).click();
          return true;
        }

        // Se non trova il pulsante, rimuovi banner cookie forzatamente
        const overlays = document.querySelectorAll('[class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"]');
        overlays.forEach((el) => {
          (el as HTMLElement).style.display = 'none';
        });

        return false;
      });
      console.log('  Cookie banner handled');
    } catch (e) {
      console.log('  No cookie banner manipulation needed');
    }

    // Attendi ancora un po' dopo aver gestito i cookie
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Prova ad attendere elementi specifici del prodotto e della tabella prezzi
    try {
      await page.waitForSelector('h1, .product-name, [class*="Product"]', { timeout: 10000 });
      console.log('  Product title loaded');
    } catch (e) {
      console.warn(`  ⚠️ Timeout waiting for product content`);
    }

    // Attendi la tabella degli articoli con più tempo
    try {
      await page.waitForSelector('table.table tbody tr, .article-table tbody tr, [data-article-id]', { timeout: 20000 });
      console.log('  Articles table loaded');
      // Attendi ancora un po' per il rendering completo
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (e) {
      console.warn(`  ⚠️ Timeout waiting for articles table - trying to continue anyway`);
    }

    // Screenshot per debug
    try {
      await page.screenshot({ path: `/tmp/cardmarket_${idProduct}.png`, fullPage: false });
      console.log(`  Screenshot saved to /tmp/cardmarket_${idProduct}.png`);
    } catch (e) {
      // Ignora errori screenshot
    }
    // await page.screenshot({ path: `debug_${idProduct}.png`, fullPage: true });

    // Estrai i dati dalla pagina
    const scrapedData = await page.evaluate(() => {
      const data: any = {
        lastUpdated: new Date(),
        rawText: document.body.innerText.substring(0, 500), // Debug: primi 500 caratteri
      };

      // Prova a estrarre il titolo del prodotto con vari selettori
      const titleSelectors = ['h1.page-title', 'h1', '.product-name', '.product-title', '[class*="ProductTitle"]'];
      for (const selector of titleSelectors) {
        const elem = document.querySelector(selector);
        if (elem && elem.textContent && elem.textContent.trim() && elem.textContent.trim() !== 'Singles') {
          data.title = elem.textContent.trim();
          break;
        }
      }

      // Prova a estrarre l'immagine con vari selettori
      const imgSelectors = ['.product-image img', '.card-image img', 'img[alt*="card"]', 'img.product-img', '.image-container img'];
      for (const selector of imgSelectors) {
        const elem = document.querySelector(selector);
        const src = elem?.getAttribute('src');
        if (src && !src.includes('transparent.gif') && !src.includes('placeholder')) {
          data.image = src;
          break;
        }
      }

      // Cerca tabella con prezzi/listings - prova più selettori
      const tableRows = document.querySelectorAll('table.table tbody tr, ' + '.article-table tbody tr, ' + 'table tbody tr[data-article-id], ' + 'tr.article-row, ' + '[class*="ArticleRow"]');
      console.log(`Found ${tableRows.length} table rows`);

      // Debug: stampa i primi elementi trovati
      if (tableRows.length === 0) {
        const allTables = document.querySelectorAll('table');
        console.log(`Total tables on page: ${allTables.length}`);
        allTables.forEach((table, i) => {
          const rows = table.querySelectorAll('tbody tr');
          console.log(`Table ${i}: ${rows.length} rows, classes: ${table.className}`);
        });
      }

      if (tableRows.length > 0) {
        data.listings = [];
        const prices: number[] = [];

        tableRows.forEach((row, index) => {
          if (index < 20) {
            // Cerca celle di prezzo
            const cells = row.querySelectorAll('td, .cell, [class*="Cell"]');
            let foundPrice = false;
            let rowData: any = { index };

            cells.forEach((cell, cellIndex) => {
              const text = cell.textContent?.trim() || '';

              // Debug: salva i primi testi di celle
              if (cellIndex < 5) {
                rowData[`cell${cellIndex}`] = text.substring(0, 30);
              }

              // Cerca pattern di prezzo: €0.02, 0,02 €, 0.02, etc
              const pricePatterns = [
                /€\s*([\d]+[,.][\d]{2})/, // €0.02
                /([\d]+[,.][\d]{2})\s*€/, // 0.02 €
                /^\s*([\d]+[,.][\d]{2})\s*$/, // 0.02 (solo numero)
                /Price:\s*([\d]+[,.][\d]{2})/i, // Price: 0.02
              ];

              for (const pattern of pricePatterns) {
                const priceMatch = text.match(pattern);
                if (priceMatch && priceMatch[1] && !foundPrice) {
                  const price = parseFloat(priceMatch[1].replace(',', '.'));
                  if (price > 0 && price < 1000) {
                    prices.push(price);
                    rowData.price = price;
                    foundPrice = true;
                    break;
                  }
                }
              }
            });

            // Aggiungi il listing solo se ha trovato un prezzo
            if (foundPrice) {
              data.listings.push(rowData);
            }
          }
        });

        // Debug: mostra i primi listing trovati
        if (data.listings.length > 0) {
          console.log(`Sample listing:`, JSON.stringify(data.listings[0]));
        }

        // Calcola statistiche prezzi
        if (prices.length > 0) {
          data.priceRange = {
            min: Math.min(...prices),
            max: Math.max(...prices),
            avg: prices.reduce((a, b) => a + b, 0) / prices.length,
            count: prices.length,
          };
        }
      }

      // Cerca numero di articoli/venditori nel testo
      const bodyText = document.body.textContent || '';
      const articleMatch = bodyText.match(/(\d+)\s+(?:article|Article|listing|Listing)/i);
      if (articleMatch && articleMatch[1]) {
        data.articleCount = parseInt(articleMatch[1]);
      }

      return data;
    });

    // Debug: mostra parte dell'HTML se non ci sono dati utili
    if (!scrapedData.title || scrapedData.title === 'Singles') {
      console.log(`  ⚠️ No specific product title found`);
      console.log(`  Debug text: ${scrapedData.rawText}`);
    }

    console.log(`  ✓ Scraped product ${idProduct} - found ${scrapedData.listings?.length || 0} listings`);

    await page.close();
    return scrapedData;
  } catch (error: any) {
    console.error(`  ✗ Error scraping product ${idProduct}:`, error.message);
    if (page) await page.close();
    return null;
  }
}

/**
 * Scrape tutti i prodotti dalla collection
 */
export async function scrapeAllProducts(limit?: number) {
  console.log('Starting CardMarket scraper...');

  const client = await getDBClient();
  const db = client.db('marketData');
  const productsCollection = db.collection('products');

  // Prendi tutti i prodotti (o un limite per test)
  const query = {};
  const products = await productsCollection
    .find(query)
    .limit(limit || 0)
    .toArray();

  console.log(`Found ${products.length} products to scrape`);

  let successCount = 0;
  let failCount = 0;

  // Scrape ogni prodotto con delay
  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    if (!product) continue;

    console.log(`[${i + 1}/${products.length}] Scraping product ${product.idProduct} - ${product.name}`);

    // Cambia proxy ogni N richieste (se disponibili)
    if (PROXY_LIST.length > 1 && i > 0 && i % 5 === 0) {
      console.log(`  Rotating proxy after ${i} requests...`);
      await initBrowser(true);
      await delay(5000); // Pausa dopo cambio proxy
    }

    const scrapedData = await scrapeProductPage(product.idProduct);

    if (scrapedData) {
      // Update del prodotto con i dati scraped
      await productsCollection.updateOne(
        { idProduct: product.idProduct },
        {
          $set: {
            scrapedData,
            lastScraped: new Date(),
          },
        }
      );
      successCount++;
    } else {
      failCount++;
    }

    // Delay tra le richieste (30-60 secondi per evitare rate limiting)
    if (i < products.length - 1) {
      const delayMs = 30000 + Math.random() * 30000; // 30-60 secondi random
      console.log(`  Waiting ${Math.round(delayMs / 1000)}s before next request...`);
      await delay(delayMs);
    }
  }

  console.log('\n=== Scraping Complete ===');
  console.log(`Total: ${products.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);

  // Chiudi il browser
  if (browser) {
    await browser.close();
    browser = null;
  }

  await client.close();
}

/**
 * Test scraper su un singolo prodotto
 */
export async function testScraper(idProduct: number) {
  console.log(`Testing scraper on product ${idProduct}...`);

  const scrapedData = await scrapeProductPage(idProduct);

  if (scrapedData) {
    console.log('\nScraped data:');
    console.log(JSON.stringify(scrapedData, null, 2));
  } else {
    console.log('Failed to scrape product');
  }

  // Chiudi il browser
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// Se eseguito direttamente, fai un test
if (require.main === module) {
  // Test su un singolo prodotto (cambia l'ID per testare)
  testScraper(690369)
    .then(() => {
      console.log('\nTest complete. To scrape all products, call scrapeAllProducts()');
      console.log('Example: scrapeAllProducts(10) to scrape first 10 products');
    })
    .catch(console.error);
}
