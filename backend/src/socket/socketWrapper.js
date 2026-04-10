import logger from '../utils/logger.js';
import crypto from 'node:crypto';

/**
 * Higher-order function to wrap async socket handlers.
 * It catches errors, logs them with a reference ID, and emits a sanitized error back to the client.
 * 
 * @param {Object} socket - The socket instance to emit errors to
 * @param {Function} handler - The async handler function
 * @returns {Function} - The wrapped handler
 */
export const wrapSocket = (socket, handler) => {
  return async (...args) => {
    try {
      await handler(...args);
    } catch (err) {
      const referenceId = err.referenceId || `ERR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      
      logger.error(
        { 
          err, 
          referenceId, 
          socketId: socket.id,
          userId: socket.user?._id
        }, 
        `Socket Error [${referenceId}] - ${err.message}`
      );

      // Emit standardized error to client
      socket.emit('error', {
        message: err.isOperational ? err.message : 'An unexpected error occurred. Please try again.',
        reference_id: referenceId
      });
    }
  };
};
