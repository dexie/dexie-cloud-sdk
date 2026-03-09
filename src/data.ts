/**
 * REST Data Manager for Dexie Cloud
 *
 * Provides CRUD operations against the Dexie Cloud REST API with
 * automatic TSON serialization/deserialization.
 */

import type { HttpAdapter } from './adapters.js';
import { DexieCloudError } from './types.js';
import { parseResponse, stringifyBody } from './http-utils.js';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new DexieCloudError(
      `HTTP ${response.status}: ${text || response.statusText}`,
      response.status,
      text
    );
  }
  return parseResponse<T>(response);
}

export class DataManager {
  constructor(private dbUrl: string, private http: HttpAdapter) {}

  /**
   * List all objects in a table, optionally filtered by realm.
   */
  async list(table: string, token: string, options?: { realm?: string }): Promise<any[]> {
    let url = `${this.dbUrl}/${encodeURIComponent(table)}`;
    if (options?.realm) {
      url += `?realm=${encodeURIComponent(options.realm)}`;
    }
    const response = await this.http.fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await handleResponse<any>(response);
    // Server may return array directly or wrapped
    return Array.isArray(result) ? result : result?.data ?? result ?? [];
  }

  /**
   * Get a single object by id.
   */
  async get(table: string, id: string, token: string): Promise<any> {
    const url = `${this.dbUrl}/${encodeURIComponent(table)}/${encodeURIComponent(id)}`;
    const response = await this.http.fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<any>(response);
  }

  /**
   * Create an object in a table.
   */
  async create(table: string, obj: any, token: string): Promise<any> {
    const url = `${this.dbUrl}/${encodeURIComponent(table)}`;
    const response = await this.http.fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: stringifyBody(obj),
    });
    return handleResponse<any>(response);
  }

  /**
   * Update (replace) an object by id.
   */
  async update(table: string, id: string, obj: any, token: string): Promise<any> {
    const url = `${this.dbUrl}/${encodeURIComponent(table)}/${encodeURIComponent(id)}`;
    const response = await this.http.fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: stringifyBody(obj),
    });
    return handleResponse<any>(response);
  }

  /**
   * Delete an object by id.
   */
  async delete(table: string, id: string, token: string): Promise<void> {
    const url = `${this.dbUrl}/${encodeURIComponent(table)}/${encodeURIComponent(id)}`;
    const response = await this.http.fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new DexieCloudError(
        `HTTP ${response.status}: ${text || response.statusText}`,
        response.status,
        text
      );
    }
  }

  /**
   * Bulk create objects in a table (sequential).
   */
  async bulkCreate(table: string, objects: any[], token: string): Promise<any[]> {
    const results: any[] = [];
    for (const obj of objects) {
      results.push(await this.create(table, obj, token));
    }
    return results;
  }
}
