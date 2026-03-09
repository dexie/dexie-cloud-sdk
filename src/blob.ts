/**
 * Blob Manager for Dexie Cloud
 *
 * Handles upload/download of binary blobs and automatic processing
 * of objects containing inline or referenced blob data.
 */

import type { HttpAdapter } from './adapters.js';
import type { BlobHandling, BlobRef } from './types.js';
import { DexieCloudError } from './types.js';

/** Generate a unique blob ID */
function generateBlobId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  // Fallback: timestamp + random hex
  return Date.now().toString(16) + Math.random().toString(16).slice(2);
}

/** Convert Blob/ArrayBuffer/TypedArray to Uint8Array */
async function toUint8Array(data: Uint8Array | Blob | ArrayBuffer): Promise<Uint8Array> {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    const buf = await data.arrayBuffer();
    return new Uint8Array(buf);
  }
  // TypedArray (e.g. Int8Array, etc.)
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array((data as ArrayBufferView).buffer);
  }
  throw new TypeError('Unsupported data type for blob upload');
}

/** Detect inline blob: has _bt + v props */
function isInlineBlob(val: any): val is { _bt: string; v: string; ct?: string } {
  return (
    val !== null &&
    typeof val === 'object' &&
    typeof val._bt === 'string' &&
    typeof val.v === 'string'
  );
}

/** Detect BlobRef: has _bt + ref props, no v */
function isBlobRef(val: any): val is BlobRef {
  return (
    val !== null &&
    typeof val === 'object' &&
    typeof val._bt === 'string' &&
    typeof val.ref === 'string' &&
    val.v === undefined
  );
}

/** Decode base64 string to Uint8Array */
function base64ToUint8Array(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    // Node.js
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Encode Uint8Array to base64 string */
function uint8ArrayToBase64(data: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]!);
  }
  return btoa(binary);
}

export class BlobManager {
  constructor(
    private dbUrl: string,
    private http: HttpAdapter,
    private mode: BlobHandling = 'auto'
  ) {}

  /**
   * Upload binary data to the blob store.
   * Returns the blob ref (e.g. "1:abc123...").
   */
  async upload(
    data: Uint8Array | Blob | ArrayBuffer,
    token: string,
    contentType = 'application/octet-stream'
  ): Promise<string> {
    const blobId = generateBlobId();
    const url = `${this.dbUrl}/blob/${blobId}`;
    const bytes = await toUint8Array(data);

    const response = await this.http.fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
      },
      body: bytes as unknown as BodyInit,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new DexieCloudError(
        `Blob upload failed HTTP ${response.status}: ${text || response.statusText}`,
        response.status,
        text
      );
    }

    // Parse the version from the response body (server returns the final ref)
    const text = await response.text().catch(() => '');
    if (text && text.trim()) {
      try {
        const parsed = JSON.parse(text);
        if (parsed?.ref) return parsed.ref as string;
      } catch {
        // ignore parse errors, construct ref ourselves
      }
      // If server returned "version:blobId" directly
      if (text.includes(':')) return text.trim();
    }

    // Fallback: assume version 1
    return `1:${blobId}`;
  }

  /**
   * Download a blob by ref (format: "version:blobId").
   */
  async download(ref: string, token: string): Promise<{ data: Uint8Array; contentType: string }> {
    const url = `${this.dbUrl}/blob/${encodeURIComponent(ref)}`;
    const response = await this.http.fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new DexieCloudError(
        `Blob download failed HTTP ${response.status}: ${text || response.statusText}`,
        response.status,
        text
      );
    }

    const contentType = response.headers?.get('content-type') ?? 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();
    return { data: new Uint8Array(arrayBuffer), contentType };
  }

  /**
   * Process an object before uploading: find inline blobs, upload them,
   * replace with BlobRefs. Only active in 'auto' mode.
   */
  async processForUpload(obj: any, token: string): Promise<any> {
    if (this.mode !== 'auto') return obj;
    return this._walkForUpload(obj, token);
  }

  /**
   * Process an object after reading: find BlobRefs, download them,
   * replace with inline data. Only active in 'auto' mode.
   */
  async processForRead(obj: any, token: string): Promise<any> {
    if (this.mode !== 'auto') return obj;
    return this._walkForRead(obj, token);
  }

  private async _walkForUpload(val: any, token: string): Promise<any> {
    if (isInlineBlob(val)) {
      // Upload inline blob, replace with BlobRef
      const bytes = base64ToUint8Array(val.v);
      const contentType = val.ct ?? 'application/octet-stream';
      const ref = await this.upload(bytes, token, contentType);
      const blobRef: BlobRef = {
        _bt: val._bt,
        ref,
        size: bytes.length,
        ...(val._bt === 'Blob' && val.ct ? { ct: val.ct } : {}),
      };
      return blobRef;
    }

    if (Array.isArray(val)) {
      const results: any[] = [];
      for (const item of val) {
        results.push(await this._walkForUpload(item, token));
      }
      return results;
    }

    if (val !== null && typeof val === 'object') {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        result[k] = await this._walkForUpload(v, token);
      }
      return result;
    }

    return val;
  }

  private async _walkForRead(val: any, token: string): Promise<any> {
    if (isBlobRef(val)) {
      // Download and replace with inline
      const { data, contentType } = await this.download(val.ref, token);
      return {
        _bt: val._bt,
        v: uint8ArrayToBase64(data),
        ...(val._bt === 'Blob' ? { ct: val.ct ?? contentType } : {}),
      };
    }

    if (Array.isArray(val)) {
      const results: any[] = [];
      for (const item of val) {
        results.push(await this._walkForRead(item, token));
      }
      return results;
    }

    if (val !== null && typeof val === 'object') {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        result[k] = await this._walkForRead(v, token);
      }
      return result;
    }

    return val;
  }
}
