import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import logger from '../utils/logger.js';
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  clearAuthCookieOptions,
} from '../utils/authCookie.js';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '7d', // 7 days
  });
};

const buildUserPayload = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  status: user.status,
});

const setAuthCookie = (res, token) => {
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions);
};

export const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });

    await newUser.save();
    const token = generateToken(newUser._id);
    setAuthCookie(res, token);

    logger.info({ userId: newUser._id }, 'New user signed up');

    res.status(201).json({
      message: 'User created successfully',
      user: buildUserPayload(newUser),
    });

  } catch (error) {
    logger.error({ err: error }, 'Signup error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

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

    res.json({
      message: 'Logged in successfully',
      user: buildUserPayload(user),
    });

  } catch (error) {
    logger.error({ err: error }, 'Login error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProfile = async (req, res) => {
  res.json({
    user: buildUserPayload(req.user),
  });
};

export const logout = async (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, clearAuthCookieOptions);
  res.json({ message: 'Logged out successfully' });
};
