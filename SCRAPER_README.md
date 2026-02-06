# CardMarket Scraper

Scraper per CardMarket con supporto proxy rotanti e gestione rate limiting.

## ⚠️ Avvertenze Importanti

1. **Rate Limiting**: CardMarket applica limiti rigorosi sulle richieste
2. **Anti-Bot**: Usa sistemi di rilevamento automatizzati
3. **Legal**: Verifica i termini di servizio prima dell'uso
4. **API Ufficiali**: Considera l'uso delle API ufficiali CardMarket invece dello scraping

## 🚀 Configurazione

### 1. Setup Base (senza proxy)

Lo scraper funziona senza proxy ma con limiti molto restrittivi:

```bash
npx ts-node src/priceCrawler/cardmarketScraper.ts
```

**Limitazioni senza proxy:**

- Delay: 30-60 secondi tra richieste
- Rischio ban dopo poche richieste
- Status 429 (Too Many Requests) frequente

### 2. Setup con Proxy (Consigliato)

#### Opzione A: Proxy Gratuiti (Non raccomandato per produzione)

```typescript
// In cardmarketScraper.ts, modifica PROXY_LIST:
const PROXY_LIST: string[] = ['http://47.88.3.19:8080', 'http://103.152.112.162:80'];
```

**Problemi proxy gratuiti:**

- Instabili
- Spesso già bannati da CardMarket
- Lenti
- Non sicuri

#### Opzione B: Proxy a Pagamento (Consigliato)

**Provider consigliati:**

1. **Smartproxy** (~$75/mese)

   ```typescript
   const PROXY_LIST: string[] = ['http://username:password@gate.smartproxy.com:7000'];
   ```

2. **Brightdata** (~$500/mese)

   ```typescript
   const PROXY_LIST: string[] = ['http://username:password@brd.superproxy.io:22225'];
   ```

3. **Oxylabs** (~$300/mese)
   ```typescript
   const PROXY_LIST: string[] = ['http://username:password@pr.oxylabs.io:7777'];
   ```

#### Opzione C: Servizi di Scraping Gestiti

Invece di gestire proxy manualmente:

1. **ScraperAPI** (https://scraperapi.com)
   - Gestisce proxy e anti-bot automaticamente
   - $49-199/mese
2. **Bright Data Web Unlocker**
   - AI per bypassare protezioni
   - $600+/mese

## 📖 Uso

### Test su singolo prodotto

```bash
npx ts-node src/priceCrawler/cardmarketScraper.ts
```

Modifica l'ID prodotto nel file:

```typescript
testScraper(690369); // Cambia questo ID
```

### Scraping multiplo (limitato)

```typescript
import { scrapeAllProducts } from './cardmarketScraper';

// Scrape primi 10 prodotti
scrapeAllProducts(10);

// Scrape tutti (ATTENZIONE: molto lento e rischio ban)
scrapeAllProducts();
```

## ⚙️ Parametri Configurabili

### Delay tra richieste

```typescript
// In scrapeAllProducts()
const delayMs = 30000 + Math.random() * 30000; // 30-60 secondi
```

**Raccomandazioni:**

- Senza proxy: 30-60 secondi
- Con proxy: 10-20 secondi
- Con proxy premium: 5-10 secondi

### Rotazione proxy

```typescript
// Cambia proxy ogni N richieste
if (i > 0 && i % 5 === 0) {
  // Cambia ogni 5 richieste
  await initBrowser(true);
}
```

### Retry su rate limit

```typescript
// In scrapeProductPage()
if (status === 429) {
  if (retryCount < 3) {
    // Max 3 retry
    // Con proxy: switch e riprova
    // Senza proxy: aspetta 1-3 minuti
  }
}
```

## 📊 Output Dati

Lo scraper salva in MongoDB (`marketData.products`):

```typescript
{
  idProduct: 690369,
  name: "Roronoa Zoro",
  scrapedData: {
    title: "Roronoa Zoro (OP01-001) (V.2)",
    image: "https://product-images.s3.cardmarket.com/...",
    listings: [
      { price: 0.02, cell0: "Near Mint", cell1: "English" },
      { price: 0.05, cell0: "Lightly Played", cell1: "English" }
    ],
    priceRange: {
      min: 0.02,
      max: 0.05,
      avg: 0.035,
      count: 2
    },
    articleCount: 300
  },
  lastScraped: "2026-02-05T18:30:00.000Z"
}
```

## 🔍 Debug

### Verificare connessione

```typescript
// In scrapeProductPage(), decommentare:
await page.screenshot({ path: `debug_${idProduct}.png`, fullPage: true });
```

### Log dettagliati

Lo scraper stampa:

- Status HTTP di ogni richiesta
- Numero di righe tabella trovate
- Proxy in uso
- Retry attempts

### Problemi comuni

**Status 429 (Rate Limited)**

```
Soluzione:
- Aumenta delay tra richieste
- Usa proxy rotanti
- Riduci numero di richieste
```

**Status 403 (Forbidden)**

```
Soluzione:
- IP/Proxy bannato
- Cambia proxy
- Aspetta 24-48h
```

**Status 202 (Accepted)**

```
Soluzione:
- Pagina di verifica anti-bot
- Usa proxy residenziali premium
- Considera API ufficiali
```

**Nessun listing trovato**

```
Soluzione:
- Tabella caricata via JavaScript
- Aumenta wait time (attualmente 3-5s)
- Verifica selettori DOM
```

## 🎯 Alternative Consigliate

### 1. API Ufficiali CardMarket (BEST)

Richiedi accesso su: https://www.cardmarket.com/en/Magic/API

**Vantaggi:**

- Legale e supportato
- Rate limits più alti
- Dati strutturati
- Nessun proxy necessario

### 2. Partnership/Affiliazione

Diventa partner CardMarket per accesso dati.

### 3. Dati pubblici esistenti

Alcuni siti aggregano dati CardMarket legalmente.

## 📝 Best Practices

1. **Rispetta il sito**
   - Non sovraccaricare i server
   - Usa delay adeguati
   - Considera alternative

2. **Monitoraggio**
   - Traccia success/fail rate
   - Log errori per analisi
   - Alert su ban

3. **Scaling**
   - Non scrapare tutti i 10k+ prodotti in una sessione
   - Dividi in batch giornalieri
   - Priorità su prodotti più richiesti

4. **Backup**
   - Salva dati regolarmente
   - Usa time series per storico prezzi
   - Export periodici

## ⚖️ Note Legali

- Verifica i termini di servizio di CardMarket
- Lo scraping potrebbe violare i ToS
- Usa a tuo rischio
- Considera alternative legali

## 🛠️ Sviluppo Futuro

- [ ] Supporto Puppeteer Stealth
- [ ] CAPTCHA solving (2captcha integration)
- [ ] Dashboard monitoraggio
- [ ] Queue system per scraping distribuito
- [ ] Webhook notifiche
- [ ] Export CSV/JSON

## 📧 Support

Per problemi tecnici, verifica:

1. Log dello scraper
2. Status code HTTP
3. Screenshot debug
4. Proxy status

---

**Disclaimer**: Questo tool è per scopi educativi. L'uso in produzione deve rispettare i termini di servizio di CardMarket.
