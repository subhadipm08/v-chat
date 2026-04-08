import express from 'express';
import { signup, login, getProfile, logout } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../utils/validationSchemas.js';

const router = express.Router();

router.post('/signup', authLimiter, validate(registerSchema), signup);
router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/profile', requireAuth, getProfile);
router.post('/logout', logout);

export default router;
