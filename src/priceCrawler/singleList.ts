export async function getSinglesList() {
  console.log('Downloading products...');

  const productsResponse = await fetch('https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_18.json');
  const { products } = await productsResponse.json();
  console.log(`Downloaded ${products.length} products`);

  return products;
}
