/**
 * Legacy types for OTP authentication
 * Used by legacy client for database creation flows
 */

export interface LegacyTokenResponse {
  type: 'otp-sent' | 'tokens';
  otp_id?: string;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  claims?: Record<string, any>;
}