export async function getSinglesList() {
  console.log('Downloading products...');

  if (!process.env.PRODUCTS_URL) {
    console.error('❌ PRODUCTS_URL is not defined in environment variables');
    throw new Error('PRODUCTS_URL is not defined in environment variables');
  }

  const url = process.env.PRODUCTS_URL;
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0',
    Accept: 'application/json',
  };

  try {
    console.log(`[DEBUG] Fetching URL: ${url}`);
    console.log(`[DEBUG] Request headers:`, headers);
    const productsResponse = await fetch(url, { headers });

    if (!productsResponse.ok) {
      const text = await productsResponse.text();
      console.error(`❌ Failed to fetch products. Status: ${productsResponse.status} ${productsResponse.statusText}`);
      console.error(`[DEBUG] Response headers:`, Object.fromEntries(productsResponse.headers.entries()));
      console.error(`[DEBUG] Response body (first 500 chars): ${text.slice(0, 500)}`);
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
    console.error('❌ Error downloading products:', error && error.stack ? error.stack : error);
    if (error && error.response) {
      console.error(`[DEBUG] Error response:`, error.response);
    }
    throw error;
  }
}
