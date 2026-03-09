/**
 * Dexie Cloud SDK — Blob CRUD Example
 * 
 * Demonstrates server-side data operations with blob offloading.
 */

import { DexieCloudClient } from 'dexie-cloud-sdk';
import * as fs from 'fs';
import * as readline from 'readline/promises';

const DB_URL = process.env.DEXIE_CLOUD_DB_URL;
const EMAIL = process.env.DEXIE_CLOUD_EMAIL;

if (!DB_URL || !EMAIL) {
  console.error('Set DEXIE_CLOUD_DB_URL and DEXIE_CLOUD_EMAIL environment variables');
  process.exit(1);
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  // --- Initialize SDK ---
  
  const client = new DexieCloudClient({
    serviceUrl: 'https://dexie.cloud',
    dbUrl: DB_URL,
    blobHandling: 'auto'  // Binary data handled transparently
  });

  console.log('🔑 Authenticating...');
  
  // --- Authenticate ---
  
  const { accessToken } = await client.auth.authenticateWithOTP(
    EMAIL,
    async () => {
      const otp = await rl.question('Enter OTP from email: ');
      return otp.trim();
    },
    ['ACCESS_DB']
  );
  
  console.log('✅ Authenticated!\n');

  // --- Create item with binary data ---
  
  console.log('📝 Creating item with binary data...');
  
  // Create a sample image (or read from file)
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

  rl.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
