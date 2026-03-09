/**
 * Blob Manager for Dexie Cloud
 *
 * Handles upload/download of binary blobs and automatic processing
 * of objects containing inline or referenced blob data.
 */

import type { HttpAdapter } from './adapters.js';
import type { BlobHandling, BlobRef } from './types.js';
import { DexieCloudError } from './types.js';

/**
 * Minimum byte size for offloading a binary to blob storage.
 * Binaries smaller than this threshold are kept inline (as base64).
 * Must match the server-side threshold.
 */
export const BLOB_THRESHOLD = 4096;

/**
 * Maximum number of concurrent blob downloads in _walkForRead.
 * Mirrors the client-side MAX_CONCURRENT pattern.
 */
const MAX_CONCURRENT_DOWNLOADS = 6;

/** Generate a unique blob ID */
function generateBlobId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  // Fallback: use getRandomValues for strong entropy
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Last resort (non-browser, non-Node env): still better than Math.random alone
  const ts = Date.now().toString(16);
  const rand = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return ts + rand;
}

/**
 * Convert Blob/ArrayBuffer/TypedArray/DataView to Uint8Array.
 * Accepts any ArrayBufferView (TypedArrays + DataView) as well as
 * Uint8Array, ArrayBuffer, and Blob.
 */
async function toUint8Array(
  data: Uint8Array | Blob | ArrayBuffer | ArrayBufferView
): Promise<Uint8Array> {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    const buf = await data.arrayBuffer();
    return new Uint8Array(buf);
  }
  // Handles all TypedArrays (Int8Array, Float32Array, etc.) and DataView
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
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
    data: Uint8Array | Blob | ArrayBuffer | ArrayBufferView,
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
        // ignore parse errors, fall through
      }
      // If server returned "version:blobId" directly
      if (text.includes(':')) return text.trim();
    }

    // Server response was unparseable — we cannot safely construct a ref
    // because we don't know the server-assigned version.
    throw new DexieCloudError(
      `Blob upload succeeded (HTTP ${response.status}) but server returned no parseable ref. ` +
        `Cannot construct a safe blob reference without the server-assigned version.`,
      response.status,
      text
    );
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
   * Process an object before uploading: find inline blobs large enough to
   * offload (≥ BLOB_THRESHOLD bytes), upload them, replace with BlobRefs.
   * Small binaries are left inline. Only active in 'auto' mode.
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
      const bytes = base64ToUint8Array(val.v);
      // Only offload to blob storage if the binary meets the size threshold.
      // Small binaries are cheaper to keep inline than to round-trip through
      // the blob endpoint.
      if (bytes.length < BLOB_THRESHOLD) {
        return val; // keep as-is
      }
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
      return Promise.all(val.map((item) => this._walkForUpload(item, token)));
    }

    if (val !== null && typeof val === 'object') {
      const entries = await Promise.all(
        Object.entries(val).map(async ([k, v]) => [k, await this._walkForUpload(v, token)] as const)
      );
      return Object.fromEntries(entries);
    }

    return val;
  }

  private async _walkForRead(val: any, token: string): Promise<any> {
    if (isBlobRef(val)) {
      const { data, contentType } = await this.download(val.ref, token);
      return {
        _bt: val._bt,
        v: uint8ArrayToBase64(data),
        ...(val._bt === 'Blob' ? { ct: val.ct ?? contentType } : {}),
      };
    }

    if (Array.isArray(val)) {
      // Download up to MAX_CONCURRENT_DOWNLOADS blobs in parallel
      return this._parallelMap(val, (item) => this._walkForRead(item, token));
    }

    if (val !== null && typeof val === 'object') {
      const keys = Object.keys(val);
      const resolvedValues = await this._parallelMap(
        keys,
        (k) => this._walkForRead(val[k], token)
      );
      const result: Record<string, any> = {};
      for (let i = 0; i < keys.length; i++) {
        result[keys[i]!] = resolvedValues[i];
      }
      return result;
    }

    return val;
  }

  /**
   * Like Promise.all but with a concurrency cap.
   */
  private async _parallelMap<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let index = 0;

    async function worker() {
      while (index < items.length) {
        const i = index++;
        results[i] = await fn(items[i]!);
      }
    }

    const workers = Array.from(
      { length: Math.min(MAX_CONCURRENT_DOWNLOADS, items.length) },
      () => worker()
    );
    await Promise.all(workers);
    return results;
  }
}
