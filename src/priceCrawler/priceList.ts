import 'dotenv/config';

export async function getPriceList() {
  console.log('Downloading price guide...');

  if (!process.env.PRICES_URL) {
    throw new Error('PRICES_URL is not defined in environment variables');
  }
  const pricesResponse = await fetch(process.env.PRICES_URL ?? '');

  const { priceGuides } = await pricesResponse.json();

  // Crea una mappa dei prezzi per lookup veloce
  return priceGuides;
}
