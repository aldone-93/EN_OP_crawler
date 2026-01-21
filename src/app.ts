import { getDBClient } from './core/dbAuth/mongoAuth';
import express from 'express';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

// Middleware per autenticazione
function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Se API_KEY non è configurato, accesso libero (solo per sviluppo locale)
  if (!API_KEY) {
    return next();
  }

  const providedKey = req.headers['x-api-key'] || req.query.key;

  if (providedKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

// Health check endpoint
app.get('/health', authenticate, async (req, res) => {
  try {
    const client = await getDBClient();
    const db = client.db('marketData');

    await db.admin().ping();

    const collection = db.collection('products');
    const productCount = await collection.countDocuments();

    const lastProduct = await collection.findOne({}, { sort: { 'priceHistory.timestamp': -1 }, projection: { priceHistory: { $slice: -1 } } });

    const lastUpdate = lastProduct?.priceHistory?.[0]?.timestamp;

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        productsCount: productCount,
        lastUpdate: lastUpdate || null,
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

// Endpoint per vedere gli ultimi aggiornamenti
app.get('/status', authenticate, async (req, res) => {
  try {
    const client = await getDBClient();
    const db = client.db('marketData');
    const collection = db.collection('products');

    const updates = await collection
      .aggregate([
        { $unwind: '$priceHistory' },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$priceHistory.timestamp' },
            },
            count: { $sum: 1 },
            timestamp: { $first: '$priceHistory.timestamp' },
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
        productsUpdated: u.count,
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

// Homepage con HTML
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Price Crawler Status</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
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
        h1 { color: #333; }
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
        #loading { display: none; color: #666; }
      </style>
    </head>
    <body>
      <h1>🤖 Price Crawler Status</h1>
      
      <div class="card">
        <h2>System Health</h2>
        <div id="loading">Loading...</div>
        <div id="health-data"></div>
        <button onclick="loadHealth()">Refresh</button>
      </div>
      
      <div class="card">
        <h2>Recent Updates</h2>
        <div id="status-data"></div>
        <button onclick="loadStatus()">Refresh</button>
      </div>
      
      <script>
        async function loadHealth() {
          document.getElementById('loading').style.display = 'block';
          try {
            const res = await fetch('/health');
            const data = await res.json();
            
            const statusClass = data.status === 'OK' ? 'status-ok' : 'status-error';
            
            document.getElementById('health-data').innerHTML = \`
              <div class="info-row">
                <strong>Status:</strong>
                <span class="\${statusClass}">\${data.status}</span>
              </div>
              <div class="info-row">
                <strong>Database:</strong>
                <span>\${data.database.connected ? '✅ Connected' : '❌ Disconnected'}</span>
              </div>
              <div class="info-row">
                <strong>Products Count:</strong>
                <span>\${data.database.productsCount || 0}</span>
              </div>
              <div class="info-row">
                <strong>Last Update:</strong>
                <span>\${data.database.lastUpdate ? new Date(data.database.lastUpdate).toLocaleString() : 'Never'}</span>
              </div>
              <div class="info-row">
                <strong>Cron Schedule:</strong>
                <span>\${data.cron?.description || 'Unknown'}</span>
              </div>
              <div class="info-row">
                <strong>Next Run:</strong>
                <span>\${data.cron?.nextRun ? new Date(data.cron.nextRun).toLocaleString() : 'Unknown'}</span>
              </div>
              <div class="info-row">
                <strong>Checked At:</strong>
                <span>\${new Date(data.timestamp).toLocaleString()}</span>
              </div>
            \`;
          } catch (error) {
            document.getElementById('health-data').innerHTML = \`
              <div class="status-error">Error loading data: \${error.message}</div>
            \`;
          }
          document.getElementById('loading').style.display = 'none';
        }
        
        async function loadStatus() {
          try {
            const res = await fetch('/status');
            const data = await res.json();
            
            if (data.recentUpdates && data.recentUpdates.length > 0) {
              document.getElementById('status-data').innerHTML = \`
                <table style="width:100%; border-collapse: collapse;">
                  <thead>
                    <tr style="border-bottom: 2px solid #ddd;">
                      <th style="text-align:left; padding:10px;">Date</th>
                      <th style="text-align:right; padding:10px;">Products Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    \${data.recentUpdates.map(u => \`
                      <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding:10px;">\${u.date}</td>
                        <td style="text-align:right; padding:10px;">\${u.productsUpdated}</td>
                      </tr>
                    \`).join('')}
                  </tbody>
                </table>
              \`;
            } else {
              document.getElementById('status-data').innerHTML = '<p>No updates yet</p>';
            }
          } catch (error) {
            document.getElementById('status-data').innerHTML = \`
              <div class="status-error">Error loading data: \${error.message}</div>
            \`;
          }
        }
        
        // Load on page load
        loadHealth();
        loadStatus();
        
        // Auto-refresh every 30 seconds
        setInterval(() => {
          loadHealth();
          loadStatus();
        }, 30000);
      </script>
    </body>
    </html>
  `);
});

function getNextCronRun(): string {
  const now = new Date();
  const next = new Date(now);
  next.setHours(2, 0, 0, 0);

  if (now.getHours() >= 2) {
    next.setDate(next.getDate() + 1);
  }

  return next.toISOString();
}

// Avvia il server Express
app.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`);
  console.log(`Visit the deployment URL to check status`);
});
