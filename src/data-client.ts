/**
 * REST Data Client for Dexie Cloud
 * Provides type-safe access to /all, /my, and /public endpoints
 */
import type { 
  DexieCloudConfig,
  RestEndpointConfig,
  DataFilter,
  Scope
} from './rest-types.js';
import { DexieCloudError } from './rest-types.js';
import type { HttpAdapter } from './adapters.js';
import { TokenManager } from './token-manager.js';

export class DataClient {
  private tokenManager: TokenManager;

  constructor(
    private config: DexieCloudConfig,
    private http: HttpAdapter,
    tokenManager: TokenManager
  ) {
    this.tokenManager = tokenManager;
  }

  /**
   * Access all data (requires GLOBAL_READ scope)
   */
  get all() {
    return new DataEndpoint(this.config, this.http, this.tokenManager, 'all');
  }

  /**
   * Access user's data (requires ACCESS_DB scope)
   */
  get my() {
    return new DataEndpoint(this.config, this.http, this.tokenManager, 'my');
  }

  /**
   * Access public data (no auth required for GET)
   */
  get public() {
    return new DataEndpoint(this.config, this.http, this.tokenManager, 'public');
  }
}

class DataEndpoint {
  constructor(
    private config: DexieCloudConfig,
    private http: HttpAdapter,
    private tokenManager: TokenManager,
    private endpoint: 'all' | 'my' | 'public'
  ) {}

  /**
   * Get all objects from a table
   */
  async list<T = any>(table: string, options: {
    filters?: DataFilter;
    realmId?: string;
  } = {}): Promise<T[]> {
    const url = this.buildUrl(table, options);
    
    const headers: Record<string, string> = {};
    
    // Public endpoint doesn't need auth for GET
    if (this.endpoint !== 'public') {
      const token = await this.getTokenForEndpoint();
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await this.http.fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new DexieCloudError(
        `Failed to list ${table}: ${await response.text()}`,
        response.status
      );
    }

    const data = await this.parseResponse(response);
    return data;
  }

  /**
   * Get single object by primary key
   */
  async get<T = any>(
    table: string, 
    primaryKey: string | number | Array<string | number>
  ): Promise<T | null> {
    const encodedKey = this.encodePrimaryKey(primaryKey);
    const url = `${this.config.databaseUrl}/${this.endpoint}/${encodeURIComponent(table)}/${encodedKey}`;
    
    const headers: Record<string, string> = {};
    
    if (this.endpoint !== 'public') {
      const token = await this.getTokenForEndpoint();
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await this.http.fetch(url, {
      method: 'GET',
      headers,
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new DexieCloudError(
        `Failed to get ${table}/${primaryKey}: ${await response.text()}`,
        response.status
      );
    }

    return this.parseResponse(response);
  }

  /**
   * Create or update objects (upsert)
   */
  async save<T = any>(table: string, data: T | T[]): Promise<void> {
    const dataArray = Array.isArray(data) ? data : [data];
    
    const token = await this.getTokenForEndpoint(true);
    
    const response = await this.http.fetch(
      `${this.config.databaseUrl}/${this.endpoint}/${encodeURIComponent(table)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: this.stringifyData(dataArray),
      }
    );

    if (!response.ok) {
      throw new DexieCloudError(
        `Failed to save to ${table}: ${await response.text()}`,
        response.status
      );
    }
  }

  /**
   * Delete object by primary key
   */
  async delete(
    table: string,
    primaryKey: string | number | Array<string | number>
  ): Promise<void> {
    const encodedKey = this.encodePrimaryKey(primaryKey);
    const token = await this.getTokenForEndpoint(true);
    
    const response = await this.http.fetch(
      `${this.config.databaseUrl}/${this.endpoint}/${encodeURIComponent(table)}/${encodedKey}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      throw new DexieCloudError(
        `Failed to delete ${table}/${primaryKey}: ${await response.text()}`,
        response.status
      );
    }
  }

  /**
   * Get appropriate token for this endpoint
   */
  private async getTokenForEndpoint(write = false): Promise<string> {
    const scopes: Scope[] = ['ACCESS_DB'];
    
    if (this.endpoint === 'all') {
      scopes.push('GLOBAL_READ');
      if (write) {
        scopes.push('GLOBAL_WRITE');
      }
    } else if (this.endpoint === 'public' && write) {
      scopes.push('GLOBAL_READ', 'GLOBAL_WRITE');
    }
    
    return this.tokenManager.getAccessToken(scopes);
  }

  /**
   * Build URL with filters and options
   */
  private buildUrl(table: string, options: {
    filters?: DataFilter;
    realmId?: string;
  }): string {
    const baseUrl = `${this.config.databaseUrl}/${this.endpoint}/${encodeURIComponent(table)}`;
    const params = new URLSearchParams();

    if (options.realmId) {
      params.append('realmId', options.realmId);
    }

    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        params.append(key, String(value));
      }
    }

    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }

  /**
   * Encode primary key for URL (handles compound keys)
   */
  private encodePrimaryKey(primaryKey: string | number | Array<string | number>): string {
    if (Array.isArray(primaryKey)) {
      // Compound key - encode as JSON
      return encodeURIComponent(JSON.stringify(primaryKey));
    }
    
    return encodeURIComponent(String(primaryKey));
  }

  /**
   * Parse response with TSON support
   */
  private async parseResponse(response: Response): Promise<any> {
    const text = await response.text();
    
    try {
      // Try to use TSON if available (from dreambase-library)
      if (typeof globalThis !== 'undefined' && (globalThis as any).TSON) {
        const TSON = (globalThis as any).TSON;
        return TSON.parse(text);
      }
      
      // Fallback to regular JSON
      return JSON.parse(text);
    } catch (error) {
      throw new DexieCloudError(`Failed to parse response: ${error}`);
    }
  }

  /**
   * Stringify data with TSON support
   */
  private stringifyData(data: any): string {
    try {
      // Try to use TSON if available
      if (typeof globalThis !== 'undefined' && (globalThis as any).TSON) {
        const TSON = (globalThis as any).TSON;
        return TSON.stringify(data);
      }
      
      // Fallback to regular JSON
      return JSON.stringify(data);
    } catch (error) {
      throw new DexieCloudError(`Failed to stringify data: ${error}`);
    }
  }
}