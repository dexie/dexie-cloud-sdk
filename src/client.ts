/**
 * Main Dexie Cloud SDK Client
 */
import type { DexieCloudConfig, DatabaseInfo, CreateDatabaseOptions, HealthStatus } from './types.js';
import { DexieCloudError } from './types.js';
import { createAdapter, type HttpAdapter } from './adapters.js';
import { AuthManager } from './auth.js';
import { DatabaseManager } from './database.js';
import { HealthManager } from './health.js';
import { DataManager } from './data.js';
import { BlobManager } from './blob.js';

export class DexieCloudClient {
  public readonly auth: AuthManager;
  public readonly databases: DatabaseManager;
  public readonly health: HealthManager;
  public readonly data: DataManager;
  public readonly blobs: BlobManager;

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
    if (fullConfig.dbUrl) {
      fullConfig.dbUrl = fullConfig.dbUrl.replace(/\/$/, '');
    }

    this.http = createAdapter(fullConfig);
    this.auth = new AuthManager(fullConfig, this.http);
    this.databases = new DatabaseManager(fullConfig, this.http);
    this.health = new HealthManager(fullConfig, this.http);

    // Use dbUrl if provided, otherwise fall back to serviceUrl
    const dbUrl = fullConfig.dbUrl ?? fullConfig.serviceUrl;
    this.blobs = new BlobManager(dbUrl, this.http, fullConfig.blobHandling ?? 'auto');
    // Pass BlobManager to DataManager so create/get/list auto-process blobs
    this.data = new DataManager(dbUrl, this.http, this.blobs);
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
    const { accessToken } = await this.auth.authenticateWithOTP(email, getOTP, ['CREATE_DB']);
    const dbInfo = await this.databases.create(accessToken, options);
    return { ...dbInfo, accessToken };
  }

  /** Convenience: Check if service is operational */
  async isReady(): Promise<boolean> {
    return this.health.ready();
  }

  /** Convenience: Get full health status */
  async getStatus(): Promise<HealthStatus> {
    return this.health.status();
  }

  /** Convenience: Wait for service to be ready */
  async waitForReady(timeout?: number): Promise<void> {
    return this.health.waitForReady(timeout);
  }
}
