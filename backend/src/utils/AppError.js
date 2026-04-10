import crypto from 'node:crypto';

/**
 * Custom Error class for operational errors that can be safely reported to the client.
 */
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    // Generate a unique reference ID for debugging
    // Format: ERR-XXXXXX (e.g., ERR-A1B2C3)
    this.referenceId = `ERR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
