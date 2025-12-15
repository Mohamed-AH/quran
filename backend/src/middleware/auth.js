const { verifyAccessToken, extractTokenFromHeader } = require('../utils/jwt');
const { User } = require('../models');
const { APIError, asyncHandler } = require('./errorHandler');

/**
 * Authentication Middleware
 * Protects routes by verifying JWT tokens
 */

/**
 * Authenticate user from JWT token
 * Adds req.user if valid token
 */
const authenticate = asyncHandler(async (req, res, next) => {
  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    throw new APIError('Authentication required. Please provide a valid token.', 401);
  }

  // Verify token
  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (error) {
    throw new APIError(error.message, 401);
  }

  // Get user from database
  const user = await User.findById(decoded.userId);

  if (!user) {
    throw new APIError('User not found. Token may be invalid.', 401);
  }

  // Attach user to request object
  req.user = user;
  req.userId = user._id;

  next();
});

/**
 * Optional authentication
 * Attaches user if token is valid, but doesn't fail if no token
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    // No token provided, continue without user
    return next();
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId);

    if (user) {
      req.user = user;
      req.userId = user._id;
    }
  } catch (error) {
    // Invalid token, but don't fail - just continue without user
    console.warn('Optional auth: Invalid token provided');
  }

  next();
});

/**
 * Check if user is authenticated
 * Simpler version that just checks req.user
 */
const requireAuth = (req, res, next) => {
  if (!req.user) {
    throw new APIError('Authentication required', 401);
  }
  next();
};

module.exports = {
  authenticate,
  optionalAuth,
  requireAuth,
};
