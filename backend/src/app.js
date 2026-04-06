import express from "express";
import { createServer } from "node:http";
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
  if (req.url.startsWith('/health') || req.url.startsWith('/api/health')) return next();
  logger.info({ method: req.method, url: req.url }, 'Incoming Request');
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
    res.json({
        "init": "Video-Conferencing-App REST API is Running."
    });
});

export default server;
