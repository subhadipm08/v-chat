import { Room } from '../models/room.model.js';
import logger from '../utils/logger.js';
import redisClient from '../utils/redis.js';
import { endSession, startSession } from './sessionService.js';
import { getRoomMediaStateKey, isMatchRoom } from './socketState.js';
import { handleRoomJoin, handleRoomLeave } from './statsService.js';

const hasParticipant = (room, userId) =>
  room.currentParticipants.some((participantId) => participantId.toString() === userId);

const parseMediaStates = async (roomId) => {
  const mediaStatesRaw = await redisClient.hgetall(getRoomMediaStateKey(roomId));

  return Object.fromEntries(
    Object.entries(mediaStatesRaw).map(([participantId, state]) => [participantId, JSON.parse(state)])
  );
};

export const registerRoomHandlers = ({ io, socket, userId }) => {
  const removeParticipantIfInactive = async (roomId) => {
    const activeSockets = await io.in(roomId).fetchSockets();
    const userStillInRoom = activeSockets.some(
      (activeSocket) => activeSocket.user?._id?.toString() === userId
    );

    if (userStillInRoom) {
      return;
    }

    const updatedRoom = await Room.findOneAndUpdate(
      { roomId },
      { $pull: { currentParticipants: userId } },
      { returnDocument: 'after' }
    );

    if (!updatedRoom) {
      return;
    }

    if (updatedRoom.currentParticipants.length === 0) {
      await Room.deleteOne({ roomId });
    }

    await redisClient.hdel(getRoomMediaStateKey(roomId), userId);
  };

  const leavePrivateRoom = async (roomId, exitReason) => {
    if (!roomId || isMatchRoom(roomId)) {
      return;
    }

    socket.leave(roomId);
    socket.to(roomId).emit('user-left', { userId, socketId: socket.id, username: socket.user?.username });
    
    // Centralized stat cleanup
    if (socket.currentRoomId === roomId) {
      socket.currentRoomId = null;
      await handleRoomLeave(io, roomId);
    }

    await removeParticipantIfInactive(roomId);
    await endSession(socket.id, exitReason);
    
    socket.inRoom = false; 
  };

  socket.on('join-room', async ({ roomId }) => {
    try {
      const room = await Room.findOne({ roomId });

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const socketsInRoom = await io.in(roomId).fetchSockets();
      if (socketsInRoom.length >= room.maxParticipants) {
        socket.emit('room-full', { message: 'Room is full' });
        return;
      }

      socket.join(roomId);

      // Track the room on the socket for cleanup and stats
      socket.currentRoomId = roomId;
      socket.inRoom = true;
      await handleRoomJoin(io, roomId);

      await startSession({
        userId,
        roomId: room._id,
        connectionId: socket.id,
      });

      if (!hasParticipant(room, userId)) {
        room.currentParticipants.push(socket.user._id);
      }

      if (room.status !== 'ACTIVE') {
        room.status = 'ACTIVE';
        room.startedAt ??= new Date();
        room.endedAt = undefined;
      }

      await room.save();

      socket.to(roomId).emit('user-joined', { userId, socketId: socket.id, username: socket.user?.username });

      const existingUsers = socketsInRoom.map((existingSocket) => ({
        socketId: existingSocket.id,
        userId: existingSocket.user._id.toString(),
        username: existingSocket.user.username,
      }));

      socket.emit('room-joined', {
        roomId,
        existingUsers,
        initialMediaStates: await parseMediaStates(roomId),
      });
    } catch (err) {
      logger.error({ err, roomId, socketId: socket.id }, 'Join room error');
      socket.emit('error', { message: 'Unable to join room' });
    }
  });

  socket.on('verify-room', async ({ roomId }, callback) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) {
        callback({ valid: false, message: `Room with ID '${roomId}' does not exist.` });
      } else {
        callback({ valid: true });
      }
    } catch (err) {
      callback({ valid: false, message: 'Server error' });
    }
  });

  socket.on('leave-room', async ({ roomId }) => {
    try {
      await leavePrivateRoom(roomId, 'LEFT');
    } catch (err) {
      logger.error({ err, roomId, socketId: socket.id }, 'Leave room error');
    }
  });

  socket.on('media-state-change', async ({ roomId, isMicOn, isCameraOn }) => {
    if (!roomId) {
      return;
    }

    await redisClient.hset(
      getRoomMediaStateKey(roomId),
      userId,
      JSON.stringify({ isMicOn, isCameraOn })
    );

    socket.to(roomId).emit('user-media-updated', {
      userId,
      socketId: socket.id,
      isMicOn,
      isCameraOn,
    });
  });

  return {
    handleDisconnecting: async () => {
      const roomIds = Array.from(socket.rooms).filter(
        (roomId) => roomId !== socket.id && !isMatchRoom(roomId)
      );

      for (const roomId of roomIds) {
        await leavePrivateRoom(roomId, 'DISCONNECTED');
      }
    },
  };
};
