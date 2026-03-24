/**
 * E2E test helpers — MailHog OTP extraction and DB provisioning.
 */

const SERVICE_URL = process.env.DEXIE_CLOUD_URL ?? 'http://localhost:3001';
const MAILHOG_API = process.env.MAILHOG_API ?? 'http://localhost:8026';

import { DexieCloudClient, type DatabaseInfo } from '../src/index.js';

/**
 * Fetch the latest OTP code from MailHog for a given email address.
 * Retries a few times to account for delivery latency.
 */
export async function getOTPFromMailHog(email: string, retries = 15, delayMs = 500): Promise<string> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(`${MAILHOG_API}/api/v2/search?kind=to&query=${encodeURIComponent(email)}`);
    if (!res.ok) throw new Error(`MailHog search failed: ${res.status}`);
    const data = await res.json() as any;
    const items = data?.items ?? [];
    if (items.length > 0) {
      // Sort newest first
      items.sort((a: any, b: any) => {
        const da = new Date(a.Created).getTime();
        const db = new Date(b.Created).getTime();
        return db - da;
      });
      const body: string = items[0].Content?.Body ?? '';
      // OTP is alphanumeric (e.g. 838VQGBJ), appears after "OTP:" or similar
      const match = body.match(/OTP[^:]*:\s*([A-Z0-9]{6,10})/i) ?? body.match(/\b([A-Z0-9]{6,10})\b/);
      if (match) return match[1]!;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`No OTP found for ${email} after ${retries} retries`);
}

/**
 * Clear all MailHog messages.
 */
export async function clearMailHog(): Promise<void> {
  await fetch(`${MAILHOG_API}/api/v1/messages`, { method: 'DELETE' });
}

/**
 * Import a minimal schema into the database so the REST API knows the
 * primary key for each table (required before any data operations).
 */
async function importSchema(dbUrl: string, clientId: string, clientSecret: string): Promise<void> {
  // Get a client_credentials token with MANAGE_DB scope for the import endpoint
  const tokenRes = await fetch(`${dbUrl}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scopes: ['ACCESS_DB', 'MANAGE_DB', 'GLOBAL_READ', 'GLOBAL_WRITE'],
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Token fetch for schema import failed (${tokenRes.status}): ${await tokenRes.text()}`);
  }
  const { accessToken } = await tokenRes.json() as any;

  const schema = {
    todoItems: '@id, title, done, realmId',  // @ = auto-generated global ID
    photos: '@id, title, realmId',
  };

  const response = await fetch(`${dbUrl}/import`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-tson',
    },
    body: JSON.stringify({ schema }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Schema import failed (${response.status}): ${text}`);
  }
}

/**
 * Provision a fresh database for testing.
 * Returns the DB info (url, clientId, clientSecret, accessToken).
 */
export async function provisionDatabase(
  email = 'test@dexie.local',
): Promise<DatabaseInfo & { accessToken: string }> {
  const client = new DexieCloudClient(SERVICE_URL);
  await client.waitForReady(30_000);
  await clearMailHog();
  const dbInfo = await client.createDatabase(email, () => getOTPFromMailHog(email));

  // Import schema so the REST API can handle data operations
  await importSchema(dbInfo.url, dbInfo.clientId, dbInfo.clientSecret);

  return dbInfo;
}

export { SERVICE_URL, MAILHOG_API };
