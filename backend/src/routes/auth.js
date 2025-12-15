const express = require('express');
const passport = require('../config/passport');
const {
  oauthSuccess,
  getCurrentUser,
  refreshAccessToken,
  logout,
  oauthFailure,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * Authentication Routes
 * Handles OAuth authentication, token refresh, and logout
 */

// ============================================
// GOOGLE OAUTH
// ============================================

/**
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth flow
 * @access  Public
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth callback
 * @access  Public
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/api/auth/failure',
  }),
  oauthSuccess
);

// ============================================
// GITHUB OAUTH
// ============================================

/**
 * @route   GET /api/auth/github
 * @desc    Initiate GitHub OAuth flow
 * @access  Public
 */
router.get(
  '/github',
  passport.authenticate('github', {
    scope: ['user:email'],
    session: false,
  })
);

/**
 * @route   GET /api/auth/github/callback
 * @desc    GitHub OAuth callback
 * @access  Public
 */
router.get(
  '/github/callback',
  passport.authenticate('github', {
    session: false,
    failureRedirect: '/api/auth/failure',
  }),
  oauthSuccess
);

// ============================================
// TOKEN MANAGEMENT
// ============================================

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public (requires refresh token)
 */
router.post('/refresh', refreshAccessToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (clear refresh token cookie)
 * @access  Public
 */
router.post('/logout', logout);

// ============================================
// USER INFO
// ============================================

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get('/me', authenticate, getCurrentUser);

// ============================================
// OAUTH FAILURE
// ============================================

/**
 * @route   GET /api/auth/failure
 * @desc    OAuth authentication failure handler
 * @access  Public
 */
router.get('/failure', oauthFailure);

module.exports = router;
