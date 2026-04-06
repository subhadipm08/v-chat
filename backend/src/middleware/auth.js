import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import logger from '../utils/logger.js';
import { getTokenFromRequest } from '../utils/authCookie.js';

export const requireAuth = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    if (!decoded.id) {
       return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.warn({ err: error.message }, 'JWT Verification Failed');
    res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
  }
};
