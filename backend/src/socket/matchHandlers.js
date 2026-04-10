import { Match } from '../models/match.model.js';
import { User } from '../models/user.model.js';
import logger from '../utils/logger.js';
import redisClient from '../utils/redis.js';
import { getRoomMediaStateKey, isMatchRoom, MATCH_QUEUE_KEY } from './socketState.js';
import { updateWaitingUsers, handleRoomJoin, handleRoomLeave } from './statsService.js';

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
    const wasRemoved = await redisClient.srem(MATCH_QUEUE_KEY, socket.id);
    if (wasRemoved && socket.isWaiting) {
      socket.isWaiting = false;
      updateWaitingUsers(io, -1);
    }
  };

  const leaveMatchRooms = async (eventName) => {
    // ALWAYS force-clear the user's active presence and locks to prevent ghosting
    await redisClient.srem('active_matches', userId);
    await unlockUser(userId);

    const matchRooms = Array.from(socket.rooms).filter(
      (roomId) => roomId !== socket.id && isMatchRoom(roomId)
    );

    for (const roomId of matchRooms) {
      socket.leave(roomId);
      socket.to(roomId).emit(eventName, { roomId, userId, socketId: socket.id });
      await redisClient.hdel(getRoomMediaStateKey(roomId), userId);
      await markMatchEnded(roomId);

      if (socket.currentRoomId === roomId) {
        socket.currentRoomId = null;
        await handleRoomLeave(io, roomId);
      }
      socket.inRoom = false;
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

      socket.isWaiting = true;
      updateWaitingUsers(io, 1);

      // Ensure user is disconnected from previous match rooms first
      await leaveMatchRooms('partner-disconnected');

      // Find a valid partner in the queue using a pop-verify loop
      let matchedSocketId = null;
      let partnerUserId = null;
      let skippedSockets = [];
      let attempts = 0;

      while (attempts < 5) {
        attempts++;
        matchedSocketId = await redisClient.spop(MATCH_QUEUE_KEY);
        if (!matchedSocketId) break; // Queue empty

        if (matchedSocketId === socket.id) {
          continue; // popped ourselves, keep looking
        }

        partnerUserId = await redisClient.get(`socket:${matchedSocketId}:user`);
        if (!partnerUserId) {
          continue; // dead or disconnected socket
        }

        const isPartnerActive = await redisClient.sismember('active_matches', partnerUserId);
        if (isPartnerActive) {
          continue; // Partner already matched via another concurrent loop
        }

        break; // Found a perfectly valid partner!
      }

      if (attempts >= 5 && !matchedSocketId) {
        logger.warn({ socketId: socket.id }, 'Matchmaking loop hit attempt limit');
      }

      // Put back anyone we temporarily popped but decided to skip (like our own exact alternate sessions)
      if (skippedSockets.length > 0) {
        await redisClient.sadd(MATCH_QUEUE_KEY, ...skippedSockets);
      }

      if (!matchedSocketId || !partnerUserId) {
        // No valid partner found, insert self and wait
        await redisClient.sadd(MATCH_QUEUE_KEY, socket.id);
        socket.emit('waiting-match');
        await unlockUser(userId);
        return;
      }

      const match = await new Match({ users: [userId, partnerUserId] }).save();
      const roomId = `match:${match._id.toString()}`;

      // Mark both users as actively matched
      await redisClient.sadd('active_matches', userId, partnerUserId);

      // In a distributed Redis-adapter setup, we can use socketsJoin on individual sockets
      socket.join(roomId);
      io.in(matchedSocketId).socketsJoin(roomId);

      const initialMediaStates = await parseRoomMediaStates(roomId);

      const partnerUserStr = await redisClient.get(`socket:${matchedSocketId}:user`);
      const partnerUser = await User.findById(partnerUserStr).select('username');

      // Update stats for the match
      socket.isWaiting = false;
      socket.inRoom = true;
      socket.currentRoomId = roomId;

      updateWaitingUsers(io, -2); // Both self and partner are out of queue
      await handleRoomJoin(io, roomId); // Stat for self

      // Find the partner socket and update its state too
      const partnerSockets = await io.in(matchedSocketId).fetchSockets();
      if (partnerSockets.length > 0) {
        const partnerSocket = partnerSockets[0];
        partnerSocket.isWaiting = false;
        partnerSocket.inRoom = true;
        partnerSocket.currentRoomId = roomId;
        await handleRoomJoin(io, roomId); // Stat for partner
      }

      socket.emit('match-found', {
        matchId: match._id.toString(),
        roomId,
        users: [userId, partnerUserId],
        partnerSocketId: matchedSocketId,
        partnerUserId,
        partnerUsername: partnerUser?.username,
        shouldInitiate: true,
        initialMediaStates,
      });

      // Emit to partner (works across Node cluster)
      io.to(matchedSocketId).emit('match-found', {
        matchId: match._id.toString(),
        roomId,
        users: [userId, partnerUserId],
        partnerSocketId: socket.id,
        partnerUserId: userId,
        partnerUsername: socket.user?.username,
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
