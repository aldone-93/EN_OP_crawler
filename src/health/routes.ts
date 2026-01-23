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
      <div class="card">
        <h2>📚 API Endpoints</h2>
        
        <h3>Products</h3>
        <div class="endpoint">
          <div><span class="method">GET</span><code>/api/products</code></div>
          <p>Get paginated list of products with optional filters.</p>
          <p><strong>Params:</strong> page, limit, name, category, expansion, rarity, <b>cardCode</b></p>
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
          <div><span class="method">GET</span><code>/api/prices</code></div>
          <p>Get paginated price records (time series)</p>
          <p><strong>Params:</strong> page, limit, category, expansion, rarity, <b>maxPrice</b> (price ≤ maxPrice), <b>minPrice</b> (price ≥ minPrice)</p>
        </div>
        <div class="endpoint">
          <div><span class="method">GET</span><code>/api/prices/:id</code></div>
          <p>Get price history (time series) for a product</p>
          <p><strong>Params:</strong> page, limit, from, to</p>
        </div>
        <div class="endpoint">
          <div><span class="method">GET</span><code>/api/prices/:id/latest</code></div>
          <p>Get most recent price for a product</p>
        </div>
        
        <h3>🔐 Authentication</h3>
        <p>Header: <code>X-Api-Key: your-key</code> or query: <code>?key=your-key</code></p>
      </div>
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
