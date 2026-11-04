/**
 * Web Push Key Encryption Utility — At-Rest Secret Security.
 *
 * Implements:
 * - AES-256-GCM authenticated encryption for p256dh and auth tokens stored in MongoDB.
 * - Key derivation from backend-only PUSH_ENCRYPTION_KEY (with fallback to JWT_SECRET).
 * - Safe decryption with fallback for unencrypted legacy records.
 *
 * @module utils/pushCrypto
 */

import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGO = 'aes-256-gcm';
const SECRET_SEED = env.PUSH_ENCRYPTION_KEY || env.JWT_SECRET || 'khushboo_push_encryption_fallback_seed_32_bytes';
const KEY = crypto.createHash('sha256').update(SECRET_SEED).digest();

/**
 * Encrypts a sensitive subscription credential using AES-256-GCM.
 * @param {string} text - Plaintext key
 * @returns {string} Encrypted string in format `enc:iv:tag:ciphertext`
 */
export function encryptKey(text) {
  if (!text || typeof text !== 'string') return text;
  if (text.startsWith('enc:')) return text; // Already encrypted

  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const tag = cipher.getAuthTag().toString('base64');
    return `enc:${iv.toString('base64')}:${tag}:${encrypted}`;
  } catch (err) {
    console.error('[pushCrypto] Encryption failed:', err.message);
    return text;
  }
}

/**
 * Decrypts a subscription credential encrypted with encryptKey.
 * @param {string} ciphertext - Encrypted string or plaintext fallback
 * @returns {string} Decrypted plaintext key
 */
export function decryptKey(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') return ciphertext;
  if (!ciphertext.startsWith('enc:')) return ciphertext; // Not encrypted

  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) return ciphertext;
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const enc = parts[3];
    const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(enc, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[pushCrypto] Decryption failed:', err.message);
    return ciphertext;
  }
}

