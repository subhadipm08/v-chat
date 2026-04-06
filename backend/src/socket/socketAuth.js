import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { getTokenFromCookieHeader } from '../utils/authCookie.js';

export const authenticateSocket = async (socket, next) => {
  try {
    const token =
      getTokenFromCookieHeader(socket.handshake.headers.cookie) ||
      socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error: No token'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    socket.user = user;
    next();
  } catch {
    next(new Error('Authentication error: Invalid or expired token'));
  }
};
