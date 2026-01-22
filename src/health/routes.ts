import express from 'express';
import { getDBClient } from '../core/dbAuth/mongoAuth';

function getNextCronRun(): string {
  const now = new Date();
  const next = new Date(now);
  next.setHours(2, 0, 0, 0);

  if (now.getHours() >= 2) {
    next.setDate(next.getDate() + 1);
  }

  return next.toISOString();
}

export function setupHealthRoutes(app: express.Application, authenticate: express.RequestHandler) {
  // GET /health - Health check endpoint
  app.get('/health', authenticate, async (req, res) => {
    try {
      const client = await getDBClient();
      const db = client.db('marketData');

      await db.admin().ping();

      const productsCollection = db.collection('products');
      const pricesCollection = db.collection('priceHistory');

      const [productCount, priceCount] = await Promise.all([productsCollection.countDocuments(), pricesCollection.countDocuments()]);

      const latestPrice = await pricesCollection.findOne({}, { sort: { timestamp: -1 } });

      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          productsCount: productCount,
          priceRecordsCount: priceCount,
          lastUpdate: latestPrice?.timestamp || null,
        },
        cron: {
          schedule: '0 2 * * *',
          description: 'Every day at 2:00 AM',
          nextRun: getNextCronRun(),
        },
      });
    } catch (error: any) {
      console.error('Health check error:', error);
      res.status(500).json({
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        database: {
          connected: false,
        },
      });
    }
  });

  // GET /status - Recent updates status
  app.get('/status', authenticate, async (req, res) => {
    try {
      const client = await getDBClient();
      const db = client.db('marketData');
      const collection = db.collection('priceHistory');

      const updates = await collection
        .aggregate([
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
              },
              count: { $sum: 1 },
              timestamp: { $first: '$timestamp' },
            },
          },
          { $sort: { timestamp: -1 } },
          { $limit: 10 },
        ])
        .toArray();

      res.json({
        status: 'OK',
        recentUpdates: updates.map((u) => ({
          date: u._id,
          priceRecordsAdded: u.count,
          timestamp: u.timestamp,
        })),
      });
    } catch (error: any) {
      console.error('Status check error:', error);
      res.status(500).json({
        status: 'ERROR',
      });
    }
  });

  console.log('✅ Health check routes configured');
}

export function getHomepageHTML(): string {
  return `
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
        .status-ok { color: #28a745; font-weight: bold; }
        .status-error { color: #dc3545; font-weight: bold; }
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
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #eee;
        }
        button {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          margin: 5px;
        }
        button:hover { background: #0056b3; }
      </style>
    </head>
    <body>
      <h1>🃏 One Piece TCG Price Crawler</h1>
      
      <div class="card">
        <h2>System Health</h2>
        <div id="health-data">Loading...</div>
        <button onclick="loadHealth()">Refresh</button>
      </div>
      
      <div class="card">
        <h2>📚 API Endpoints</h2>
        
        <h3>Products</h3>
        <div class="endpoint">
          <div><span class="method">GET</span><code>/api/products</code></div>
          <p>Get paginated list of products with optional filters</p>
          <p><strong>Params:</strong> page, limit, name, category, expansion, rarity</p>
        </div>
        
        <div class="endpoint">
          <div><span class="method">GET</span><code>/api/products/:id</code></div>
          <p>Get single product by ID</p>
        </div>
        
        <div class="endpoint">
          <div><span class="method">GET</span><code>/api/categories</code></div>
          <p>Get list of all categories</p>
        </div>
        
        <div class="endpoint">
          <div><span class="method">GET</span><code>/api/expansions</code></div>
          <p>Get list of all expansions</p>
        </div>
        
        <h3>Prices</h3>
        <div class="endpoint">
          <div><span class="method">GET</span><code>/api/prices/:id</code></div>
          <p>Get price history (time series)</p>
          <p><strong>Params:</strong> page, limit, from, to</p>
        </div>
        
        <div class="endpoint">
          <div><span class="method">GET</span><code>/api/prices/:id/latest</code></div>
          <p>Get most recent price</p>
        </div>
        
        <h3>🔐 Authentication</h3>
        <p>Header: <code>X-Api-Key: your-key</code> or query: <code>?key=your-key</code></p>
      </div>
      
      <script>
        async function loadHealth() {
          try {
            const res = await fetch('/health');
            const data = await res.json();
            const statusClass = data.status === 'OK' ? 'status-ok' : 'status-error';
            document.getElementById('health-data').innerHTML = \`
              <div class="info-row"><strong>Status:</strong><span class="\${statusClass}">\${data.status}</span></div>
              <div class="info-row"><strong>Database:</strong><span>\${data.database.connected ? '✅ Connected' : '❌ Disconnected'}</span></div>
              <div class="info-row"><strong>Products:</strong><span>\${data.database.productsCount || 0}</span></div>
              <div class="info-row"><strong>Price Records:</strong><span>\${data.database.priceRecordsCount || 0}</span></div>
              <div class="info-row"><strong>Last Update:</strong><span>\${data.database.lastUpdate ? new Date(data.database.lastUpdate).toLocaleString() : 'Never'}</span></div>
              <div class="info-row"><strong>Next Cron:</strong><span>\${data.cron?.nextRun ? new Date(data.cron.nextRun).toLocaleString() : 'Unknown'}</span></div>
            \`;
          } catch (error) {
            document.getElementById('health-data').innerHTML = '<div class="status-error">Error loading data</div>';
          }
        }
        loadHealth();
        setInterval(loadHealth, 30000);
      </script>
    </body>
    </html>
  `;
}
