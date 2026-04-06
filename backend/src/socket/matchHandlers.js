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
    await redisClient.srem(MATCH_QUEUE_KEY, socket.id);
  };

  const leaveMatchRooms = async (eventName) => {
    const matchRooms = Array.from(socket.rooms).filter(
      (roomId) => roomId !== socket.id && isMatchRoom(roomId)
    );

    for (const roomId of matchRooms) {
      socket.leave(roomId);
      socket.to(roomId).emit(eventName, { roomId, userId, socketId: socket.id });
      await redisClient.hdel(getRoomMediaStateKey(roomId), userId);
      await redisClient.srem('active_matches', userId);
      await markMatchEnded(roomId);
    }
  };

  const isUserMatching = async (userId) => {
        const key = `match_lock:${userId}`;
        const lockAcquired = await redisClient.set(key, '1', 'EX', 10, 'NX');
        if (!lockAcquired) return true; // Could not acquire lock, user is currently matching
        
        const isActive = await redisClient.sismember('active_matches', userId);
        if (isActive) {
           await redisClient.del(key); 
           return true; // User is already in an active match
        }
        
        return false;
  };
  
  const unlockUser = async (userId) => {
        await redisClient.del(`match_lock:${userId}`);
  };

  socket.on('join-random', async () => {
    try {
      await removeFromQueue();
      
      const isLocked = await isUserMatching(userId);
      if (isLocked) {
         return; // User is already in matchmaking or match process
      }

      const queueLength = await redisClient.scard(MATCH_QUEUE_KEY);
      if (queueLength > 5000) {
        socket.emit('error', { message: 'Matchmaking queue full, try again later' });
        await unlockUser(userId);
        return;
      }

      // Ensure user is disconnected from previous match rooms first
      await leaveMatchRooms('partner-disconnected');

      const matchedSocketId = await redisClient.spop(MATCH_QUEUE_KEY);

      if (!matchedSocketId) {
        await redisClient.sadd(MATCH_QUEUE_KEY, socket.id);
        socket.emit('waiting-match');
        await unlockUser(userId);
        return;
      }

      if (matchedSocketId === socket.id) {
        await redisClient.sadd(MATCH_QUEUE_KEY, socket.id);
        socket.emit('waiting-match');
        await unlockUser(userId);
        return;
      }

      const partnerSocket = io.sockets.sockets.get(matchedSocketId);
      const partnerUserId = partnerSocket?.user?._id?.toString();

      if (!partnerSocket?.connected || !partnerUserId) {
        await redisClient.sadd(MATCH_QUEUE_KEY, socket.id);
        socket.emit('waiting-match');
        await unlockUser(userId);
        return;
      }
      
      const isPartnerActive = await redisClient.sismember('active_matches', partnerUserId);
      if (isPartnerActive) {
        // Partner is already in a match, ignore them and requeue self
        await redisClient.sadd(MATCH_QUEUE_KEY, socket.id);
        socket.emit('waiting-match');
        await unlockUser(userId);
        return;
      }

      if (!partnerSocket?.connected || !partnerUserId) {
        await redisClient.sadd(MATCH_QUEUE_KEY, socket.id);
        socket.emit('waiting-match');
        await unlockUser(userId);
        return;
      }

      if (partnerUserId === userId) {
        // Matched self from another session. Put both back in queue? Nah, just put self back.
        await redisClient.sadd(MATCH_QUEUE_KEY, matchedSocketId, socket.id);
        socket.emit('waiting-match');
        await unlockUser(userId);
        return;
      }

      const match = await new Match({ users: [userId, partnerUserId] }).save();
      const roomId = `match:${match._id.toString()}`;

      // Mark both users as actively matched
      await redisClient.sadd('active_matches', userId, partnerUserId);

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
      
      await unlockUser(userId);
    } catch (err) {
      await unlockUser(userId);
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
