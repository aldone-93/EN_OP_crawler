/**
 * Esempio di configurazione proxy per lo scraper CardMarket
 *
 * Come usare:
 * 1. Copia questo file come 'proxy-config.ts'
 * 2. Aggiungi i tuoi proxy nella lista PROXY_LIST
 * 3. Importa in cardmarketScraper.ts: import { PROXY_LIST } from './proxy-config';
 */

export const PROXY_LIST: string[] = [
  // ============================================
  // PROXY GRATUITI (spesso instabili)
  // ============================================
  // 'http://47.88.3.19:8080',
  // 'http://103.152.112.162:80',
  // ============================================
  // PROXY A PAGAMENTO (consigliati)
  // ============================================
  // Brightdata (ex Luminati)
  // 'http://username:password@brd.superproxy.io:22225',
  // Smartproxy
  // 'http://username:password@gate.smartproxy.com:7000',
  // Oxylabs
  // 'http://username:password@pr.oxylabs.io:7777',
  // ProxyMesh
  // 'http://username:password@us-ca.proxymesh.com:31280',
  // ============================================
  // PROXY RESIDENZIALI ROTANTI
  // ============================================
  // GeoSurf
  // 'http://username:password@premium.geosurf.io:8080',
  // NetNut
  // 'http://username:password@residential.netnut.io:5959',
  // ============================================
  // PROXY DATACENTER
  // ============================================
  // Webshare
  // 'http://username:password@proxy.webshare.io:80',
];

/**
 * Provider consigliati per scraping CardMarket:
 *
 * 1. Brightdata (https://brightdata.com)
 *    - Proxy residenziali di alta qualità
 *    - Rotazione IP automatica
 *    - Buona copertura geografica
 *    - Costo: ~$500/mese per 40GB
 *
 * 2. Smartproxy (https://smartproxy.com)
 *    - Ottimo rapporto qualità/prezzo
 *    - 40M+ IP residenziali
 *    - Costo: ~$75/mese per 5GB
 *
 * 3. Oxylabs (https://oxylabs.io)
 *    - Premium quality
 *    - 100M+ IP pool
 *    - Costo: ~$300/mese per 20GB
 *
 * NOTA IMPORTANTE:
 * - Evita proxy gratuiti per produzione (instabili, spesso bannati)
 * - Usa proxy residenziali invece di datacenter per CardMarket
 * - Configura la rotazione geografica (preferibilmente EU)
 * - Aggiungi delay anche con proxy (30-60s tra richieste)
 */

/**
 * Alternative senza proxy:
 *
 * 1. API Ufficiali CardMarket
 *    - Richiedi accesso API partner su cardmarket.com
 *    - Rate limits più alti
 *    - Dati strutturati
 *    - CONSIGLIATO se possibile
 *
 * 2. Servizi di scraping gestiti
 *    - ScraperAPI (https://scraperapi.com)
 *    - Bright Data Web Unlocker
 *    - Gestiscono proxy e anti-bot automaticamente
 *    - Costo: ~$49-199/mese
 */
