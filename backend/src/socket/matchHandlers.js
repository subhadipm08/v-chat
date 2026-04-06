import { Match } from '../models/match.model.js';
import logger from '../utils/logger.js';
import redisClient from '../utils/redis.js';
import { getRoomMediaStateKey, isMatchRoom, MATCH_QUEUE_KEY } from './socketState.js';

const parseRoomMediaStates = async (roomId) => {
  const mediaStatesRaw = await redisClient.hgetall(getRoomMediaStateKey(roomId));

  return Object.fromEntries(
    Object.entries(mediaStatesRaw).map(([participantId, state]) => [participantId, JSON.parse(state)])
  );
};

const markMatchEnded = async (roomId) => {
  const matchId = roomId.replace('match:', '');
  await Match.findByIdAndUpdate(matchId, {
    status: 'ENDED',
    endedAt: new Date(),
  });
};

export const registerMatchHandlers = ({ io, socket, userId }) => {
  const removeFromQueue = async () => {
    await redisClient.lrem(MATCH_QUEUE_KEY, 0, socket.id);
  };

  const leaveMatchRooms = async (eventName) => {
    const matchRooms = Array.from(socket.rooms).filter(
      (roomId) => roomId !== socket.id && isMatchRoom(roomId)
    );

    for (const roomId of matchRooms) {
      socket.leave(roomId);
      socket.to(roomId).emit(eventName, { roomId, userId, socketId: socket.id });
      await redisClient.hdel(getRoomMediaStateKey(roomId), userId);
      await markMatchEnded(roomId);
    }
  };

  socket.on('join-random', async () => {
    try {
      await removeFromQueue();

      const queueLength = await redisClient.llen(MATCH_QUEUE_KEY);
      if (queueLength > 5000) {
        socket.emit('error', { message: 'Matchmaking queue full, try again later' });
        return;
      }

      const matchedSocketId = await redisClient.lpop(MATCH_QUEUE_KEY);

      if (!matchedSocketId) {
        await redisClient.rpush(MATCH_QUEUE_KEY, socket.id);
        socket.emit('waiting-match');
        return;
      }

      if (matchedSocketId === socket.id) {
        await redisClient.rpush(MATCH_QUEUE_KEY, socket.id);
        socket.emit('waiting-match');
        return;
      }

      const partnerSocket = io.sockets.sockets.get(matchedSocketId);
      const partnerUserId = partnerSocket?.user?._id?.toString();

      if (!partnerSocket?.connected || !partnerUserId) {
        await redisClient.rpush(MATCH_QUEUE_KEY, socket.id);
        socket.emit('waiting-match');
        return;
      }

      if (partnerUserId === userId) {
        await redisClient.rpush(MATCH_QUEUE_KEY, matchedSocketId, socket.id);
        socket.emit('waiting-match');
        return;
      }

      const match = await new Match({ users: [userId, partnerUserId] }).save();
      const roomId = `match:${match._id.toString()}`;

      socket.join(roomId);
      partnerSocket.join(roomId);

      const initialMediaStates = await parseRoomMediaStates(roomId);

      socket.emit('match-found', {
        matchId: match._id.toString(),
        roomId,
        users: [userId, partnerUserId],
        partnerSocketId: partnerSocket.id,
        partnerUserId,
        shouldInitiate: true,
        initialMediaStates,
      });

      partnerSocket.emit('match-found', {
        matchId: match._id.toString(),
        roomId,
        users: [userId, partnerUserId],
        partnerSocketId: socket.id,
        partnerUserId: userId,
        shouldInitiate: false,
        initialMediaStates,
      });
    } catch (err) {
      logger.error({ err, socketId: socket.id }, 'Matchmaking error');
      socket.emit('error', { message: 'Unable to start matchmaking right now' });
    }
  });

  socket.on('skip-match', async () => {
    try {
      await removeFromQueue();
      await leaveMatchRooms('partner-skipped');
    } catch (err) {
      logger.error({ err, socketId: socket.id }, 'Skip match error');
    }
  });

  return {
    handleDisconnecting: async () => {
      await removeFromQueue();
      await leaveMatchRooms('partner-disconnected');
    },
  };
};
