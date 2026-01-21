import express from 'express';
import { getDBClient } from '../core/dbAuth/mongoAuth';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY;

// Middleware per autenticazione
function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!API_KEY) {
    return next();
  }

  const providedKey = req.headers['x-api-key'] || req.query.key;

  if (providedKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

// === API ENDPOINTS ===

// GET /api/products - Lista prodotti con paginazione e filtri
app.get('/api/products', authenticate, async (req, res) => {
  try {
    const client = await getDBClient();
    const db = client.db('marketData');
    const collection = db.collection('products');

    // Parametri di paginazione
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    // Filtri
    const filter: any = {};

    if (req.query.name) {
      filter.enName = { $regex: req.query.name as string, $options: 'i' };
    }

    if (req.query.category) {
      filter.categoryName = req.query.category as string;
    }

    if (req.query.expansion) {
      filter.expansionName = { $regex: req.query.expansion as string, $options: 'i' };
    }

    if (req.query.rarity) {
      filter.rarity = req.query.rarity as string;
    }

    // Query
    const [products, total] = await Promise.all([collection.find(filter).skip(skip).limit(limit).toArray(), collection.countDocuments(filter)]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error: any) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/products/:id - Dettaglio singolo prodotto
app.get('/api/products/:id', authenticate, async (req, res) => {
  try {
    const client = await getDBClient();
    const db = client.db('marketData');
    const collection = db.collection('products');

    const idProduct = parseInt(req.params.id as string);
    const product = await collection.findOne({ idProduct });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error: any) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/prices/:id - Storico prezzi per un prodotto
app.get('/api/prices/:id', authenticate, async (req, res) => {
  try {
    const client = await getDBClient();
    const db = client.db('marketData');
    const collection = db.collection('priceHistory');

    const idProduct = parseInt(req.params.id as string);

    // Filtro per date (opzionale)
    const dateFilter: any = { idProduct };

    if (req.query.from) {
      dateFilter.timestamp = { $gte: new Date(req.query.from as string) };
    }

    if (req.query.to) {
      dateFilter.timestamp = { ...dateFilter.timestamp, $lte: new Date(req.query.to as string) };
    }

    // Paginazione
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = (page - 1) * limit;

    // Sort: più recenti prima
    const [prices, total] = await Promise.all([collection.find(dateFilter).sort({ timestamp: -1 }).skip(skip).limit(limit).toArray(), collection.countDocuments(dateFilter)]);

    if (prices.length === 0 && page === 1) {
      return res.status(404).json({ error: 'No price data found for this product' });
    }

    const totalPages = Math.ceil(total / limit);

    res.json({
      idProduct,
      data: prices,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error: any) {
    console.error('Get prices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/prices/:id/latest - Ultimo prezzo di un prodotto
app.get('/api/prices/:id/latest', authenticate, async (req, res) => {
  try {
    const client = await getDBClient();
    const db = client.db('marketData');
    const collection = db.collection('priceHistory');

    const idProduct = parseInt(req.params.id as string);

    const latestPrice = await collection.findOne({ idProduct }, { sort: { timestamp: -1 } });

    if (!latestPrice) {
      return res.status(404).json({ error: 'No price data found for this product' });
    }

    res.json(latestPrice);
  } catch (error: any) {
    console.error('Get latest price error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/categories - Lista categorie disponibili
app.get('/api/categories', authenticate, async (req, res) => {
  try {
    const client = await getDBClient();
    const db = client.db('marketData');
    const collection = db.collection('products');

    const categories = await collection.distinct('categoryName');

    res.json({ categories });
  } catch (error: any) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/expansions - Lista espansioni disponibili
app.get('/api/expansions', authenticate, async (req, res) => {
  try {
    const client = await getDBClient();
    const db = client.db('marketData');
    const collection = db.collection('products');

    const expansions = await collection.distinct('expansionName');

    res.json({ expansions });
  } catch (error: any) {
    console.error('Get expansions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET / - Documentazione API
app.get('/services', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>One Piece TCG API</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 1000px;
          margin: 50px auto;
          padding: 20px;
          background: #f5f5f5;
        }
        .card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1, h2 { color: #333; }
        .endpoint {
          background: #f8f9fa;
          padding: 15px;
          margin: 10px 0;
          border-radius: 5px;
          border-left: 4px solid #007bff;
        }
        .method {
          display: inline-block;
          padding: 4px 8px;
          background: #007bff;
          color: white;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          margin-right: 10px;
        }
        code {
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
        }
      </style>
    </head>
    <body>
      <h1>🃏 One Piece TCG Price API</h1>
      
      <div class="card">
        <h2>📚 API Endpoints</h2>
        
        <h3>Products</h3>
        
        <div class="endpoint">
          <div><span class="method">GET</span><code>/api/products</code></div>
          <p>Get paginated list of products with optional filters</p>
          <p><strong>Query params:</strong></p>
          <ul>
            <li><code>page</code> (default: 1) - Page number</li>
            <li><code>limit</code> (default: 50) - Items per page</li>
            <li><code>name</code> - Filter by card name (case-insensitive)</li>
            <li><code>category</code> - Filter by category name</li>
            <li><code>expansion</code> - Filter by expansion name</li>
            <li><code>rarity</code> - Filter by rarity</li>
          </ul>
          <p><strong>Example:</strong> <code>/api/products?page=1&limit=20&name=Luffy&rarity=SR</code></p>
        </div>
        
        <div class="endpoint">
          <div><span class="method">GET</span><code>/api/products/:id</code></div>
          <p>Get single product by ID</p>
          <p><strong>Example:</strong> <code>/api/products/690368</code></p>
        </div>
        
        <div class="endpoint">
          <div><span class="method">GET</span><code>/api/categories</code></div>
          <p>Get list of all available categories</p>
        </div>
        
        <div class="endpoint">
          <div><span class="method">GET</span><code>/api/expansions</code></div>
          <p>Get list of all available expansions</p>
        </div>
        
        <h3>Prices</h3>
        
        <div class="endpoint">
          <div><span class="method">GET</span><code>/api/prices/:id</code></div>
          <p>Get price history for a product (time series data)</p>
          <p><strong>Query params:</strong></p>
          <ul>
            <li><code>page</code> (default: 1) - Page number</li>
            <li><code>limit</code> (default: 100) - Items per page</li>
            <li><code>from</code> - Start date (ISO format)</li>
            <li><code>to</code> - End date (ISO format)</li>
          </ul>
          <p><strong>Example:</strong> <code>/api/prices/690368?from=2026-01-01&limit=50</code></p>
        </div>
        
        <div class="endpoint">
          <div><span class="method">GET</span><code>/api/prices/:id/latest</code></div>
          <p>Get the most recent price data for a product</p>
          <p><strong>Example:</strong> <code>/api/prices/690368/latest</code></p>
        </div>
        
        <h3>🔐 Authentication</h3>
        <p>All endpoints require authentication via API key:</p>
        <ul>
          <li>Header: <code>X-Api-Key: your-api-key</code></li>
          <li>Or query param: <code>?key=your-api-key</code></li>
        </ul>
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
  console.log(`Documentation: ${PORT}`);
});
