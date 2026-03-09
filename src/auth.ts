/**
 * Authentication module - OTP flows and token management
 */
import type { 
  OTPRequest, 
  OTPVerification, 
  TokenResponse, 
  AuthTokens,
  DatabaseTokens,
  DexieCloudConfig 
} from './types.js';
import { DexieCloudError, DexieCloudAuthError } from './types.js';
import type { HttpAdapter } from './adapters.js';
import { parseResponse, stringifyBody } from './http-utils.js';

export class AuthManager {
  constructor(
    private config: DexieCloudConfig,
    private http: HttpAdapter
  ) {}

  private get serviceUrl(): string {
    return `${this.config.serviceUrl}/service`;
  }

  /**
   * Step 1: Request OTP to be sent to email
   * Returns otp_id needed for verification
   */
  async requestOTP(email: string, scopes: string[] = ['CREATE_DB']): Promise<string> {
    const response = await this.http.fetch(`${this.serviceUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: stringifyBody({
        grant_type: 'otp',
        email,
        scopes,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new DexieCloudAuthError(
        `Failed to request OTP: ${error}`,
        response.status
      );
    }

    const data = await parseResponse<TokenResponse>(response);
    if (data.type !== 'otp-sent' || !data.otp_id) {
      throw new DexieCloudAuthError(`Unexpected response: ${JSON.stringify(data)}`);
    }

    return data.otp_id;
  }

  /**
   * Step 2: Verify OTP and get access tokens
   */
  async verifyOTP(
    email: string,
    otpId: string,
    otp: string,
    scopes: string[] = ['CREATE_DB']
  ): Promise<AuthTokens> {
    const response = await this.http.fetch(`${this.serviceUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: stringifyBody({
        grant_type: 'otp',
        email,
        scopes,
        otp_id: otpId,
        otp,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new DexieCloudAuthError(
        `Failed to verify OTP: ${error}`,
        response.status
      );
    }

    const data = await parseResponse<TokenResponse>(response);
    if (data.type !== 'tokens' || !data.accessToken) {
      throw new DexieCloudAuthError(`Unexpected response: ${JSON.stringify(data)}`);
    }

    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      userId: data.userId,
    };
  }

  /**
   * Full OTP flow: request → verify → return tokens
   * The getOTP callback should return the OTP code (e.g., from email)
   */
  async authenticateWithOTP(
    email: string,
    getOTP: () => Promise<string>,
    scopes: string[] = ['CREATE_DB']
  ): Promise<AuthTokens> {
    const otpId = await this.requestOTP(email, scopes);
    const otp = await getOTP();
    return this.verifyOTP(email, otpId, otp, scopes);
  }

  /**
   * Request OTP for database-specific operations
   */
  async requestDatabaseOTP(dbUrl: string, email: string): Promise<void> {
    const response = await this.http.fetch(`${dbUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: stringifyBody({
        grant_type: 'otp-email',
        email,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new DexieCloudAuthError(
        `Failed to request database OTP: ${error}`,
        response.status
      );
    }
  }

  /**
   * Verify OTP for database-specific access
   */
  async verifyDatabaseOTP(
    dbUrl: string,
    email: string,
    otp: string
  ): Promise<DatabaseTokens> {
    const response = await this.http.fetch(`${dbUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: stringifyBody({
        grant_type: 'otp-token',
        email,
        otp,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new DexieCloudAuthError(
        `Failed to verify database OTP: ${error}`,
        response.status
      );
    }

    return parseResponse<DatabaseTokens>(response);
  }

  /**
   * Full database authentication flow
   */
  async authenticateDatabase(
    dbUrl: string,
    email: string,
    getOTP: () => Promise<string>
  ): Promise<DatabaseTokens> {
    await this.requestDatabaseOTP(dbUrl, email);
    const otp = await getOTP();
    return this.verifyDatabaseOTP(dbUrl, email, otp);
  }
}
