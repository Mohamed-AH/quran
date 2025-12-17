const { User } = require('../models');
const {
  generateTokenPair,
  verifyRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require('../utils/jwt');
const { APIError, asyncHandler } = require('../middleware/errorHandler');

/**
 * Authentication Controller
 * Handles OAuth callbacks, token generation, and user authentication
 */

/**
 * OAuth Success Handler
 * Called after successful OAuth authentication
 * Generates JWT tokens and redirects to frontend
 */
const oauthSuccess = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new APIError('Authentication failed', 401);
  }

  // Generate JWT tokens
  const { accessToken, refreshToken } = generateTokenPair(req.user._id.toString());

  // Set refresh token in HTTP-only cookie
  setRefreshTokenCookie(res, refreshToken);

  // Update last login time
  req.user.lastLoginAt = new Date();
  await req.user.save();

  // Redirect to frontend with access token
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${frontendUrl}/callback.html?token=${accessToken}`);
});

/**
 * Get current authenticated user
 * GET /api/auth/me
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new APIError('Not authenticated', 401);
  }

  res.status(200).json({
    success: true,
    user: req.user.toSafeObject(),
  });
});

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
const refreshAccessToken = asyncHandler(async (req, res) => {
  // Get refresh token from cookie or body
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    throw new APIError('Refresh token required', 401);
  }

  // Verify refresh token
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (error) {
    clearRefreshTokenCookie(res);
    throw new APIError(error.message, 401);
  }

  // Get user
  const user = await User.findById(decoded.userId);

  if (!user) {
    clearRefreshTokenCookie(res);
    throw new APIError('User not found', 401);
  }

  // Generate new token pair
  const tokens = generateTokenPair(user._id.toString());

  // Update refresh token cookie
  setRefreshTokenCookie(res, tokens.refreshToken);

  res.status(200).json({
    success: true,
    accessToken: tokens.accessToken,
  });
});

/**
 * Logout user
 * POST /api/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  // Clear refresh token cookie
  clearRefreshTokenCookie(res);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * OAuth failure handler
 * Called if OAuth authentication fails
 */
const oauthFailure = (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${frontendUrl}/callback.html?error=authentication_failed`);
};

module.exports = {
  oauthSuccess,
  getCurrentUser,
  refreshAccessToken,
  logout,
  oauthFailure,
};
