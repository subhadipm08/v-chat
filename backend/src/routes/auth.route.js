import express from 'express';
import {
  signup,
  login,
  getProfile,
  logout,
  verifyEmail,
  resendOtp,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter, otpSendLimiter, otpVerifyLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../utils/validationSchemas.js';

const router = express.Router();

// ── Core Auth ──────────────────────────────────────────────────────────────
router.post('/signup',  authLimiter,      validate(registerSchema), signup);
router.post('/login',   authLimiter,      validate(loginSchema),    login);
router.get('/profile',  requireAuth,      getProfile);
router.post('/logout',  logout);

// ── OTP: Email Verification ────────────────────────────────────────────────
router.post('/verify-email', otpVerifyLimiter, validate(verifyEmailSchema), verifyEmail);
router.post('/resend-otp',   otpSendLimiter,   validate(resendOtpSchema),   resendOtp);

// ── OTP: Forgot / Reset Password ──────────────────────────────────────────
router.post('/forgot-password', otpSendLimiter,   validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password',  otpVerifyLimiter, validate(resetPasswordSchema),  resetPassword);

export default router;
