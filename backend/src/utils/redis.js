import Redis from 'ioredis';
import logger from './logger.js';
import dotenv from 'dotenv';
dotenv.config();

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  logger.error('REDIS_URL is missing in .env');
  process.exit(1); // fail fast (important)
}

const redisClient = new Redis(redisUrl, {
  tls: {}, // REQUIRED for Upstash

  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    logger.warn(`[REDIS] Reconnecting in ${delay}ms...`);
    return delay;
  },

  maxRetriesPerRequest: 5, //  keep low
});

redisClient.on('connect', () => {
  logger.info('[REDIS] CONNECTED');
});

redisClient.on('ready', () => {
  logger.info('[REDIS] READY');
});

redisClient.on('error', (err) => {
  logger.error({ err }, '[REDIS] ERROR');
});

redisClient.on('reconnecting', () => {
  logger.warn('[REDIS] RECONNECTING...');
});

redisClient.on('end', () => {
  logger.warn('[REDIS] CONNECTION CLOSED');
});

//  Important: reuse connection safely
export const pubClient = redisClient.duplicate();
export const subClient = redisClient.duplicate();

pubClient.on('error', (err) => logger.error({ err }, '[REDIS PUB] ERROR'));
subClient.on('error', (err) => logger.error({ err }, '[REDIS SUB] ERROR'));

export default redisClient;