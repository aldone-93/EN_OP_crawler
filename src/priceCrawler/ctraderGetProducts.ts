import { getDBClient } from '../core/dbAuth/mongoAuth';

async function getAllBlueprints() {
  console.log('Downloading price guide...');

  if (!process.env.PRICES_URL) {
    throw new Error('PRICES_URL is not defined in environment variables');
  }

  const client = await getDBClient();
  const expansionsCollection = client.db('OnePieceProducts').collection('ctrader expansions');

  const expansions = await expansionsCollection.find().toArray();

  if (!expansions || expansions.length === 0) {
    console.log('No expansions found in the database.');
    return;
  }

  const API_URL = 'https://api.cardtrader.com/api/v2/blueprints/export';
  const AUTH_TOKEN =
    'eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJjYXJkdHJhZGVyLXByb2R1Y3Rpb24iLCJzdWIiOiJhcHA6MTQwNDkiLCJhdWQiOiJhcHA6MTQwNDkiLCJleHAiOjQ5MjU3MjA1NTgsImp0aSI6IjQwNzI2YzFhLWQ3YWItNDU1Mi1iYTUyLTZkMmM2NjMzOTg3OSIsImlhdCI6MTc3MDA0Njk1OCwibmFtZSI6IkFsZG9uZTkzIEFwcCAyMDI1MDIxNTE3NTg1NiJ9.SWJ2XPtqJ3mGp3wadENjfmJBbzkPjA3Hd3wsYFJ9V0BoREfVISe56k6JdPmO5URxxjqCg2qk6jJk_lIcB2zVQ18TrBfFiyIU2sDxcstxAab2OL4VQRlr2hesK3sM4nC-UngHtB6GWyO3ypmD8BYBup1lLFEe8OErXses0fTwkHFJCJ5JY-w6duQ9ZCfKxSPqy7iCZkFcJ7ZZFC9lEosQBGcV5dV9DGnofUxI3ivXrmmgiVfZ7rGo5s3PWfsiTU6uq0j7Y6H1PrvSpjj6rhgBxhr7Fb646fW8y3M3-hTzWfhBv5j1f8_F-tIla3T94wVcatZxKy-nFuy9qcmqPvW28A';

  const results: any[] = [];
  const DELAY_MS = 60; // 60ms delay = ~16.6 requests per second, safely under 20/sec limit

  for (let i = 0; i < expansions.length; i++) {
    const expansion = expansions[i];

    if (!expansion) continue;

    try {
      console.log(`[${i + 1}/${expansions.length}] Fetching data for expansion_id ${expansion.id} (${expansion.name})...`);

      const response = await fetch(`${API_URL}?expansion_id=${expansion.id}`, {
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      results.push({
        expansionId: expansion.id,
        expansionName: expansion.name,
        expansionCode: expansion.code,
        data: data.map((item: any) => ({
          id: item.id,
          name: item.name,
          category_id: item.card_code,
          game_id: item.game_id,
          version: item.version,
          expansion_id: expansion.id,
          card_market_ids: item.card_market_ids,
          fixed_properties: item.fixed_properties,
          big_image: item.image.url,
          small_image: item.image.preview.url,
          tcg_player_id: item.tcg_player_id,
        })),
      });

      console.log(`✓ Success for expansion_id ${expansion.id} - ${data.length || 0} blueprints`);
    } catch (error: any) {
      console.error(`✗ Error for expansion_id ${expansion.id}:`, error.message);
      results.push({
        expansionId: expansion.id,
        expansionName: expansion.name,
        expansionCode: expansion.code,
        error: error.message,
      });
    }

    // Rate limiting: wait between requests to stay under 20/sec
    if (i < expansions.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  // Save results to MongoDB
  const ctraderDataCollection = client.db('OnePieceProducts').collection('ctraderData');

  // Flatten all blueprints from all expansions
  const allBlueprints: any[] = [];
  for (const result of results) {
    if (result.data && Array.isArray(result.data)) {
      allBlueprints.push(...result.data);
    }
  }

  if (allBlueprints.length > 0) {
    console.log(`\n💾 Saving ${allBlueprints.length} blueprints to MongoDB...`);

    // Use bulk operations for better performance
    const bulkOps = allBlueprints.map((blueprint) => ({
      updateOne: {
        filter: { id: blueprint.id },
        update: { $set: blueprint },
        upsert: true,
      },
    }));

    await ctraderDataCollection.bulkWrite(bulkOps);
    console.log(`✅ Successfully saved/updated ${allBlueprints.length} blueprints in MongoDB`);
  } else {
    console.log(`⚠️  No blueprints to save`);
  }

  console.log(`\n✅ Completed! Fetched ${results.length} expansions`);
}

// Run the function if this file is executed directly
if (require.main === module) {
  getAllBlueprints()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { getAllBlueprints };
