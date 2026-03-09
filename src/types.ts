/**
 * Core types for Dexie Cloud SDK
 */

/**
 * Blob handling mode:
 * - 'auto': inline blobs are uploaded on write, BlobRefs are downloaded on read
 * - 'lazy': blobs are left as-is
 */
export type BlobHandling = 'auto' | 'lazy';

export interface DexieCloudConfig {
  /** Base URL of the Dexie Cloud service (e.g., 'https://dexie.cloud') */
  serviceUrl: string;

  /** Base URL of the Dexie Cloud database instance for data/blob operations */
  dbUrl?: string;

  /** Blob handling mode: 'auto' (default) or 'lazy' */
  blobHandling?: BlobHandling;
  
  /** Optional custom fetch implementation */
  fetch?: typeof globalThis.fetch;
  
  /** Default timeout for requests in milliseconds */
  timeout?: number;
  
  /** Enable debug logging */
  debug?: boolean;
}

export interface OTPRequest {
  email: string;
  scopes?: string[];
}

export interface OTPVerification {
  email: string;
  otpId: string;
  otp: string;
  scopes?: string[];
}

export interface TokenResponse {
  type: 'otp-sent' | 'tokens';
  otp_id?: string;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  claims?: Record<string, any>;
}

export interface DatabaseInfo {
  url: string;
  clientId: string;
  clientSecret: string;
}

export interface CreateDatabaseOptions {
  timeZone?: string;
  hackathon?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  userId?: string;
}

export interface DatabaseTokens {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

export interface HealthStatus {
  healthy: boolean;
  ready: boolean;
}

/**
 * A reference to a blob stored in Dexie Cloud blob storage.
 */
export interface BlobRef {
  /** Blob type tag (e.g. 'Blob', 'Uint8Array', 'ArrayBuffer') */
  _bt: string;
  /** Blob ref in "version:blobId" format */
  ref: string;
  /** Byte size of the blob */
  size: number;
  /** Content-Type (only present for Blob type) */
  ct?: string;
}

/**
 * Inline blob format used for import/export.
 */
export interface InlineBlob {
  /** Blob type tag */
  _bt: string;
  /** Base64-encoded blob data */
  v: string;
  /** Content-Type (only for Blob type) */
  ct?: string;
}

/**
 * Errors thrown by the SDK
 */
export class DexieCloudError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly response?: string
  ) {
    super(message);
    this.name = 'DexieCloudError';
  }
}

export class DexieCloudAuthError extends DexieCloudError {
  constructor(message: string, status?: number) {
    super(message, status);
    this.name = 'DexieCloudAuthError';
  }
}

export class DexieCloudNetworkError extends DexieCloudError {
  constructor(message: string) {
    super(message);
    this.name = 'DexieCloudNetworkError';
  }
}