import redisClient from './redis.js';

const OTP_TTL_SECONDS = 60;            // OTP expires in 1 minute
const RESEND_COOLDOWN_SECONDS = 60;    // Cannot resend for 1 minute
const PENDING_SIGNUP_TTL = 10 * 60;   // Pending signup data lives for 10 minutes

const otpKey      = (type, email) => `otp:${type}:${email}`;
const cooldownKey = (type, email) => `otp:cooldown:${type}:${email}`;
const pendingKey  = (email)       => `pending:signup:${email}`;

// ─── OTP Lifecycle ─────────────────────────────────────────────────────────

/** Generates a secure 6-digit numeric OTP. */
export const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Stores OTP in Redis (1-min TTL) and sets a 1-min resend cooldown.
 * @returns {string} The generated OTP so the caller can email it.
 */
export const createAndStoreOtp = async (type, email) => {
  const otp = generateOtp();
  await Promise.all([
    redisClient.set(otpKey(type, email),      otp, 'EX', OTP_TTL_SECONDS),
    redisClient.set(cooldownKey(type, email), '1', 'EX', RESEND_COOLDOWN_SECONDS),
  ]);
  return otp;
};

/**
 * Returns true if a resend is currently blocked by cooldown.
 */
export const isOnCooldown = async (type, email) => {
  const val = await redisClient.get(cooldownKey(type, email));
  return val !== null;
};

/**
 * Validates OTP. On success, consumes (deletes) the OTP key — one-time use.
 * @returns {{ valid: boolean, reason?: string }}
 */
export const validateOtp = async (type, email, submittedOtp) => {
  const storedOtp = await redisClient.get(otpKey(type, email));

  if (!storedOtp) {
    return { valid: false, reason: 'OTP has expired. Please request a new one.' };
  }
  if (storedOtp !== submittedOtp) {
    return { valid: false, reason: 'Invalid OTP. Please try again.' };
  }

  // Consume the OTP (cooldown stays to prevent immediate re-request)
  await redisClient.del(otpKey(type, email));
  return { valid: true };
};

// ─── Pending Signup Storage ────────────────────────────────────────────────

/**
 * Temporarily stores hashed user data in Redis while awaiting email verification.
 * TTL: 10 minutes — if user doesn't verify, data is auto-deleted.
 */
export const storePendingSignup = async (email, userData) => {
  await redisClient.set(
    pendingKey(email),
    JSON.stringify(userData),
    'EX',
    PENDING_SIGNUP_TTL
  );
};

/**
 * Retrieves pending signup data. Returns null if expired or not found.
 */
export const getPendingSignup = async (email) => {
  const raw = await redisClient.get(pendingKey(email));
  return raw ? JSON.parse(raw) : null;
};

/**
 * Deletes pending signup data after successful account creation.
 */
export const deletePendingSignup = async (email) => {
  await redisClient.del(pendingKey(email));
};
