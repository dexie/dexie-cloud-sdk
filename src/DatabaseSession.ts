/**
 * DatabaseSession — transparent token management for Dexie Cloud SDK.
 *
 * Provides automatic token acquisition, caching, and renewal so callers
 * never need to pass an accessToken manually.
 */

import type { HttpAdapter } from './adapters.js';
import type { AuthTokens } from './types.js';
import { DexieCloudAuthError } from './types.js';
import { DataManager } from './data.js';
import { BlobManager } from './blob.js';
import { stringifyBody } from './http-utils.js';
import { parseResponse } from './http-utils.js';

// ── Public types ────────────────────────────────────────────────────

export interface ImpersonateClaims {
  sub?: string;
  email?: string;
  [key: string]: any;
}

export interface DatabaseCredentials {
  clientId: string;
  clientSecret: string;
  impersonate?: ImpersonateClaims;
}

// ── Stable JSON stringify (deterministic key order) ─────────────────

function stableStringify(obj: Record<string, any>): string {
  const sorted = Object.keys(obj)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = obj[key];
        return acc;
      },
      {} as Record<string, any>,
    );
  return JSON.stringify(sorted);
}

// ── Token cache (global singleton per process) ──────────────────────

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/** Seconds remaining before we consider a token stale and refresh it. */
const REFRESH_MARGIN = 300; // 5 minutes

function cacheKey(
  clientId: string,
  dbUrl: string,
  claims?: ImpersonateClaims,
): string {
  return `${clientId}::${dbUrl}::${stableStringify(claims ?? {})}`;
}

function parseJwtExp(token: string): number {
  const payload = JSON.parse(
    Buffer.from(token.split('.')[1]!, 'base64url').toString(),
  );
  return payload.exp as number;
}

// ── Proxy helpers ───────────────────────────────────────────────────

/**
 * Creates a proxy around DataManager that automatically injects the
 * access token as the last argument of every method call.
 */
function createDataProxy(
  data: DataManager,
  getToken: () => Promise<string>,
): DataSessionProxy {
  return new Proxy(data, {
    get(target: any, prop: string) {
      const original = target[prop];
      if (typeof original !== 'function') return original;

      // Return a wrapper that appends the token
      return async (...args: any[]) => {
        const token = await getToken();
        return original.apply(target, [...args, token]);
      };
    },
  }) as unknown as DataSessionProxy;
}

/**
 * Creates a proxy around BlobManager that automatically injects the
 * access token as the last argument of every method call.
 */
function createBlobProxy(
  blobs: BlobManager,
  getToken: () => Promise<string>,
): BlobSessionProxy {
  return new Proxy(blobs, {
    get(target: any, prop: string) {
      const original = target[prop];
      if (typeof original !== 'function') return original;

      return async (...args: any[]) => {
        const token = await getToken();
        return original.apply(target, [...args, token]);
      };
    },
  }) as unknown as BlobSessionProxy;
}

// ── Session proxy types ─────────────────────────────────────────────

/** DataManager methods without the trailing `token` parameter. */
export interface DataSessionProxy {
  list(table: string, options?: { realm?: string }): Promise<any[]>;
  get(table: string, id: string): Promise<any>;
  create(table: string, obj: any): Promise<any>;
  replace(table: string, id: string, obj: any): Promise<any>;
  update(table: string, id: string, obj: any): Promise<any>;
  delete(table: string, id: string): Promise<void>;
  bulkCreate(table: string, objects: any[]): Promise<any[]>;
}

/** BlobManager methods without the trailing `token` parameter. */
export interface BlobSessionProxy {
  upload(
    data: Uint8Array | Blob | ArrayBuffer | ArrayBufferView,
    contentType?: string,
  ): Promise<string>;
  download(ref: string): Promise<{ data: Uint8Array; contentType: string }>;
  processForUpload(obj: any): Promise<any>;
  processForRead(obj: any): Promise<any>;
}

// ── DatabaseSession ─────────────────────────────────────────────────

/**
 * A pre-authenticated session against a single Dexie Cloud database.
 *
 * Tokens are acquired lazily on first use and cached in-memory.
 * When a cached token is within 5 minutes of expiry a fresh one is
 * fetched transparently.
 */
export class DatabaseSession {
  readonly data: DataSessionProxy;
  readonly blobs: BlobSessionProxy;

  private inflightToken: Promise<string> | null = null;

  constructor(
    private dbUrl: string,
    private credentials: DatabaseCredentials,
    private http: HttpAdapter,
    blobManager: BlobManager,
    dataManager: DataManager,
  ) {
    const getToken = () => this.getToken();
    this.data = createDataProxy(dataManager, getToken);
    this.blobs = createBlobProxy(blobManager, getToken);
  }

  /**
   * Create a new session that impersonates a specific user.
   *
   * The returned session shares the same HTTP adapter and managers but
   * uses a separate cache entry for tokens.
   */
  asUser(claims: ImpersonateClaims): DatabaseSession {
    return new DatabaseSession(
      this.dbUrl,
      { ...this.credentials, impersonate: claims },
      this.http,
      // Re-create managers so each session points to the same dbUrl
      new BlobManager(this.dbUrl, this.http),
      new DataManager(
        this.dbUrl,
        this.http,
        new BlobManager(this.dbUrl, this.http),
      ),
    );
  }

  // ── Token management ────────────────────────────────────────────

  private async getToken(): Promise<string> {
    const key = cacheKey(
      this.credentials.clientId,
      this.dbUrl,
      this.credentials.impersonate,
    );

    const cached = tokenCache.get(key);
    const now = Math.floor(Date.now() / 1000);

    if (cached && cached.expiresAt - now > REFRESH_MARGIN) {
      return cached.token;
    }

    // Deduplicate concurrent requests for the same cache key
    if (!this.inflightToken) {
      this.inflightToken = this.fetchToken(key).finally(() => {
        this.inflightToken = null;
      });
    }

    return this.inflightToken;
  }

  private async fetchToken(key: string): Promise<string> {
    const { clientId, clientSecret, impersonate } = this.credentials;
    const isImpersonation = !!impersonate;

    const body: Record<string, any> = {
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scopes: isImpersonation
        ? ['ACCESS_DB', 'IMPERSONATE']
        : ['ACCESS_DB'],
    };

    if (isImpersonation) {
      body.claims = impersonate;
    }

    const response = await this.http.fetch(`${this.dbUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: stringifyBody(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new DexieCloudAuthError(
        `Failed to authenticate with client credentials: ${error}`,
        response.status,
      );
    }

    const data = await parseResponse<any>(response);
    if (data.type !== 'tokens' || !data.accessToken) {
      throw new DexieCloudAuthError(
        `Unexpected token response: ${JSON.stringify(data)}`,
      );
    }

    const token: string = data.accessToken;
    const expiresAt = parseJwtExp(token);

    tokenCache.set(key, { token, expiresAt });

    return token;
  }
}
