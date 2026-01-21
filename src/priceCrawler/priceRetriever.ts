import cron from 'node-cron';
import { getSinglesList } from './singleList';
import { getPriceList } from './priceList';
import { getDBClient } from '../core/dbAuth/mongoAuth';

// Ogni giorno alle 2:00 AM
console.log('Starting CRON...');
cron.schedule('0 2 * * *', async () => {
  console.log('Downloading and merging data...');
  await downloadAndMerge();
});

async function downloadAndMerge() {
  const products = await getSinglesList();
  const priceMap = await getPriceList();

  const merged = products.map((product: any) => ({
    ...product,
    pricing: priceMap.get(product.idProduct) || null,
  }));

  getDBClient().then(async (client) => {
    const db = client.db('marketData');
    const collection = db.collection('products');

    const timestamp = new Date();

    // Per ogni prodotto, aggiungi il prezzo all'array storico
    const bulkOps = merged.map((product: any) => ({
      updateOne: {
        filter: { idProduct: product.idProduct },
        update: {
          $setOnInsert: {
            idProduct: product.idProduct,
            name: product.name,
            idCategory: product.idCategory,
            categoryName: product.categoryName,
            idExpansion: product.idExpansion,
            idMetacard: product.idMetacard,
            dateAdded: product.dateAdded,
          },
          $push: {
            priceHistory: {
              timestamp,
              ...product.pricing,
            },
          },
        },
        upsert: true,
      },
    }));

    await collection.bulkWrite(bulkOps);

    console.log(`Database updated with ${merged.length} products price history`);
    client.close();
  });
  console.log(`Merged ${merged.length} products`);

  return merged;
}
