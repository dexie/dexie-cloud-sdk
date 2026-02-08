/**
 * Unit tests for REST API Client
 */
import { describe, it, expect, vi } from 'vitest';
import { DexieCloudClient } from '../../src/rest-client.ts';
import { DexieCloudError } from '../../src/rest-types.ts';

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('DexieCloudClient (REST API)', () => {
  const config = {
    databaseUrl: 'https://abc123.dexie.cloud',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
  };

  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should initialize with valid config', () => {
    const client = new DexieCloudClient(config);
    
    expect(client.data).toBeDefined();
    expect(client.users).toBeDefined();
    expect(client.tokens).toBeDefined();
  });

  it('should throw error if required fields missing', () => {
    expect(() => new DexieCloudClient({} as any)).toThrow('databaseUrl is required');
    
    expect(() => new DexieCloudClient({
      databaseUrl: 'https://test.com'
    } as any)).toThrow('clientId is required');

    expect(() => new DexieCloudClient({
      databaseUrl: 'https://test.com',
      clientId: 'test'
    } as any)).toThrow('clientSecret is required');
  });

  it('should get auth providers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        providers: [
          {
            type: 'google',
            name: 'google',
            displayName: 'Google',
            iconUrl: 'https://test.com/icons/google.svg',
            scopes: ['openid', 'email', 'profile']
          }
        ],
        otpEnabled: true
      }),
    } as Response);

    const client = new DexieCloudClient(config);
    const providers = await client.getAuthProviders();

    expect(providers.providers).toHaveLength(1);
    expect(providers.providers[0].type).toBe('google');
    expect(providers.otpEnabled).toBe(true);
    
    expect(mockFetch).toHaveBeenCalledWith(
      'https://abc123.dexie.cloud/auth-providers',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'User-Agent': 'dexie-cloud-sdk'
        })
      })
    );
  });
});

describe('Data Client Endpoints', () => {
  let client: DexieCloudClient;

  beforeEach(() => {
    mockFetch.mockClear();
    client = new DexieCloudClient({
      databaseUrl: 'https://abc123.dexie.cloud',
      clientId: 'test-client',
      clientSecret: 'test-secret',
    });
  });

  it('should list data from /all endpoint', async () => {
    // Mock token request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        type: 'tokens',
        accessToken: 'test-global-token',
        accessTokenExpiration: Math.floor(Date.now() / 1000) + 3600,
        claims: { sub: 'client' },
        userType: 'client'
      }),
    } as Response);

    // Mock data request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify([
        { id: '1', title: 'Test Todo', completed: false },
        { id: '2', title: 'Another Todo', completed: true }
      ]),
    } as Response);

    const todos = await client.data.all.list('todoItems');

    expect(todos).toHaveLength(2);
    expect(todos[0].title).toBe('Test Todo');
    
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenLastCalledWith(
      'https://abc123.dexie.cloud/all/todoItems',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-global-token'
        })
      })
    );
  });

  it('should create data via /my endpoint', async () => {
    // Mock token request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        type: 'tokens',
        accessToken: 'test-user-token',
        accessTokenExpiration: Math.floor(Date.now() / 1000) + 3600,
        claims: { sub: 'user123' },
        userType: 'eval'
      }),
    } as Response);

    // Mock save request
    mockFetch.mockResolvedValueOnce({
      ok: true,
    } as Response);

    const newTodo = { title: 'New Todo', completed: false };
    await client.data.my.save('todoItems', newTodo);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenLastCalledWith(
      'https://abc123.dexie.cloud/my/todoItems',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-user-token'
        }),
        body: JSON.stringify([newTodo])
      })
    );
  });
});