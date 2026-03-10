/**
 * Dexie Cloud SDK — Blob CRUD Example
 * 
 * Demonstrates server-side data operations with blob offloading.
 * Uses client credentials (clientId/clientSecret from dexie-cloud.key).
 */

import { DexieCloudClient } from 'dexie-cloud-sdk';
import * as fs from 'fs';

// Read credentials from dexie-cloud.key or environment
const DB_URL = process.env.DEXIE_CLOUD_DB_URL;
const CLIENT_ID = process.env.DEXIE_CLOUD_CLIENT_ID;
const CLIENT_SECRET = process.env.DEXIE_CLOUD_CLIENT_SECRET;

if (!DB_URL || !CLIENT_ID || !CLIENT_SECRET) {
  console.error(`Set environment variables:
  DEXIE_CLOUD_DB_URL     — Your database URL (from dexie-cloud.key)
  DEXIE_CLOUD_CLIENT_ID  — Client ID (from dexie-cloud.key)
  DEXIE_CLOUD_CLIENT_SECRET — Client secret (from dexie-cloud.key)
  
Or source your dexie-cloud.key file directly.`);
  process.exit(1);
}

async function main() {
  // --- Initialize SDK ---
  
  const client = new DexieCloudClient({
    dbUrl: DB_URL,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    blobHandling: 'auto'  // Binary data handled transparently
  });

  console.log('🔑 Authenticating with client credentials...');
  const accessToken = await client.auth.getToken(['ACCESS_DB', 'GLOBAL_WRITE']);
  console.log('✅ Authenticated!\n');

  // --- Create item with binary data ---
  
  console.log('📝 Creating item with binary data...');
  
  const imageData = new Uint8Array(1024);
  crypto.getRandomValues(imageData);  // Random bytes for demo
  
  const item = await client.data.create('files', {
    name: 'test-image.bin',
    description: 'Demo binary file',
    createdAt: new Date(),
    data: imageData  // Auto-uploaded as blob!
  }, accessToken);
  
  console.log(`✅ Created: ${JSON.stringify(item, null, 2)}\n`);

  // --- Read it back (auto-resolves BlobRef) ---
  
  console.log('📖 Reading item back...');
  const retrieved = await client.data.get('files', item.id, accessToken);
  console.log(`  Name: ${retrieved.name}`);
  console.log(`  Data type: ${retrieved.data?.constructor?.name}`);
  console.log(`  Data size: ${retrieved.data?.length || retrieved.data?.size} bytes\n`);

  // --- List all items ---
  
  console.log('📋 Listing all files...');
  const allFiles = await client.data.list('files', accessToken);
  console.log(`  Found ${allFiles.length} file(s)\n`);

  // --- Direct blob operations ---
  
  console.log('🗄️ Direct blob upload...');
  const ref = await client.blobs.upload(
    new Uint8Array([72, 101, 108, 108, 111]),  // "Hello"
    accessToken,
    'text/plain'
  );
  console.log(`  Uploaded blob: ${ref}`);
  
  const downloaded = await client.blobs.download(ref, accessToken);
  console.log(`  Downloaded: ${new TextDecoder().decode(downloaded.data)}`);
  console.log(`  Content-Type: ${downloaded.contentType}\n`);

  // --- Cleanup ---
  
  console.log('🗑️ Cleaning up...');
  await client.data.delete('files', item.id, accessToken);
  console.log('✅ Done!\n');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
