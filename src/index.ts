/**
 * Dexie Cloud SDK - Official JavaScript client for Dexie Cloud
 * 
 * @example
 * ```typescript
 * import { DexieCloudClient } from 'dexie-cloud-sdk';
 * 
 * const client = new DexieCloudClient('https://dexie.cloud');
 * 
 * // Create database with OTP authentication
 * const db = await client.createDatabase('user@example.com', async () => {
 *   // Return OTP from email, MailHog, etc.
 *   return '123456';
 * });
 * ```
 */

// Main exports
export { DexieCloudClient } from './client.js';
export { AuthManager } from './auth.js';
export { DatabaseManager } from './database.js';
export { HealthManager } from './health.js';

// Types
export type {
  DexieCloudConfig,
  OTPRequest,
  OTPVerification,
  TokenResponse,
  DatabaseInfo,
  CreateDatabaseOptions,
  AuthTokens,
  DatabaseTokens,
  HealthStatus,
} from './types.js';

// Errors
export {
  DexieCloudError,
  DexieCloudAuthError,
  DexieCloudNetworkError,
} from './types.js';

// Adapters (for advanced usage)
export {
  createAdapter,
  FetchAdapter,
  NodeAdapter,
  type HttpAdapter,
} from './adapters.js';

// Default export for convenience
export { DexieCloudClient as default } from './client.js';