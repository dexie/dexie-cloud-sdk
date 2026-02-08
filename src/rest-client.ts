/**
 * Dexie Cloud REST API Client
 * 
 * Main client for interacting with Dexie Cloud databases via REST API.
 * Uses client credentials authentication with automatic token management.
 * 
 * @example
 * ```typescript
 * import { DexieCloudClient } from 'dexie-cloud-sdk';
 * 
 * const client = new DexieCloudClient({
 *   databaseUrl: 'https://abc123.dexie.cloud',
 *   clientId: 'your-client-id',
 *   clientSecret: 'your-client-secret'
 * });
 * 
 * // List all todo items
 * const todos = await client.data.all.list('todoItems');
 * 
 * // Get user's data
 * const myTodos = await client.data.my.list('todoItems');
 * 
 * // Manage users
 * const users = await client.users.list({ type: 'eval' });
 * ```
 */

import type { DexieCloudConfig, AuthProvidersResponse, Scope } from './rest-types.js';
import { DexieCloudError } from './rest-types.js';
import { createAdapter, type HttpAdapter } from './adapters.js';
import { TokenManager } from './token-manager.js';
import { DataClient } from './data-client.js';
import { UsersClient } from './users-client.js';
import { AuthManager } from './auth.js'; // Keep legacy OTP support
import { HealthManager } from './health.js'; // Keep health checks

export class DexieCloudClient {
  public readonly data: DataClient;
  public readonly users: UsersClient;
  public readonly tokens: TokenManager;
  
  // Legacy support (for backward compatibility)
  public readonly auth: AuthManager;
  public readonly health: HealthManager;
  
  private readonly http: HttpAdapter;
  private readonly config: DexieCloudConfig;

  constructor(config: DexieCloudConfig) {
    // Validate required config
    if (!config.databaseUrl) {
      throw new DexieCloudError('databaseUrl is required');
    }
    if (!config.clientId) {
      throw new DexieCloudError('clientId is required');  
    }
    if (!config.clientSecret) {
      throw new DexieCloudError('clientSecret is required');
    }

    // Normalize database URL (remove trailing slash)
    this.config = {
      ...config,
      databaseUrl: config.databaseUrl.replace(/\/$/, ''),
    };

    // Initialize HTTP adapter
    this.http = createAdapter(this.config);

    // Initialize token manager
    this.tokens = new TokenManager(this.config, this.http);

    // Initialize API clients
    this.data = new DataClient(this.config, this.http, this.tokens);
    this.users = new UsersClient(this.config, this.http, this.tokens);

    // Legacy clients for backward compatibility
    this.auth = new AuthManager(this.config, this.http);
    this.health = new HealthManager(this.config, this.http);
  }

  /**
   * Get authentication providers for this database
   */
  async getAuthProviders(): Promise<AuthProvidersResponse> {
    const response = await this.http.fetch(`${this.config.databaseUrl}/auth-providers`);

    if (!response.ok) {
      throw new DexieCloudError(
        `Failed to get auth providers: ${await response.text()}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Validate current token
   */
  async validateToken(token?: string): Promise<boolean> {
    const tokenToValidate = token || await this.tokens.getAccessToken();
    
    try {
      const result = await this.tokens.validateToken(tokenToValidate);
      return result.valid;
    } catch {
      return false;
    }
  }

  /**
   * Clear all cached tokens (force refresh on next request)
   */
  clearTokenCache(): void {
    this.tokens.clearCache();
  }

  /**
   * Get a token for acting on behalf of a specific user
   * Requires IMPERSONATE scope on your client
   */
  async actAsUser(userId: string, email: string, name: string): Promise<DexieCloudClient> {
    // Create a new client instance that acts as the user
    const userClient = new DexieCloudClient({
      ...this.config,
      // We override the token manager to get user-specific tokens
    });

    // Replace the token manager with one that gets user tokens
    (userClient as any).tokens = {
      getAccessToken: async (scopes: Scope[] = ['ACCESS_DB']) => {
        return this.tokens.getTokenForUser(userId, email, name, scopes);
      },
      clearCache: () => this.tokens.clearCache(),
      validateToken: (token: string) => this.tokens.validateToken(token),
    };

    return userClient;
  }
}