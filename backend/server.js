import dotenv from 'dotenv';
import server from "./src/app.js";
import connectDB from './src/database/connectDB.js';
import logger from './src/utils/logger.js';
import redisClient from './src/utils/redis.js';
import mongoose from 'mongoose';
import { Session } from './src/models/session.model.js';
import { resetVolatileStats } from './src/socket/statsService.js';

dotenv.config({ quiet: true });

const requiredEnv = ['MONGO_URL', 'REDIS_URL', 'JWT_SECRET', 'CORS_ORIGIN'];
const missingEnv = requiredEnv.filter((env) => !process.env[env]);
if (missingEnv.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
}

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        await connectDB();

        // Check for manual stats reset flag
        if (process.env.RESET_STATS === 'true') {
            await resetVolatileStats();
        }
        
        server.listen(PORT, () => {
             logger.info(`Server running on port ${PORT}`);
        });

        // Background Job for Data Lifecycle (runs every 10 mins)
        setInterval(async () => {
           logger.info("Running background data lifecycle cleanup");
           const expirationTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours old
           await Session.deleteMany({ leftAt: { $ne: null }, createdAt: { $lt: expirationTime } });
           // Could also archive old matches, ended rooms, etc.
        }, 10 * 60 * 1000);

    } catch (err) {
        logger.error({ err }, "Server startup failed");
        process.exit(1);
    }
};

startServer();

// Graceful Shutdown logic
const shutdownLine = async (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    
    server.close(async () => {
       logger.info("HTTP server closed.");
       
       // Close MongoDB Connection
       if (mongoose.connection.readyState === 1) {
           await mongoose.connection.close();
           logger.info("MongoDB connection closed.");
       }

       // Close Redis Connection
       if (redisClient.status === 'ready') {
           await redisClient.quit();
           logger.info("Redis connection closed.");
       }

       process.exit(0);
    });

    // Force close if tasks take longer than 10 seconds
    setTimeout(() => {
        logger.error("Could not close connections in time, forcefully shutting down");
        process.exit(1);
    }, 10000);
};

process.on('SIGINT', () => shutdownLine('SIGINT'));
process.on('SIGTERM', () => shutdownLine('SIGTERM'));
process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught Exception');
    shutdownLine('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled Rejection');
    shutdownLine('unhandledRejection');
});