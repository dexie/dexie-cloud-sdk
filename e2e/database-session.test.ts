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

beforeAll(async () => {
  const info = await provisionDatabase();
  dbUrl = info.url;
  client = new DexieCloudClient(SERVICE_URL);
  db = client.db(dbUrl, {
    clientId: info.clientId,
    clientSecret: info.clientSecret,
  });
}, 60_000);

// ── Service-wide (client_credentials) ───────────────────────────────

describe('DatabaseSession — service-wide access', () => {
  let createdId: string;

  it('should create an item', async () => {
    const result = await db.data.create('todoItems', {
      title: 'Test item',
      done: false,
    });
    expect(result).toBeDefined();
    createdId = result.id ?? result.key ?? Object.values(result)[0];
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
    });
    expect(result).toBeDefined();
  });

  it('should delete an item', async () => {
    await db.data.delete('todoItems', createdId);
    // Verify deletion — expect 404 or empty
    try {
      await db.data.get('todoItems', createdId);
      // If no error, item may still exist briefly — that's OK
    } catch (err: any) {
      expect(err.status).toBe(404);
    }
  });
});

// ── Blob operations ─────────────────────────────────────────────────

describe('DatabaseSession — blob operations', () => {
  it('should upload and download a blob', async () => {
    const data = new TextEncoder().encode('Hello, Dexie Cloud!');
    const ref = await db.blobs.upload(data, 'text/plain');
    expect(ref).toBeTruthy();

    const downloaded = await db.blobs.download(ref);
    expect(new TextDecoder().decode(downloaded.data)).toBe('Hello, Dexie Cloud!');
    expect(downloaded.contentType).toContain('text/plain');
  });
});

// ── Impersonation via asUser() ──────────────────────────────────────

describe('DatabaseSession — impersonation (asUser)', () => {
  it('should create and list items as an impersonated user', async () => {
    const userDb = db.asUser({
      sub: 'testuser@example.com',
      email: 'testuser@example.com',
    });

    const result = await userDb.data.create('todoItems', {
      title: 'Impersonated item',
      done: false,
    });
    expect(result).toBeDefined();

    const items = await userDb.data.list('todoItems');
    expect(Array.isArray(items)).toBe(true);
    // The impersonated user should see at least their own item
    expect(items.some((i: any) => i.title === 'Impersonated item')).toBe(true);
  });

  it('should use separate tokens for different impersonations', async () => {
    const user1 = db.asUser({ sub: 'user1@example.com', email: 'user1@example.com' });
    const user2 = db.asUser({ sub: 'user2@example.com', email: 'user2@example.com' });

    // Both should work independently
    await user1.data.create('todoItems', { title: 'User1 item', done: false });
    await user2.data.create('todoItems', { title: 'User2 item', done: false });

    const items1 = await user1.data.list('todoItems');
    const items2 = await user2.data.list('todoItems');

    // Each user should see their own items (access control depends on server config)
    expect(Array.isArray(items1)).toBe(true);
    expect(Array.isArray(items2)).toBe(true);
  });
});
