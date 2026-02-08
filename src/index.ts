/**
 * Dexie Cloud SDK - Official JavaScript client for Dexie Cloud
 * 
 * Supports two main use cases:
 * 1. REST API client for existing databases (client credentials)
 * 2. Database creation and OTP authentication (legacy)
 * 
 * @example REST API Client
 * ```typescript
 * import { DexieCloudClient } from 'dexie-cloud-sdk';
 * 
 * const client = new DexieCloudClient({
 *   databaseUrl: 'https://abc123.dexie.cloud',
 *   clientId: 'your-client-id',
 *   clientSecret: 'your-client-secret'
 * });
 * 
 * // Access all data (requires GLOBAL_READ scope)
 * const allTodos = await client.data.all.list('todoItems');
 * 
 * // Access user's data (requires ACCESS_DB scope)  
 * const myTodos = await client.data.my.list('todoItems');
 * 
 * // Manage users (requires GLOBAL_WRITE scope)
 * const users = await client.users.list({ type: 'eval' });
 * ```
 * 
 * @example Legacy Database Creation
 * ```typescript
 * import { DexieCloudClient } from 'dexie-cloud-sdk';
 * 
 * const client = new DexieCloudClient('https://dexie.cloud');
 * 
 * const db = await client.createDatabase('user@example.com', async () => {
 *   return await getOTPFromEmail();
 * });
 * ```
 */

// Main exports - REST API Client
export { DexieCloudClient } from './rest-client.js';

// Types for REST API
export type {
  DexieCloudConfig,
  TokenResponse,
  ClientCredentialsRequest,
  Scope,
  TokenValidation,
  AuthProvider,
  AuthProvidersResponse,
  DBUser,
  UsersListResponse,
  UsersListQuery,
  DataFilter,
  RestEndpointConfig,
  TSONType,
} from './rest-types.js';

// Legacy client (for database creation and OTP)
export { DexieCloudClient as LegacyDexieCloudClient } from './client.js';

// Legacy types (for backward compatibility)
export type {
  OTPRequest,
  OTPVerification,
  DatabaseInfo,
  CreateDatabaseOptions,
  AuthTokens,
  DatabaseTokens,
  HealthStatus,
} from './rest-types.js';

// Individual managers (for advanced usage)
export { TokenManager } from './token-manager.js';
export { DataClient } from './data-client.js';
export { UsersClient } from './users-client.js';
export { AuthManager } from './auth.js';
export { DatabaseManager } from './database.js';
export { HealthManager } from './health.js';

// Errors
export {
  DexieCloudError,
  DexieCloudAuthError,
  DexieCloudNetworkError,
} from './rest-types.js';

// Adapters (for advanced usage)
export {
  createAdapter,
  FetchAdapter,
  NodeAdapter,
  type HttpAdapter,
} from './adapters.js';

// Default export - REST API Client
export { DexieCloudClient as default } from './rest-client.js';