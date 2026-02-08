/**
 * Types for Dexie Cloud REST API Client
 * Based on: https://dexie.org/docs/cloud/rest-api
 */

export interface DexieCloudConfig {
  /** Database URL (e.g., 'https://abc123.dexie.cloud') */
  databaseUrl: string;
  
  /** Client ID for authentication */
  clientId: string;
  
  /** Client Secret for authentication */
  clientSecret: string;
  
  /** Optional custom fetch implementation */
  fetch?: typeof globalThis.fetch;
  
  /** Default timeout for requests in milliseconds */
  timeout?: number;
  
  /** Enable debug logging */
  debug?: boolean;
  
  /** Auto-refresh tokens before expiration */
  autoRefresh?: boolean;
}

/**
 * Client credentials token response
 */
export interface TokenResponse {
  type: 'tokens';
  claims: {
    sub: string;
    license?: 'ok' | 'expired' | 'deactivated';
    [claimName: string]: any;
  };
  accessToken: string;
  accessTokenExpiration: number;
  refreshToken?: string;
  refreshTokenExpiration?: number | null;
  userType: 'demo' | 'eval' | 'prod' | 'client';
  evalDaysLeft?: number;
  userValidUntil?: number;
  alerts?: {
    type: 'warning' | 'info';
    messageCode: string;
    message: string;
    messageParams?: { [param: string]: string };
  }[];
}

/**
 * Client credentials request
 */
export interface ClientCredentialsRequest {
  grant_type: 'client_credentials';
  scopes: Scope[];
  client_id: string;
  client_secret: string;
  public_key?: string;
  claims?: {
    sub: string;
    email: string;
    name: string;
  };
}

/**
 * Available scopes
 */
export type Scope = 
  | 'ACCESS_DB'
  | 'IMPERSONATE' 
  | 'MANAGE_DB'
  | 'GLOBAL_READ'
  | 'GLOBAL_WRITE' 
  | 'DELETE_DB';

/**
 * Token validation response
 */
export interface TokenValidation {
  valid: boolean;
  claims?: Record<string, any>;
}

/**
 * Authentication provider info
 */
export interface AuthProvider {
  type: 'google' | 'github' | 'microsoft' | 'apple' | 'custom-oauth2';
  name: string;
  displayName: string;
  iconUrl: string;
  scopes: string[];
}

export interface AuthProvidersResponse {
  providers: AuthProvider[];
  otpEnabled: boolean;
}

/**
 * User management types
 */
export interface DBUser {
  readonly userId: string;
  readonly created: string; // ISO date string
  readonly updated: string; // ISO date string  
  readonly lastLogin?: string | null; // ISO date string
  type: 'eval' | 'prod' | 'demo';
  validUntil?: string; // ISO date string
  evalDaysLeft?: number;
  readonly maxAllowedEvalDaysLeft: number;
  deactivated?: string; // ISO date string
  data: {
    displayName?: string;
    email?: string;
    [key: string]: any;
  } | null;
}

export interface UsersListResponse {
  data: DBUser[];
  hasMore: boolean;
  pagingKey?: string;
}

export interface UsersListQuery {
  search?: string;
  active?: boolean;
  type?: 'eval' | 'prod' | 'demo';
  sort?: 'created' | 'validUntil' | 'updated' | 'evalDaysLeft' | 'lastLogin' | 'userId' | 'type' | 'displayName';
  desc?: boolean;
  limit?: number;
  pagingKey?: string;
}

/**
 * Data query filters for REST endpoints
 */
export interface DataFilter {
  [property: string]: string | number | boolean;
}

/**
 * REST API endpoints configuration
 */
export interface RestEndpointConfig {
  /** Table name */
  table: string;
  
  /** Realm ID for /all endpoints */
  realmId?: string;
  
  /** Property filters */
  filters?: DataFilter;
  
  /** Primary key for single object operations */
  primaryKey?: string | number | Array<string | number>;
}

/**
 * TSON (Typeson) special types
 * Used by dreambase-library for Date, Blob, etc. serialization
 */
export interface TSONType {
  $t: string;
  v?: any;
  $ref?: string;
  $size?: number;
  $ct?: string; // content type for Blobs
}

/**
 * Errors
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

/**
 * Legacy OTP types (kept for backward compatibility)
 */
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