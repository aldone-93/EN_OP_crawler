import cron from 'node-cron';
import { writeFileSync } from 'fs';

// Ogni giorno alle 2:00 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Downloading and merging data...');
  await downloadAndMerge();
});

async function downloadAndMerge() {
  console.log('Downloading price guide...');
  console.log('Downloading products...');

  // Scarica price guide da CardMarket
  const pricesResponse = await fetch('https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_18.json');
  const productsResponse = await fetch('https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_18.json');

  const { priceGuides } = await pricesResponse.json();

  // Scarica products singles da CardMarket

  const { products } = await productsResponse.json();
  console.log(`Downloaded ${products.length} products and ${priceGuides.length} prices`);

  // Crea una mappa dei prezzi per lookup veloce
  const priceMap = new Map(priceGuides.map((p: any) => [p.idProduct, p]));

  // Unisci i dati
  const merged = products.map((product: any) => ({
    ...product,
    pricing: priceMap.get(product.idProduct) || null,
  }));

  // Salva il risultato
  writeFileSync('./output/merged.json', JSON.stringify(merged, null, 2));
  console.log(`Merged ${merged.length} products`);

  return merged;
}
downloadAndMerge();
