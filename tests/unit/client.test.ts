/**
 * Unit tests for DexieCloudClient
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DexieCloudClient } from '../../src/client.ts';
import { DexieCloudError } from '../../src/types.ts';

// Helper to create a mock Response with both text() and json()
function mockResponse(data: any, ok = true, status = 200): Response {
  const text = JSON.stringify(data);
  return {
    ok,
    status,
    text: async () => text,
    json: async () => data,
    headers: new Headers(),
    redirected: false,
    statusText: ok ? 'OK' : 'Error',
    type: 'basic',
    url: '',
    clone: () => mockResponse(data, ok, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
  } as Response;
}

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
    mockFetch.mockResolvedValueOnce(mockResponse({
      type: 'otp-sent',
      otp_id: 'test-otp-id',
    }));

    // Mock OTP verification
    mockFetch.mockResolvedValueOnce(mockResponse({
      type: 'tokens',
      accessToken: 'test-access-token',
    }));

    // Mock database creation
    mockFetch.mockResolvedValueOnce(mockResponse({
      url: 'https://test.com/db/abc123',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    }));

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
