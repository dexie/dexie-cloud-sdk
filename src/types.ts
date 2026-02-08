/**
 * Core types for Dexie Cloud SDK
 */

export interface DexieCloudConfig {
  /** Base URL of the Dexie Cloud service (e.g., 'https://dexie.cloud') */
  serviceUrl: string;
  
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