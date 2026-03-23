/**
 * E2E test helpers — MailHog OTP extraction and DB provisioning.
 */

const SERVICE_URL = process.env.DEXIE_CLOUD_URL ?? 'http://localhost:3000';
const MAILHOG_API = process.env.MAILHOG_API ?? 'http://localhost:8025';

import { DexieCloudClient, type DatabaseInfo } from '../src/index.js';

/**
 * Fetch the latest OTP code from MailHog for a given email address.
 * Retries a few times to account for delivery latency.
 */
export async function getOTPFromMailHog(email: string, retries = 10, delayMs = 500): Promise<string> {
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
      // OTP is a 6-8 digit code, typically on its own line or after "OTP:" / "code:"
      const match = body.match(/\b(\d{6,8})\b/);
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
 * Provision a fresh database for testing.
 * Returns the DB info (url, clientId, clientSecret).
 */
export async function provisionDatabase(
  email = 'test@dexie.local',
): Promise<DatabaseInfo & { accessToken: string }> {
  const client = new DexieCloudClient(SERVICE_URL);
  await client.waitForReady(30_000);
  await clearMailHog();
  const dbInfo = await client.createDatabase(email, () => getOTPFromMailHog(email));
  return dbInfo;
}

export { SERVICE_URL, MAILHOG_API };
