/**
 * Unit tests for AuthManager
 */
import { describe, it, expect, vi } from 'vitest';
import { AuthManager } from '../../src/auth.ts';
import { DexieCloudAuthError } from '../../src/types.ts';
import { FetchAdapter } from '../../src/adapters.ts';

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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'otp-sent',
          otp_id: 'test-otp-id',
        }),
      } as Response);

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
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid email',
      } as Response);

      await expect(auth.requestOTP('invalid-email')).rejects.toThrow(
        DexieCloudAuthError
      );
    });

    it('should throw error on unexpected response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'tokens', // Wrong type
          accessToken: 'token',
        }),
      } as Response);

      await expect(auth.requestOTP('test@example.com')).rejects.toThrow(
        DexieCloudAuthError
      );
    });
  });

  describe('verifyOTP', () => {
    it('should verify OTP successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'tokens',
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          userId: 'test-user-id',
        }),
      } as Response);

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
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid OTP',
      } as Response);

      await expect(
        auth.verifyOTP('test@example.com', 'test-otp-id', 'wrong')
      ).rejects.toThrow(DexieCloudAuthError);
    });
  });

  describe('authenticateWithOTP', () => {
    it('should complete full OTP flow', async () => {
      // Mock OTP request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'otp-sent',
          otp_id: 'test-otp-id',
        }),
      });

      // Mock OTP verification
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'tokens',
          accessToken: 'test-access-token',
        }),
      });

      const tokens = await auth.authenticateWithOTP(
        'test@example.com',
        async () => '123456'
      );

      expect(tokens.accessToken).toBe('test-access-token');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});