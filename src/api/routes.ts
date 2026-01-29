import express from 'express';
import { getDBClient } from '../core/dbAuth/mongoAuth';
import { downloadAndMerge } from '../priceCrawler/priceRetriever';
export function setupApiRoutes(app: express.Application, authenticate: express.RequestHandler) {
  // GET /api/products - Lista prodotti con paginazione e filtri
  app.get('/api/products', authenticate, async (req, res) => {
    try {
      const client = await getDBClient();
      const db = client.db('marketData');
      const collection = db.collection('products');

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      const filter: any = {};

      if (req.query.name) {
        filter.name = { $regex: req.query.name as string, $options: 'i' };
      }

      if (req.query.category) {
        filter.idCategory = req.query.category as string;
      }

      if (req.query.expansion) {
        filter.idExpansion = Number(req.query.expansion) ?? 0;
      }

      if (req.query.rarity) {
        filter.rarity = req.query.rarity as string;
      }

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

  app.get('/api/cron', authenticate, async (req, res) => {
    console.log('Manual cron trigger requested');
    try {
      await downloadAndMerge();

      res.json({ message: 'Cron job triggered' });
    } catch (error: any) {
      console.error('Get cron status error:', error);
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

  app.get('/api/prices', authenticate, async (req, res) => {
    try {
      const client = await getDBClient();
      const db = client.db('marketData');
      const collection = db.collection('priceHistory');

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const skip = (page - 1) * limit;

      let match: any = {
        timestamp: {
          $gte: new Date(new Date().setUTCHours(0, 0, 0, 0)),
          $lte: new Date(new Date().setUTCHours(23, 59, 59, 999)),
        },

        avg1: { $gt: 0 },
      };

      if (req.query.category) {
        match['idCategory'] = req.query.category as string;
      }

      if (Number(req.query.minPrice) > 0) {
        match['avg1'] = { $gte: Number(req.query.minPrice) };
      }

      if (Number(req.query.maxPrice) > 0) {
        match['avg1'] = { $lte: Number(req.query.maxPrice) };
      }

      const agg = [
        {
          $match: match,
        },
        {
          $sort: {
            priceDelta: -1,
          },
        },
        {
          $skip: skip * page,
        },
        {
          $limit: limit,
        },
        {
          $lookup: {
            from: 'products',
            localField: 'idProduct',
            foreignField: 'idProduct',
            as: 'productsInfo',
          },
        },
      ];

      // Gestione parametro sort
      let sortField = 'priceDelta';
      if (req.query.sort && ['priceDelta', 'minPriceDelta', 'avg'].includes(req.query.sort as string)) {
        sortField = req.query.sort as string;
      }
      const [prices, total] = await Promise.all([collection.aggregate(agg).toArray(), collection.countDocuments(match)]);

      const totalPages = Math.ceil(total / limit);

      res.json({
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
  // GET /api/prices/:id - Storico prezzi per un prodotto
  app.get('/api/prices/:id', authenticate, async (req, res) => {
    try {
      const client = await getDBClient();
      const db = client.db('marketData');
      const collection = db.collection('priceHistory');

      const idProduct = parseInt(req.params.id as string);

      const dateFilter: any = { idProduct };

      if (req.query.from) {
        dateFilter.timestamp = { $gte: new Date(req.query.from as string) };
      }

      if (req.query.to) {
        dateFilter.timestamp = { ...dateFilter.timestamp, $lte: new Date(req.query.to as string) };
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const skip = (page - 1) * limit;

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

      const result = await collection.aggregate([{ $group: { _id: '$categoryName' } }, { $sort: { _id: 1 } }]).toArray();

      const categories = result.map((r) => r._id).filter((c) => c != null);

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
      const db = client.db('OnePieceProducts');
      const collection = db.collection('expansions');

      const result = await collection.find().toArray();

      const expansions = result.map(({ id, name }) => ({ id, name })).filter((e) => e != null);

      res.json({ expansions });
    } catch (error: any) {
      console.error('Get expansions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  console.log('✅ API routes configured');
}
