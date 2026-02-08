/**
 * Main Dexie Cloud SDK Client
 */
import type { DexieCloudConfig, DatabaseInfo, CreateDatabaseOptions, AuthTokens, HealthStatus } from './types.js';
import { DexieCloudError } from './types.js';
import { createAdapter, type HttpAdapter } from './adapters.js';
import { AuthManager } from './auth.js';
import { DatabaseManager } from './database.js';
import { HealthManager } from './health.js';

export class DexieCloudClient {
  public readonly auth: AuthManager;
  public readonly databases: DatabaseManager;
  public readonly health: HealthManager;
  
  private readonly http: HttpAdapter;

  constructor(config: DexieCloudConfig | string) {
    // Allow passing just URL as string for convenience
    const fullConfig: DexieCloudConfig = typeof config === 'string' 
      ? { serviceUrl: config }
      : config;

    // Validate service URL
    if (!fullConfig.serviceUrl) {
      throw new DexieCloudError('serviceUrl is required');
    }

    // Remove trailing slash for consistency
    fullConfig.serviceUrl = fullConfig.serviceUrl.replace(/\/$/, '');

    this.http = createAdapter(fullConfig);
    this.auth = new AuthManager(fullConfig, this.http);
    this.databases = new DatabaseManager(fullConfig, this.http);
    this.health = new HealthManager(fullConfig, this.http);
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