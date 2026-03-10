/**
 * REST Data Manager for Dexie Cloud
 *
 * Provides CRUD operations against the Dexie Cloud REST API with
 * automatic TSON serialization/deserialization.
 *
 * Blob integration: if a BlobManager is provided, create() will
 * automatically call processForUpload before sending, and get()/list()
 * will call processForRead on the response.
 */

import type { HttpAdapter } from './adapters.js';
import type { BlobManager } from './blob.js';
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
  constructor(
    private dbUrl: string,
    private http: HttpAdapter,
    private blobManager?: BlobManager
  ) {}

  /**
   * List all objects in a table, optionally filtered by realm.
   * BlobRefs in results are automatically resolved to inline data
   * when a BlobManager is present.
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
    const items: any[] = Array.isArray(result) ? result : result?.data ?? result ?? [];
    if (this.blobManager) {
      // Process items sequentially to avoid unbounded parallel downloads.
      // Each item already uses internal parallelism (MAX_CONCURRENT=6) for its blobs.
      const resolved: any[] = [];
      for (const item of items) {
        resolved.push(await this.blobManager.processForRead(item, token));
      }
      return resolved;
    }
    return items;
  }

  /**
   * Get a single object by id.
   * BlobRefs in the result are automatically resolved to inline data
   * when a BlobManager is present.
   */
  async get(table: string, id: string, token: string): Promise<any> {
    const url = `${this.dbUrl}/${encodeURIComponent(table)}/${encodeURIComponent(id)}`;
    const response = await this.http.fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await handleResponse<any>(response);
    if (this.blobManager) {
      return this.blobManager.processForRead(result, token);
    }
    return result;
  }

  /**
   * Create an object in a table.
   * Inline blobs in obj are automatically uploaded and replaced with
   * BlobRefs when a BlobManager is present.
   */
  async create(table: string, obj: any, token: string): Promise<any> {
    const url = `${this.dbUrl}/${encodeURIComponent(table)}`;
    const body = this.blobManager
      ? await this.blobManager.processForUpload(obj, token)
      : obj;
    const response = await this.http.fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: stringifyBody(body),
    });
    return handleResponse<any>(response);
  }

  /**
   * Replace (full update) an object by id using HTTP PUT.
   *
   * NOTE: This sends the complete object as a full replacement (PUT semantics).
   * All fields not included in `obj` will be removed on the server.
   * If you want partial updates, use a PATCH-based approach when the server
   * supports it (not currently exposed here).
   *
   * Previously named `update()` — `update` is kept as an alias for backwards
   * compatibility but may be deprecated in a future release.
   */
  async replace(table: string, id: string, obj: any, token: string): Promise<any> {
    const url = `${this.dbUrl}/${encodeURIComponent(table)}/${encodeURIComponent(id)}`;
    const body = this.blobManager
      ? await this.blobManager.processForUpload(obj, token)
      : obj;
    const response = await this.http.fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: stringifyBody(body),
    });
    return handleResponse<any>(response);
  }

  /**
   * @deprecated Use `replace()` instead. This method performs a full object
   * replacement (HTTP PUT), not a partial update (PATCH). The name `update`
   * is misleading and kept only for backwards compatibility.
   */
  update(table: string, id: string, obj: any, token: string): Promise<any> {
    return this.replace(table, id, obj, token);
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
   * Bulk create objects in a table in parallel.
   * All requests are sent concurrently via Promise.all.
   *
   * NOTE: This is NOT atomic — if one create fails, others may have already
   * succeeded on the server. There is no rollback for partial failures.
   */
  async bulkCreate(table: string, objects: any[], token: string): Promise<any[]> {
    return Promise.all(objects.map((obj) => this.create(table, obj, token)));
  }
}
