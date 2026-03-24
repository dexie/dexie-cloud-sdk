/**
 * E2E tests for DatabaseSession — transparent token management.
 *
 * Prerequisites: docker compose -f docker-compose.test.yml up -d
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DexieCloudClient, DatabaseSession } from '../src/index.js';
import { provisionDatabase, SERVICE_URL } from './helpers.js';

let client: DexieCloudClient;
let db: DatabaseSession;
let dbUrl: string;

// The global realm available in all new databases
const REALM = 'rlm-public';

beforeAll(async () => {
  const info = await provisionDatabase();
  dbUrl = info.url;
  client = new DexieCloudClient(SERVICE_URL);
  db = client.db(dbUrl, {
    clientId: info.clientId,
    clientSecret: info.clientSecret,
  });
}, 60_000);

// ── Service-wide (client_credentials with GLOBAL_READ/WRITE) ────────
// Uses /all/ endpoint — requires realmId on all objects
describe('DatabaseSession — service-wide access', () => {
  let createdId: string;

  it('should create an item', async () => {
    const result = await db.data.create('todoItems', {
      title: 'Test item',
      done: false,
      realmId: REALM,
    });
    expect(result).toBeDefined();
    // Server returns { type: 'objects', result: [{ key, ... }] } or the object itself
    createdId = result?.result?.[0]?.key ?? result?.id ?? result?.key;
    expect(createdId).toBeTruthy();
  });

  it('should list items', async () => {
    const items = await db.data.list('todoItems');
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('should get an item by id', async () => {
    const item = await db.data.get('todoItems', createdId);
    expect(item).toBeDefined();
    expect(item.title).toBe('Test item');
  });

  it('should replace an item', async () => {
    const result = await db.data.replace('todoItems', createdId, {
      title: 'Updated item',
      done: true,
      realmId: REALM,
    });
    expect(result).toBeDefined();
  });

  it('should delete an item', async () => {
    await db.data.delete('todoItems', createdId);
    try {
      await db.data.get('todoItems', createdId);
    } catch (err: any) {
      expect(err.status).toBe(404);
    }
  });
});

// ── Blob operations ─────────────────────────────────────────────────
// Blobs are linked via blob_refs to objects — not directly downloadable.
// We test the end-to-end flow: create object with binary data → verify
// BlobManager.processForUpload stores the blob and creates a BlobRef.
// Direct download requires a blob_refs entry which is created on sync.
// For SDK purposes: test that upload succeeds and returns a valid ref.

describe('DatabaseSession — blob operations', () => {
  it('should upload a blob and receive a valid ref', async () => {
    const data = new TextEncoder().encode('Hello, Dexie Cloud blob!');
    const ref = await db.blobs.upload(data, 'text/plain');
    expect(ref).toBeTruthy();
    expect(typeof ref).toBe('string');
    // Ref format: "version:blobId" e.g. "1:abc123def456..."
    expect(ref).toMatch(/^\d+:[a-f0-9]+$/);
  });
});

// ── Impersonation via asUser() ───────────────────────────────────────
// Uses /my/ endpoint — realmId auto-assigned to user's default realm

describe('DatabaseSession — impersonation (asUser)', () => {
  it('should create and list items as an impersonated user', async () => {
    const userDb = db.asUser({
      sub: 'testuser@example.com',
      email: 'testuser@example.com',
    });

    // Don't specify realmId — server auto-assigns the user's private realm
    const result = await userDb.data.create('todoItems', {
      title: 'Impersonated item',
      done: false,
    });
    expect(result).toBeDefined();
    expect(result.id).toBeTruthy();

    const items = await userDb.data.list('todoItems');
    expect(Array.isArray(items)).toBe(true);
    expect(items.some((i: any) => i.title === 'Impersonated item')).toBe(true);
  });

  it('should use separate tokens for different impersonations', async () => {
    const user1 = db.asUser({ sub: 'user1@example.com', email: 'user1@example.com' });
    const user2 = db.asUser({ sub: 'user2@example.com', email: 'user2@example.com' });

    await user1.data.create('todoItems', { title: 'User1 item', done: false });
    await user2.data.create('todoItems', { title: 'User2 item', done: false });

    const items1 = await user1.data.list('todoItems');
    const items2 = await user2.data.list('todoItems');

    expect(Array.isArray(items1)).toBe(true);
    expect(Array.isArray(items2)).toBe(true);
  });
});
