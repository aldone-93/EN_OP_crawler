export async function getSinglesList() {
  console.log('Downloading products...');

  if (!process.env.PRODUCTS_URL) {
    console.error('❌ PRODUCTS_URL is not defined in environment variables');
    throw new Error('PRODUCTS_URL is not defined in environment variables');
  }

  try {
    const productsResponse = await fetch(process.env.PRODUCTS_URL);

    if (!productsResponse.ok) {
      const text = await productsResponse.text();
      console.error(`❌ Failed to fetch products. Status: ${productsResponse.status} ${productsResponse.statusText}`);
      console.error(`Response body: ${text.slice(0, 500)}`);
      throw new Error(`Failed to fetch products: ${productsResponse.status} ${productsResponse.statusText}`);
    }

    const json = await productsResponse.json();
    if (!json.products || !Array.isArray(json.products)) {
      console.error('❌ JSON response does not contain a valid "products" array:', json);
      throw new Error('Invalid products JSON structure');
    }

    console.log(`✅ Downloaded ${json.products.length} products`);
    return json.products;
  } catch (error: any) {
    console.error('❌ Error downloading products:', error.message || error);
    throw error;
  }
}
