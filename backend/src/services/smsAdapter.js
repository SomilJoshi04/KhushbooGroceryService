/**
 * SMS Provider Adapter.
 *
 * Provides a unified interface for SMS dispatch (primarily OTP delivery).
 *
 * Rules:
 * - Production: fails closed with an error if no live provider is configured.
 * - Development: if USE_DEV_OTP is enabled, logs OTP dispatch safely in development console only.
 * - No credentials or provider tokens are hardcoded.
 *
 * @module services/smsAdapter
 */

import { env } from '../config/env.js';

/**
 * Interface that all SMS providers must implement.
 * @typedef {Object} ISmsProvider
 * @property {function(string, string): Promise<{success: boolean, messageId?: string}>} sendOtp
 */

/**
 * Local development SMS provider — logs OTP safely to the dev console.
 * Strictly disallowed in production.
 */
class DevSmsProvider {
  /**
   * @param {string} phone
   * @param {string} otp
   */
  async sendOtp(phone, otp) {
    if (env.NODE_ENV === 'production') {
      throw new Error('DevSmsProvider cannot be used in production environment!');
    }

    console.info(`[sms:dev] 📱 OTP dispatch simulation for ${phone}: [OTP: ${otp}] (Valid for ${env.OTP_TTL_MINUTES}m)`);
    return {
      success: true,
      messageId: `dev-sim-${Date.now()}`,
    };
  }
}

/**
 * Production placeholder adapter — fails closed when live SMS provider is not yet set up.
 */
class UnconfiguredProductionSmsProvider {
  async sendOtp(phone) {
    console.error(`[sms:production] ❌ SMS Provider is not configured. Cannot deliver OTP to ${phone.slice(0, 6)}****.`);
    throw new Error(
      'SMS provider is not configured. Please contact support or set SMS_PROVIDER credentials.'
    );
  }
}

/**
 * Factory to return the active SMS provider based on configuration.
 * @returns {ISmsProvider}
 */
function getSmsProvider() {
  if (env.NODE_ENV !== 'production' && env.USE_DEV_OTP) {
    return new DevSmsProvider();
  }

  // Future providers (MSG91, Fast2SMS, 2Factor) will be instantiated here once
  // real provider credentials and DLT entity/template IDs are provided by the business.
  return new UnconfiguredProductionSmsProvider();
}

export const smsService = getSmsProvider();
