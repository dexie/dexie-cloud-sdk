/**
 * Database operations module
 */
import type { 
  DatabaseInfo, 
  CreateDatabaseOptions,
  DexieCloudConfig 
} from './rest-types.js';
import { DexieCloudError } from './rest-types.js';
import type { HttpAdapter } from './adapters.js';

export class DatabaseManager {
  constructor(
    private config: DexieCloudConfig,
    private http: HttpAdapter
  ) {}

  private get serviceUrl(): string {
    return `${this.config.databaseUrl}/service`;
  }

  /**
   * Create a new database (requires authenticated token with CREATE_DB scope)
   */
  async create(
    accessToken: string,
    options: CreateDatabaseOptions = {}
  ): Promise<DatabaseInfo> {
    const response = await this.http.fetch(`${this.serviceUrl}/create-db`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        timeZone: options.timeZone || 'UTC',
        ...(options.hackathon && { hackathon: true }),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new DexieCloudError(
        `Failed to create database: ${error}`,
        response.status
      );
    }

    const data = await response.json() as DatabaseInfo;
    if (!data.url) {
      throw new DexieCloudError(`Invalid response: ${JSON.stringify(data)}`);
    }

    return data;
  }

  /**
   * List databases accessible to user (placeholder - API not documented yet)
   */
  async list(accessToken: string): Promise<DatabaseInfo[]> {
    // TODO: Implement when API is available
    throw new Error('List databases API not yet implemented');
  }

  /**
   * Get database information by URL (placeholder)
   */
  async getInfo(dbUrl: string, accessToken: string): Promise<DatabaseInfo> {
    // TODO: Implement when API is available
    throw new Error('Database info API not yet implemented');
  }

  /**
   * Delete database (placeholder - use with extreme caution!)
   */
  async delete(dbUrl: string, accessToken: string): Promise<void> {
    // TODO: Implement when API is available
    throw new Error('Delete database API not yet implemented');
  }
}