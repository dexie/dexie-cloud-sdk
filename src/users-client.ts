/**
 * Users Management Client
 * Provides access to /users endpoint for user management
 */
import type { 
  DexieCloudConfig,
  DBUser,
  UsersListResponse,
  UsersListQuery
} from './rest-types.js';
import { DexieCloudError } from './rest-types.js';
import type { HttpAdapter } from './adapters.js';
import { TokenManager } from './token-manager.js';

export class UsersClient {
  constructor(
    private config: DexieCloudConfig,
    private http: HttpAdapter,
    private tokenManager: TokenManager
  ) {}

  /**
   * List users with optional filtering and pagination
   */
  async list(query: UsersListQuery = {}): Promise<UsersListResponse> {
    const url = this.buildUsersUrl(query);
    const token = await this.tokenManager.getAccessToken(['ACCESS_DB', 'GLOBAL_READ']);

    const response = await this.http.fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new DexieCloudError(
        `Failed to list users: ${await response.text()}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get a single user by userId
   */
  async get(userId: string): Promise<DBUser | null> {
    const token = await this.tokenManager.getAccessToken(['ACCESS_DB', 'GLOBAL_READ']);

    const response = await this.http.fetch(
      `${this.config.databaseUrl}/users/${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new DexieCloudError(
        `Failed to get user ${userId}: ${await response.text()}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Create new users
   */
  async create(users: Partial<DBUser> | Array<Partial<DBUser>>): Promise<void> {
    const userArray = Array.isArray(users) ? users : [users];
    
    // Validate required fields
    for (const user of userArray) {
      if (!user.userId || !user.type) {
        throw new DexieCloudError('userId and type are required for creating users');
      }
    }

    const token = await this.tokenManager.getAccessToken(['ACCESS_DB', 'GLOBAL_WRITE']);

    const response = await this.http.fetch(`${this.config.databaseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(userArray),
    });

    if (!response.ok) {
      throw new DexieCloudError(
        `Failed to create users: ${await response.text()}`,
        response.status
      );
    }
  }

  /**
   * Update existing users
   */
  async update(updates: Partial<DBUser> | Array<Partial<DBUser>>): Promise<void> {
    const updateArray = Array.isArray(updates) ? updates : [updates];
    
    // Validate userId is present
    for (const update of updateArray) {
      if (!update.userId) {
        throw new DexieCloudError('userId is required for updating users');
      }
    }

    const token = await this.tokenManager.getAccessToken(['ACCESS_DB', 'GLOBAL_WRITE']);

    const response = await this.http.fetch(`${this.config.databaseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updateArray),
    });

    if (!response.ok) {
      throw new DexieCloudError(
        `Failed to update users: ${await response.text()}`,
        response.status
      );
    }
  }

  /**
   * Delete a user (DESTRUCTIVE - deletes all user data)
   */
  async delete(userId: string): Promise<void> {
    const token = await this.tokenManager.getAccessToken(['ACCESS_DB', 'GLOBAL_WRITE']);

    const response = await this.http.fetch(
      `${this.config.databaseUrl}/users/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      throw new DexieCloudError(
        `Failed to delete user ${userId}: ${await response.text()}`,
        response.status
      );
    }
  }

  /**
   * Deactivate a user (soft delete)
   */
  async deactivate(userId: string): Promise<void> {
    await this.update({
      userId,
      deactivated: new Date().toISOString(),
    });
  }

  /**
   * Reactivate a deactivated user
   */
  async reactivate(userId: string): Promise<void> {
    await this.update({
      userId,
      deactivated: undefined,
    });
  }

  /**
   * Convert eval user to production user
   */
  async upgradeToProd(userId: string, validUntil?: Date): Promise<void> {
    const updateData: Partial<DBUser> = {
      userId,
      type: 'prod',
    };

    if (validUntil) {
      updateData.validUntil = validUntil.toISOString();
    }

    await this.update(updateData);
  }

  /**
   * Extend evaluation period for eval user
   */
  async extendEval(userId: string, additionalDays: number): Promise<void> {
    // Get current user to calculate new evalDaysLeft
    const user = await this.get(userId);
    if (!user) {
      throw new DexieCloudError(`User ${userId} not found`);
    }

    const newEvalDaysLeft = (user.evalDaysLeft || 0) + additionalDays;

    await this.update({
      userId,
      evalDaysLeft: Math.min(newEvalDaysLeft, user.maxAllowedEvalDaysLeft),
    });
  }

  /**
   * Build URL for users list with query parameters
   */
  private buildUsersUrl(query: UsersListQuery): string {
    const baseUrl = `${this.config.databaseUrl}/users`;
    const params = new URLSearchParams();

    if (query.search) params.append('search', query.search);
    if (typeof query.active === 'boolean') params.append('active', query.active.toString());
    if (query.type) params.append('type', query.type);
    if (query.sort) params.append('sort', query.sort);
    if (query.desc) params.append('desc', query.desc.toString());
    if (query.limit) params.append('limit', query.limit.toString());
    if (query.pagingKey) params.append('pagingKey', query.pagingKey);

    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }
}