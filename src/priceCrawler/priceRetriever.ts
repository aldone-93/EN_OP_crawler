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

  const client = await getDBClient();
  const db = client.db('marketData');

  // Collection 1: Products (dati statici, senza prezzi)
  const productsCollection = db.collection('products');

  // Collection 2: Prices (time series)
  const pricesCollection = db.collection('priceHistory');

  // Collection 3: CTrader data per lookup
  const ctraderCollection = client.db('OnePieceProducts').collection('ctraderData');

  const productsWithCtraderData = await Promise.all(
    productsList.map(async (product: any) => {
      const ctraderData = await ctraderCollection.findOne({
        card_market_ids: product.idProduct,
      });

      let cardtraderUrl = null;
      if (ctraderData && ctraderData.big_image) {
        const match = ctraderData.big_image.match(/\/image\/\d+\/(.+?)(?:-\d+)?\.(png|jpg|jpeg)$/i);
        if (match) {
          const slug = match[1];
          cardtraderUrl = `https://www.cardtrader.com/en/cards/${slug}`;
        }
      }

      return {
        ...product,
        ...(ctraderData && {
          ctrader_id: ctraderData.id,
          cardtrader_url: cardtraderUrl,
          fixed_properties: ctraderData.fixed_properties,
          tcg_player_id: ctraderData.tcg_player_id,
        }),
      };
    })
  );

  // Upsert dei prodotti (solo dati statici, no prezzi)
  const productBulkOps = productsWithCtraderData.map((product: any) => ({
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
