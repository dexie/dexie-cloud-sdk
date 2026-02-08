/**
 * Legacy Dexie Cloud Client (for database creation and OTP flows)
 * 
 * @deprecated Use DexieCloudClient from './rest-client.js' for REST API access
 */
import type { DexieCloudConfig, CreateDatabaseOptions, AuthTokens, HealthStatus } from './rest-types.js';
import { DexieCloudError, type DatabaseInfo } from './rest-types.js';
import { createAdapter, type HttpAdapter } from './adapters.js';
import { AuthManager } from './auth.js';
import { DatabaseManager } from './database.js';
import { HealthManager } from './health.js';

interface LegacyDexieCloudConfig {
  serviceUrl: string;
  timeout?: number;
  debug?: boolean;
  fetch?: typeof globalThis.fetch;
}

export class DexieCloudClient {
  public readonly auth: AuthManager;
  public readonly databases: DatabaseManager;
  public readonly health: HealthManager;
  
  private readonly http: HttpAdapter;

  constructor(config: LegacyDexieCloudConfig | string) {
    // Allow passing just URL as string for convenience
    const fullConfig: LegacyDexieCloudConfig = typeof config === 'string' 
      ? { serviceUrl: config }
      : config;

    // Validate service URL
    if (!fullConfig.serviceUrl) {
      throw new DexieCloudError('serviceUrl is required');
    }

    // Remove trailing slash for consistency
    fullConfig.serviceUrl = fullConfig.serviceUrl.replace(/\/$/, '');

    // Convert to new config format
    const restConfig: DexieCloudConfig = {
      databaseUrl: fullConfig.serviceUrl, // Legacy uses serviceUrl
      clientId: '', // Not used in legacy mode
      clientSecret: '', // Not used in legacy mode
      timeout: fullConfig.timeout,
      debug: fullConfig.debug,
      fetch: fullConfig.fetch,
    };

    this.http = createAdapter(restConfig);
    this.auth = new AuthManager(restConfig, this.http);
    this.databases = new DatabaseManager(restConfig, this.http);
    this.health = new HealthManager(restConfig, this.http);
  }

  /**
   * Convenience method: Full database creation flow with OTP
   * 1. Request OTP → 2. Get OTP from callback → 3. Verify → 4. Create DB
   */
  async createDatabase(
    email: string,
    getOTP: () => Promise<string>,
    options: CreateDatabaseOptions = {}
  ): Promise<DatabaseInfo & { accessToken: string }> {
    // Authenticate
    const { accessToken } = await this.auth.authenticateWithOTP(email, getOTP, ['CREATE_DB']);
    
    // Create database
    const dbInfo = await this.databases.create(accessToken, options);
    
    return { ...dbInfo, accessToken };
  }

  /**
   * Convenience method: Check if service is operational
   */
  async isReady(): Promise<boolean> {
    return this.health.ready();
  }

  /**
   * Convenience method: Get full health status
   */
  async getStatus(): Promise<HealthStatus> {
    return this.health.status();
  }

  /**
   * Convenience method: Wait for service to be ready
   */
  async waitForReady(timeout?: number): Promise<void> {
    return this.health.waitForReady(timeout);
  }
}