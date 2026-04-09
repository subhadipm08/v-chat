import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // Limit each IP to 20 requests per `window` for auth routes
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});

export const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => {
    return req.originalUrl.includes('/api/rooms/ice-servers');
  },
  message: { error: 'Too many requests, please try again later.' }
});

// Strict limiter for sending OTPs (max 3 sends per 5 minutes per IP)
export const otpSendLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many OTP requests. Please wait 5 minutes before trying again.' }
});

// Limiter for verifying OTPs (max 5 attempts per 5 minutes per IP)
export const otpVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many verification attempts. Please wait 5 minutes.' }
});

