import { getDBClient } from '../core/dbAuth/mongoAuth';
import fs from 'fs/promises';
import path from 'path';

async function downloadImage(url: string, filePath: string): Promise<boolean> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fs.writeFile(filePath, buffer);
    return true;
  } catch (error: any) {
    console.error(`Failed to download ${url}:`, error.message);
    return false;
  }
}

async function downloadAllImages() {
  console.log('Starting image download process...');

  const client = await getDBClient();
  const ctraderDataCollection = client.db('OnePieceProducts').collection('ctraderData');

  // Get all blueprints from MongoDB
  const blueprints = await ctraderDataCollection.find().toArray();

  if (!blueprints || blueprints.length === 0) {
    console.log('No blueprints found in the database.');
    return;
  }

  console.log(`Found ${blueprints.length} blueprints`);

  // Create images directory if it doesn't exist
  const imagesDir = path.join(process.cwd(), 'images');
  await fs.mkdir(imagesDir, { recursive: true });

  let downloadedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < blueprints.length; i++) {
    const blueprint = blueprints[i];

    if (!blueprint || !blueprint.id) {
      skippedCount++;
      continue;
    }

    console.log(`[${i + 1}/${blueprints.length}] Processing blueprint ${blueprint.id} (${blueprint.name})...`);

    // Download big image
    // if (blueprint.big_image) {
    //   const bigImageUrl = blueprint.big_image.startsWith('http') ? blueprint.big_image : `https://cardtrader.com${blueprint.big_image}`;
    //   const bigImagePath = path.join(imagesDir, `${blueprint.id}_BIG.jpg`);

    //   // Check if file already exists
    //   try {
    //     await fs.access(bigImagePath);
    //     console.log(`  ⏭️  Big image already exists, skipping...`);
    //     skippedCount++;
    //   } catch {
    //     const success = await downloadImage(bigImageUrl, bigImagePath);
    //     if (success) {
    //       console.log(`  ✓ Downloaded big image`);
    //       downloadedCount++;
    //     } else {
    //       errorCount++;
    //     }
    //   }
    // }

    // Download small image
    if (blueprint.small_image) {
      const smallImageUrl = blueprint.small_image.startsWith('http') ? blueprint.small_image : `https://cardtrader.com${blueprint.small_image}`;

      const smallImagePath = path.join(imagesDir, `${blueprint.id}_SMALL.jpg`);

      // Check if file already exists
      try {
        await fs.access(smallImagePath);
        console.log(`  ⏭️  Small image already exists, skipping...`);
        skippedCount++;
      } catch {
        const success = await downloadImage(smallImageUrl, smallImagePath);
        if (success) {
          console.log(`  ✓ Downloaded small image`);
          downloadedCount++;
        } else {
          errorCount++;
        }
      }
    }

    // Rate limiting: 60ms delay between blueprints (affects overall download speed)
    if (i < blueprints.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  }

  console.log(`\n✅ Download completed!`);
  console.log(`   📥 Downloaded: ${downloadedCount} images`);
  console.log(`   ⏭️  Skipped: ${skippedCount} images (already exist)`);
  console.log(`   ❌ Errors: ${errorCount} images`);
  console.log(`   📁 Images saved to: ${imagesDir}`);
}

// Run the function if this file is executed directly
if (require.main === module) {
  downloadAllImages()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { downloadAllImages };
