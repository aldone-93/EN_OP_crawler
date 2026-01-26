import express from 'express';
import 'dotenv/config';
import { setupApiRoutes } from './routes';
import { setupHealthRoutes, getHomepageHTML } from '../health/routes';
import cors from 'cors';

const options = {
  origin: 'https://pricepiece-production.up.railway.app',
};

const app = express();
app.use(cors(options));
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

console.log('🚀 Starting One Piece TCG API Server...');

// Middleware per autenticazione
function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!API_KEY) {
    console.log('⚠️  API_KEY not set - authentication disabled');
    return next();
  }

  const providedKey = req.headers['x-api-key'] || req.query.key;

  if (providedKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

// Setup routes
console.log('📋 Configuring routes...');

// Homepage
app.get('/', (req, res) => {
  res.send(getHomepageHTML());
});

setupHealthRoutes(app, authenticate);
setupApiRoutes(app, authenticate);

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📖 Documentation: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 API base: http://localhost:${PORT}/api`);
});
