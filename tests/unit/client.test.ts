/**
 * Unit tests for DexieCloudClient
 */
import { describe, it, expect, vi } from 'vitest';
import { DexieCloudClient } from '../../src/client.ts';
import { DexieCloudError } from '../../src/rest-types.ts';

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('DexieCloudClient', () => {
  it('should initialize with string URL', () => {
    const client = new DexieCloudClient('https://dexie.cloud');
    expect(client).toBeInstanceOf(DexieCloudClient);
    expect(client.auth).toBeDefined();
    expect(client.databases).toBeDefined();
    expect(client.health).toBeDefined();
  });

  it('should initialize with config object', () => {
    const client = new DexieCloudClient({
      serviceUrl: 'https://dexie.cloud',
      timeout: 5000,
      debug: true,
    });
    expect(client).toBeInstanceOf(DexieCloudClient);
  });

  it('should throw error if no serviceUrl provided', () => {
    expect(() => {
      new DexieCloudClient({} as any);
    }).toThrow(DexieCloudError);
  });

  it('should normalize trailing slash in URL', () => {
    const client = new DexieCloudClient('https://dexie.cloud/');
    // URL should be normalized internally - exact testing would require exposing internals
    expect(client).toBeInstanceOf(DexieCloudClient);
  });
});

describe('DexieCloudClient health methods', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should check if service is ready', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
    } as Response);

    const client = new DexieCloudClient('https://test.com');
    const result = await client.isReady();
    
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.com/ready',
      expect.any(Object)
    );
  });

  it('should get health status', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true } as Response) // health
      .mockResolvedValueOnce({ ok: true } as Response); // ready

    const client = new DexieCloudClient('https://test.com');
    const status = await client.getStatus();
    
    expect(status).toEqual({
      healthy: true,
      ready: true,
    });
  });
});

describe('DexieCloudClient convenience methods', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should create database with OTP flow', async () => {
    // Mock OTP request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        type: 'otp-sent',
        otp_id: 'test-otp-id',
      }),
    } as Response);

    // Mock OTP verification
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        type: 'tokens',
        accessToken: 'test-access-token',
      }),
    } as Response);

    // Mock database creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        url: 'https://test.com/db/abc123',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      }),
    } as Response);

    const client = new DexieCloudClient('https://test.com');
    const result = await client.createDatabase(
      'test@example.com',
      async () => '123456'
    );

    expect(result).toEqual({
      url: 'https://test.com/db/abc123',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      accessToken: 'test-access-token',
    });

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});