import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import logger from '../utils/logger.js';
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  clearAuthCookieOptions,
} from '../utils/authCookie.js';
import {
  createAndStoreOtp,
  isOnCooldown,
  validateOtp,
  storePendingSignup,
  getPendingSignup,
  deletePendingSignup,
} from '../utils/otp.js';
import { sendOtpEmail } from '../utils/mailer.js';

const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

const buildUserPayload = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  status: user.status,
});

const setAuthCookie = (res, token) =>
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions);

// ─── Signup ───────────────────────────────────────────────────────────────
// Does NOT create a DB user. Stores data in Redis + sends OTP.
// Account is only created in MongoDB after email is verified.
export const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 1. Check if email is already registered in MongoDB (fully verified user)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // 2. Check if a pending (unverified) signup already exists in Redis
    const alreadyPending = await getPendingSignup(email);
    if (alreadyPending) {
      const cooldown = await isOnCooldown('verify', email);
      if (cooldown) {
        return res.status(429).json({
          error: 'An OTP was already sent. Please wait 1 minute before requesting again.',
          email,
          pendingVerification: true,
        });
      }
      // Resend OTP for the existing pending registration
      const otp = await createAndStoreOtp('verify', email);
      await sendOtpEmail(email, otp, 'verify');
      return res.status(200).json({
        message: 'OTP resent. Please check your email.',
        email,
        pendingVerification: true,
      });
    }

    // 3. Hash password and store pending signup data in Redis (10-min TTL)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await storePendingSignup(email, { username, email, hashedPassword });

    // 4. Generate OTP and send email
    const otp = await createAndStoreOtp('verify', email);
    await sendOtpEmail(email, otp, 'verify');

    logger.info({ email }, 'Pending signup created, OTP sent');

    res.status(201).json({
      message: 'OTP sent to your email. Please verify to complete registration.',
      email,
      pendingVerification: true,
    });
  } catch (error) {
    logger.error({ err: error }, 'Signup error');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// ─── Verify Email ─────────────────────────────────────────────────────────
// Validates OTP → creates user in MongoDB → auto-login.
export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // 1. Validate OTP
    const result = await validateOtp('verify', email, otp);
    if (!result.valid) {
      return res.status(400).json({ error: result.reason });
    }

    // 2. Retrieve pending signup data from Redis
    const pending = await getPendingSignup(email);
    if (!pending) {
      return res.status(400).json({
        error: 'Registration session expired. Please sign up again.',
      });
    }

    // 3. Double-check email isn't already registered (race condition guard)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      await deletePendingSignup(email);
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // 4. Create verified user in MongoDB
    const newUser = await User.create({
      username: pending.username,
      email: pending.email,
      password: pending.hashedPassword,
    });

    // 5. Cleanup Redis
    await deletePendingSignup(email);

    // 6. Auto-login with auth cookie
    const token = generateToken(newUser._id);
    setAuthCookie(res, token);

    logger.info({ userId: newUser._id }, 'User verified and created successfully');

    res.status(201).json({
      message: 'Email verified! Your account has been created.',
      user: buildUserPayload(newUser),
    });
  } catch (error) {
    logger.error({ err: error }, 'Verify email error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Resend OTP ───────────────────────────────────────────────────────────
export const resendOtp = async (req, res) => {
  try {
    const { email, type } = req.body;

    const cooldown = await isOnCooldown(type, email);
    if (cooldown) {
      return res.status(429).json({
        error: 'Please wait 1 minute before requesting a new OTP.',
      });
    }

    if (type === 'verify') {
      // Must have a pending signup in Redis
      const pending = await getPendingSignup(email);
      if (!pending) {
        return res.status(400).json({
          error: 'No pending registration found. Please sign up again.',
        });
      }
    }

    if (type === 'reset') {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ error: 'No account found with this email.' });
      }
    }

    const otp = await createAndStoreOtp(type, email);
    await sendOtpEmail(email, otp, type);

    res.json({ message: 'A new OTP has been sent to your email.' });
  } catch (error) {
    logger.error({ err: error }, 'Resend OTP error');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// ─── Login ────────────────────────────────────────────────────────────────
// No isVerified check needed — only verified users exist in DB.
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user._id);
    setAuthCookie(res, token);

    logger.info({ userId: user._id }, 'User logged in');

    res.json({
      message: 'Logged in successfully',
      user: buildUserPayload(user),
    });
  } catch (error) {
    logger.error({ err: error }, 'Login error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Forgot Password ──────────────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    // Always return same message to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If an account with this email exists, an OTP has been sent.' });
    }

    const cooldown = await isOnCooldown('reset', email);
    if (cooldown) {
      return res.status(429).json({
        error: 'Please wait 1 minute before requesting a new OTP.',
      });
    }

    const otp = await createAndStoreOtp('reset', email);
    await sendOtpEmail(email, otp, 'reset');

    logger.info({ userId: user._id }, 'Password reset OTP sent');

    res.json({ message: 'If an account with this email exists, an OTP has been sent.' });
  } catch (error) {
    logger.error({ err: error }, 'Forgot password error');
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// ─── Reset Password ───────────────────────────────────────────────────────
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const result = await validateOtp('reset', email, otp);
    if (!result.valid) {
      return res.status(400).json({ error: result.reason });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const user = await User.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    logger.info({ userId: user._id }, 'User password reset successfully');

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    logger.error({ err: error }, 'Reset password error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Profile / Logout ─────────────────────────────────────────────────────
export const getProfile = async (req, res) => {
  res.json({ user: buildUserPayload(req.user) });
};

export const logout = async (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, clearAuthCookieOptions);
  res.json({ message: 'Logged out successfully' });
};
