import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { pubClient, subClient } from '../utils/redis.js';
import redisClient from '../utils/redis.js';
import logger from '../utils/logger.js';
import { registerMatchHandlers } from './matchHandlers.js';
import { registerRoomHandlers } from './roomHandlers.js';
import { registerSignalingHandlers } from './signalingHandlers.js';
import { authenticateSocket } from './socketAuth.js';
import { getSocketUserKey, getUserSocketSetKey } from './socketState.js';
import { emitInitialStats, registerOnlineUser, unregisterOnlineUser } from './statsService.js';

const connectToSocket = (httpServer) => {
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173'];

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.adapter(createAdapter(pubClient, subClient));
  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    const userSocketSetKey = getUserSocketSetKey(userId);

    logger.info({ socketId: socket.id, userId }, 'Socket connected');

    // Track unique user presence locally first; the periodic sync publishes the aggregate.
    registerOnlineUser(socket);
    // Send immediate current stats to the joining user from local cache
    emitInitialStats(socket);

    try {
      await redisClient.sadd(userSocketSetKey, socket.id);
      await redisClient.set(getSocketUserKey(socket.id), userId);
    } catch (err) {
      logger.error({ err, socketId: socket.id, userId }, 'Socket Redis bookkeeping failed');
    }

    const roomHandlers = registerRoomHandlers({ io, socket, userId });
    const matchHandlers = registerMatchHandlers({ io, socket, userId });
    registerSignalingHandlers({ io, socket, userId });

    socket.on('disconnecting', async () => {
      try {
        await roomHandlers.handleDisconnecting();
        await matchHandlers.handleDisconnecting();
      } catch (err) {
        logger.error({ err, socketId: socket.id }, 'Socket disconnecting cleanup failed');
      }
    });

    socket.on('disconnect', async () => {
      logger.info({ socketId: socket.id, userId }, 'Socket disconnected');

      try {
        await redisClient.srem(userSocketSetKey, socket.id);

        if ((await redisClient.scard(userSocketSetKey)) === 0) {
          await redisClient.del(userSocketSetKey);
        }

        await redisClient.del(getSocketUserKey(socket.id));
      } catch (err) {
        logger.error({ err, socketId: socket.id, userId }, 'Socket Redis cleanup failed');
      } finally {
        unregisterOnlineUser(socket);
      }
    });
  });

  return io;
};

export default connectToSocket;
