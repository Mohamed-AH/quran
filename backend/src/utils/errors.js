/**
 * Custom Error Classes
 * Centralized error definitions for the application
 */

/**
 * Custom error class for API errors
 */
class APIError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = APIError;
