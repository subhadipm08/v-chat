import express from 'express';
import { signup, login, getProfile, logout } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);
router.get('/profile', requireAuth, getProfile);
router.post('/logout', logout);

export default router;
