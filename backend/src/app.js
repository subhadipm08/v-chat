import express from "express";
import { createServer } from "node:http";
import cors from "cors";
import logger from "./utils/logger.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import helmet from "helmet";

// Controllers / Routes
import authRoutes from "./routes/auth.route.js";
import roomRoutes from "./routes/room.route.js";
import connectToSocket from "./socket/index.js";

const app = express();
const server = createServer(app);
const frontendOrigin = process.env.CORS_ORIGIN ;

// Gracefully attach socket io to HTTP server
const io = connectToSocket(server);

// Middleware
app.use(helmet());
app.use(cors({
  origin: frontendOrigin,
  credentials: true,
}));
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ extended: true, limit: "40kb" }));

// Express Request Logging
app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Incoming Request');
  next();
});

// API Routes
app.use('/api/', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

app.get('/', (req, res) => {
    res.json({
        "init": "Video-Conferencing-App REST API is Running."
    });
});

export default server;
