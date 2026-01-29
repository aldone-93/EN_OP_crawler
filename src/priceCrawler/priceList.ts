import 'dotenv/config';
import { getDBClient } from '../core/dbAuth/mongoAuth';
import { Collection } from 'mongodb';

export async function getPriceList() {
  console.log('Downloading price guide...');

  if (!process.env.PRICES_URL) {
    throw new Error('PRICES_URL is not defined in environment variables');
  }
  const pricesResponse = await fetch(process.env.PRICES_URL ?? '');

  const client = await getDBClient();

  const priceHistory = client.db('marketData').collection('priceHistory');

  const { priceGuides } = await pricesResponse.json();

  const priceWithDelta = await Promise.all(
    priceGuides.map(async (priceGuide: any) => {
      const lastRecord = await priceHistory.find({ idProduct: priceGuide.idProduct }).sort({ timestamp: -1 }).limit(1).toArray();

      return {
        ...priceGuide,
        // Calcola la variazione di prezzo rispetto all'ultimo record nel database
        priceDelta: await calcDelta(lastRecord, priceGuide, 'avg1'),
        minPriceDelta: await calcDelta(lastRecord, priceGuide, 'low'),
      };
    })
  );
  // Crea una mappa dei prezzi per lookup veloce
  return priceWithDelta;
}

async function calcDelta(lastRecord: any, priceGuide: any, target: string) {
  if (lastRecord.length === 0) {
    return 0; // Nessun record precedente
  }

  const previousPrice = lastRecord[0]?.[target];
  if (!previousPrice || previousPrice === 0) {
    return 0; // Nessun record precedente o prezzo zero
  }
  // Delta percentuale rispetto al prezzo precedente
  return ((priceGuide[target] - previousPrice) / previousPrice) * 100;
}
