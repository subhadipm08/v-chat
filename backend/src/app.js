import express from "express";
import { createServer } from "node:http";
import crypto from "node:crypto";
import cors from "cors";
import logger from "./utils/logger.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import helmet from "helmet";
import mongoose from "mongoose";
import redisClient from "./utils/redis.js";

// Controllers / Routes
import authRoutes from "./routes/auth.route.js";
import roomRoutes from "./routes/room.route.js";
import connectToSocket from "./socket/index.js";

const app = express();
app.set("trust proxy", 1);
const server = createServer(app);
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : ["http://localhost:5173"];

// Gracefully attach socket io to HTTP server
const io = connectToSocket(server);

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ extended: true, limit: "40kb" }));

// Express Request Logging
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  if (req.url.startsWith('/health') || req.url.startsWith('/api/health')) return next();
  logger.info({ method: req.method, url: req.url, requestId: req.id }, 'Incoming Request');
  next();
});

// API Routes
app.use('/api/', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

const healthResponse = () => {
  const isMongoHealthy = mongoose.connection.readyState === 1;
  const isRedisHealthy = redisClient.status === 'ready';

  return {
    status: isMongoHealthy && isRedisHealthy ? 'ok' : 'degraded',
    services: {
      mongo: isMongoHealthy ? 'up' : 'down',
      redis: isRedisHealthy ? 'up' : 'down',
    },
  };
};

app.get('/healthz', (req, res) => {
  const health = healthResponse();
  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

app.get('/api/healthz', (req, res) => {
  const health = healthResponse();
  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

app.get('/', (req, res) => {
  res.json({ init: 'Video-Conferencing-App REST API is Running.' });
});

// ─── 404 — Unknown Route ────────────────────────────────────────────────────
// Must be AFTER all route definitions. Returns clean JSON — never HTML.
app.use((req, res) => {
  res.status(404).json({ error: 'The requested resource was not found.' });
});

// ─── Global Error Handler ───────────────────────────────────────────────────
// Express calls this 4-argument middleware whenever next(err) is called
// OR when a synchronous error is thrown inside a route handler.
// It is the last line of defence before the process crashes.
// CRITICAL: Never expose err.stack or internal details in production.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Always log the full error server-side for debugging
  logger.error(
    { err, requestId: req.id, method: req.method, url: req.url },
    'Unhandled server error'
  );

  // Determine HTTP status — use err.status/statusCode if set, else 500
  const status = err.status || err.statusCode || 500;

  // Safe client-facing message:
  // - Development: show the actual message to speed up debugging
  // - Production: always show a generic message (no stack, no paths, no code)
  const clientMessage = isProduction
    ? 'An unexpected error occurred. Please try again later.'
    : (err.message || 'Internal Server Error');

  res.status(status).json({ error: clientMessage });
});

export default server;
