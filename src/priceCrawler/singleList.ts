export async function getSinglesList() {
  console.log('Downloading products...');

  if (!process.env.PRODUCTS_URL) {
    throw new Error('PRODUCTS_URL is not defined in environment variables');
  }
  const productsResponse = await fetch(process.env.PRODUCTS_URL);
  const { products } = await productsResponse.json();
  console.log(`Downloaded ${products.length} products`);

  return products;
}
