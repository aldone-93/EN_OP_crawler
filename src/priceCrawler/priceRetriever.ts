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

export async function downloadAndMerge() {
  const productsList = await getSinglesList();
  const priceList = await getPriceList(productsList);

  console.log(`Fetched ${productsList.length} products and ${priceList.length} prices`);

  const client = await getDBClient();
  const db = client.db('marketData');

  // Collection 1: Products (dati statici, senza prezzi)
  const productsCollection = db.collection('products');

  // Collection 2: Prices (time series)
  const pricesCollection = db.collection('priceHistory');

  // Upsert dei prodotti (solo dati statici, no prezzi)
  const productBulkOps = productsList.map((product: any) => ({
    updateOne: {
      filter: { idProduct: product.idProduct },
      update: {
        $set: { ...product },
      },
      upsert: true,
    },
  }));

  if (productBulkOps.length > 0) {
    const productResult = await productsCollection.bulkWrite(productBulkOps);
    console.log(`Products: ${productResult.modifiedCount} updated, ${productResult.upsertedCount} inserted`);
  }

  const timestamp = new Date();

  // Insert dei prezzi come time series
  const priceDocuments = priceList.map((price: any) => ({
    ...price,
    timestamp,
  }));

  if (priceDocuments.length > 0) {
    const priceResult = await pricesCollection.insertMany(priceDocuments);
    console.log(`Prices: ${priceResult.insertedCount} records inserted`);
  }

  console.log(`[${timestamp.toISOString()}] Update completed`);
}
