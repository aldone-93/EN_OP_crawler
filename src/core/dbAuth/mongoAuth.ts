import 'dotenv/config';
import { MongoClient, ServerApiVersion } from 'mongodb';

const mongoPass = process.env.mongoPass; // Legge da .env
const uri = `mongodb+srv://aldone93:${mongoPass}@cluster0.cve1h0c.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

export async function connectMongoDB() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } catch {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

export async function getDBClient() {
  if (!client) {
    await connectMongoDB();
  }
  return client;
}

connectMongoDB().catch(console.dir);
