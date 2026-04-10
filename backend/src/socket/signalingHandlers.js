import logger from '../utils/logger.js';
import { wrapSocket } from './socketWrapper.js';

export const registerSignalingHandlers = ({ io, socket, userId }) => {
  socket.on('offer', wrapSocket(socket, ({ payload, target, roomId }) => {
    if (!target) {
      logger.warn({ socketId: socket.id, roomId }, 'Offer dropped because target socket is missing');
      return;
    }

    io.to(target).emit('offer', {
      payload,
      caller: socket.id,
      callerId: userId,
      roomId,
    });
  }));

  socket.on('answer', wrapSocket(socket, ({ payload, target, roomId }) => {
    if (!target) {
      logger.warn({ socketId: socket.id, roomId }, 'Answer dropped because target socket is missing');
      return;
    }

    io.to(target).emit('answer', {
      payload,
      answerer: socket.id,
      answererId: userId,
      roomId,
    });
  }));

  socket.on('ice-candidate', wrapSocket(socket, ({ candidate, target, roomId }) => {
    if (!target) {
      logger.warn({ socketId: socket.id, roomId }, 'ICE candidate dropped because target socket is missing');
      return;
    }

    io.to(target).emit('ice-candidate', {
      candidate,
      sender: socket.id,
      roomId,
    });
  }));
};
