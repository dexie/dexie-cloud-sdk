/**
 * Token Manager for Client Credentials Flow
 * Handles automatic token refresh and caching
 */
import type { 
  DexieCloudConfig,
  TokenResponse,
  ClientCredentialsRequest,
  Scope,
  TokenValidation
} from './rest-types.js';
import { DexieCloudAuthError } from './rest-types.js';
import type { HttpAdapter } from './adapters.js';

export class TokenManager {
  private cachedToken?: TokenResponse;
  private refreshPromise?: Promise<TokenResponse>;

  constructor(
    private config: DexieCloudConfig,
    private http: HttpAdapter
  ) {}

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getAccessToken(scopes: Scope[] = ['ACCESS_DB']): Promise<string> {
    // Return cached token if still valid
    if (this.cachedToken && this.isTokenValid(this.cachedToken)) {
      return this.cachedToken.accessToken;
    }

    // If already refreshing, wait for that
    if (this.refreshPromise) {
      const token = await this.refreshPromise;
      return token.accessToken;
    }

    // Start refresh process
    this.refreshPromise = this.requestToken(scopes);
    
    try {
      const token = await this.refreshPromise;
      this.cachedToken = token;
      return token.accessToken;
    } finally {
      this.refreshPromise = undefined;
    }
  }

  /**
   * Get a token for acting on behalf of a user
   */
  async getTokenForUser(
    userId: string,
    email: string,
    name: string,
    scopes: Scope[] = ['ACCESS_DB']
  ): Promise<string> {
    const token = await this.requestToken(scopes, {
      sub: userId,
      email,
      name,
    });
    
    return token.accessToken;
  }

  /**
   * Get a token with global database access
   */
  async getGlobalToken(): Promise<string> {
    return this.getAccessToken(['ACCESS_DB', 'GLOBAL_READ', 'GLOBAL_WRITE']);
  }

  /**
   * Validate an existing token
   */
  async validateToken(token: string): Promise<TokenValidation> {
    const response = await this.http.fetch(`${this.config.databaseUrl}/token/validate`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new DexieCloudAuthError(
        `Token validation failed: ${response.status}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Clear cached token (force refresh on next request)
   */
  clearCache(): void {
    this.cachedToken = undefined;
    this.refreshPromise = undefined;
  }

  /**
   * Request new token using client credentials
   */
  private async requestToken(
    scopes: Scope[],
    claims?: { sub: string; email: string; name: string }
  ): Promise<TokenResponse> {
    const requestData: ClientCredentialsRequest = {
      grant_type: 'client_credentials',
      scopes,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      ...(claims && { claims }),
    };

    if (this.config.debug) {
      console.log('[DexieCloud] Requesting token with scopes:', scopes);
      if (claims) {
        console.log('[DexieCloud] Acting on behalf of user:', claims.sub);
      }
    }

    const response = await this.http.fetch(`${this.config.databaseUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new DexieCloudAuthError(
        `Token request failed: ${error}`,
        response.status
      );
    }

    const tokenData = await response.json() as TokenResponse;

    if (tokenData.type !== 'tokens' || !tokenData.accessToken) {
      throw new DexieCloudAuthError(
        `Invalid token response: ${JSON.stringify(tokenData)}`
      );
    }

    if (this.config.debug) {
      console.log('[DexieCloud] Token obtained, expires at:', 
        new Date(tokenData.accessTokenExpiration * 1000).toISOString()
      );
    }

    return tokenData;
  }

  /**
   * Check if token is still valid (with 5 minute buffer)
   */
  private isTokenValid(token: TokenResponse): boolean {
    const now = Math.floor(Date.now() / 1000);
    const buffer = 5 * 60; // 5 minutes
    
    return token.accessTokenExpiration > (now + buffer);
  }
}