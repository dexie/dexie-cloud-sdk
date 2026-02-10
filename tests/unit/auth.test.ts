/**
 * Unit tests for AuthManager
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthManager } from '../../src/auth.ts';
import { DexieCloudAuthError } from '../../src/types.ts';
import { FetchAdapter } from '../../src/adapters.ts';

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

function mockErrorResponse(errorText: string, status: number): Response {
  return {
    ok: false,
    status,
    text: async () => errorText,
    json: async () => { throw new Error('Not JSON'); },
    headers: new Headers(),
    redirected: false,
    statusText: 'Error',
    type: 'basic',
    url: '',
    clone: () => mockErrorResponse(errorText, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
  } as Response;
}

// Mock fetch
const mockFetch = vi.fn();

describe('AuthManager', () => {
  const config = {
    serviceUrl: 'https://test.com',
    timeout: 5000,
  };

  const adapter = new FetchAdapter(config, mockFetch);
  const auth = new AuthManager(config, adapter);

  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('requestOTP', () => {
    it('should request OTP successfully', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        type: 'otp-sent',
        otp_id: 'test-otp-id',
      }));

      const otpId = await auth.requestOTP('test@example.com');

      expect(otpId).toBe('test-otp-id');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.com/service/token',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            grant_type: 'otp',
            email: 'test@example.com',
            scopes: ['CREATE_DB'],
          }),
        })
      );
    });

    it('should throw auth error on failure', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse('Invalid email', 400));

      await expect(auth.requestOTP('invalid-email')).rejects.toThrow(
        DexieCloudAuthError
      );
    });

    it('should throw error on unexpected response', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        type: 'tokens', // Wrong type
        accessToken: 'token',
      }));

      await expect(auth.requestOTP('test@example.com')).rejects.toThrow(
        DexieCloudAuthError
      );
    });
  });

  describe('verifyOTP', () => {
    it('should verify OTP successfully', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        type: 'tokens',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        userId: 'test-user-id',
      }));

      const tokens = await auth.verifyOTP(
        'test@example.com',
        'test-otp-id',
        '123456'
      );

      expect(tokens).toEqual({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        userId: 'test-user-id',
      });
    });

    it('should throw auth error on invalid OTP', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse('Invalid OTP', 401));

      await expect(
        auth.verifyOTP('test@example.com', 'test-otp-id', 'wrong')
      ).rejects.toThrow(DexieCloudAuthError);
    });
  });

  describe('authenticateWithOTP', () => {
    it('should complete full OTP flow', async () => {
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

      const tokens = await auth.authenticateWithOTP(
        'test@example.com',
        async () => '123456'
      );

      expect(tokens.accessToken).toBe('test-access-token');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
