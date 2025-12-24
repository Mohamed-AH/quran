const express = require('express');
const passport = require('../config/passport');
const {
  oauthSuccess,
  getCurrentUser,
  refreshAccessToken,
  logout,
  oauthFailure,
  getPublicSettings,
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
  (req, res, next) => {
    // Pass invite code through OAuth state
    const state = req.query.inviteCode
      ? JSON.stringify({ inviteCode: req.query.inviteCode })
      : undefined;

    passport.authenticate('google', {
      scope: ['profile', 'email'],
      session: false,
      state,
    })(req, res, next);
  }
);

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth callback
 * @access  Public
 */
router.get(
  '/google/callback',
  (req, res, next) => {
    passport.authenticate('google', {
      session: false,
      failureRedirect: '/api/auth/failure',
    }, (err, user, info) => {
      if (err || !user) {
        // Handle authentication errors gracefully
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const errorMsg = err?.message || info?.message || 'Authentication failed';
        return res.redirect(`${frontendUrl}/callback.html?error=${encodeURIComponent(errorMsg)}`);
      }

      // Authentication successful, attach user to request
      req.user = user;
      next();
    })(req, res, next);
  },
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
  (req, res, next) => {
    // Pass invite code through OAuth state
    const state = req.query.inviteCode
      ? JSON.stringify({ inviteCode: req.query.inviteCode })
      : undefined;

    passport.authenticate('github', {
      scope: ['user:email'],
      session: false,
      state,
    })(req, res, next);
  }
);

/**
 * @route   GET /api/auth/github/callback
 * @desc    GitHub OAuth callback
 * @access  Public
 */
router.get(
  '/github/callback',
  (req, res, next) => {
    passport.authenticate('github', {
      session: false,
      failureRedirect: '/api/auth/failure',
    }, (err, user, info) => {
      if (err || !user) {
        // Handle authentication errors gracefully
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const errorMsg = err?.message || info?.message || 'Authentication failed';
        return res.redirect(`${frontendUrl}/callback.html?error=${encodeURIComponent(errorMsg)}`);
      }

      // Authentication successful, attach user to request
      req.user = user;
      next();
    })(req, res, next);
  },
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

// ============================================
// PUBLIC SETTINGS
// ============================================

/**
 * @route   GET /api/auth/settings
 * @desc    Get public app settings (for login page)
 * @access  Public
 */
router.get('/settings', getPublicSettings);

module.exports = router;
