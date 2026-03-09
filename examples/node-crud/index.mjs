/**
 * Dexie Cloud SDK — Node.js CRUD + Blob Example
 *
 * Demonstrates:
 * 1. Authentication with OTP
 * 2. Creating, reading, updating, and deleting objects
 * 3. Uploading and downloading blobs
 * 4. TSON type preservation (Date objects survive round-trip)
 */

import { DexieCloudClient } from 'dexie-cloud-sdk';
import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';

// ── Config ──

const SERVICE_URL = process.env.DEXIE_CLOUD_SERVICE_URL || 'https://dexie.cloud';
const DB_URL = process.env.DEXIE_CLOUD_DB_URL;
const EMAIL = process.env.DEXIE_CLOUD_EMAIL;

if (!DB_URL || !EMAIL) {
  console.error('Set DEXIE_CLOUD_DB_URL and DEXIE_CLOUD_EMAIL environment variables');
  process.exit(1);
}

// ── Helpers ──

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

// ── Main ──

const client = new DexieCloudClient({
  serviceUrl: SERVICE_URL,
  dbUrl: DB_URL,
  blobHandling: 'auto'  // Auto-upload blobs, auto-resolve on read
});

console.log('📧 Requesting OTP...');
const { accessToken } = await client.auth.authenticateWithOTP(
  EMAIL,
  async () => prompt('Enter OTP from email: '),
  ['ACCESS_DB']
);
console.log('✅ Authenticated!\n');

// ── CRUD Example ──

console.log('--- CRUD Operations ---\n');

// Create
const task = await client.data.create('todoItems', {
  title: 'Review SDK documentation',
  done: false,
  priority: 3,
  createdAt: new Date(),  // Date is preserved via TSON!
  tags: ['sdk', 'docs']
}, accessToken);
console.log('Created:', task);

// Read
const items = await client.data.list('todoItems', accessToken);
console.log(`\nAll items (${items.length}):`);
items.forEach(item => {
  console.log(`  - [${item.done ? '✓' : ' '}] ${item.title} (${item.createdAt})`);
});

// Update
await client.data.update('todoItems', task.id, {
  done: true,
  completedAt: new Date()
}, accessToken);
console.log('\nUpdated task to done ✓');

// ── Blob Example ──

console.log('\n--- Blob Operations ---\n');

// Upload a blob
const imageData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header
const ref = await client.blobs.upload(imageData, accessToken, 'image/png');
console.log('Uploaded blob, ref:', ref);

// Download
const { data, contentType } = await client.blobs.download(ref, accessToken);
console.log(`Downloaded: ${data.length} bytes, type: ${contentType}`);

// Auto-mode: Create object with inline binary → auto-uploads
const photoItem = await client.data.create('photos', {
  title: 'Example photo',
  image: new Uint8Array([1, 2, 3, 4, 5])  // Auto-uploaded as blob
}, accessToken);
console.log('\nCreated photo with auto-uploaded blob:', photoItem);

// Read back — blob is auto-resolved
const readBack = await client.data.get('photos', photoItem.id, accessToken);
console.log('Read back (auto-resolved):', readBack);

// ── Cleanup ──

await client.data.delete('todoItems', task.id, accessToken);
console.log('\n🧹 Cleaned up test data');
console.log('\nDone! ✨');
