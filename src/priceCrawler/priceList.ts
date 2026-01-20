export async function getPriceList() {
  console.log('Downloading price guide...');

  // Scarica price guide da CardMarket
  const pricesResponse = await fetch('https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_18.json');

  const { priceGuides } = await pricesResponse.json();

  // Crea una mappa dei prezzi per lookup veloce
  return new Map(priceGuides.map((p: any) => [p.idProduct, p]));
}
