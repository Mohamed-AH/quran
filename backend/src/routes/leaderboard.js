const express = require('express');
const {
  getLeaderboard,
  getMyRank,
  refreshLeaderboard,
} = require('../controllers/leaderboardController');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

const router = express.Router();

/**
 * Leaderboard Routes
 * Public and authenticated endpoints for leaderboard
 */

/**
 * @route   GET /api/leaderboard
 * @desc    Get top users on leaderboard (cached)
 * @access  Public (but requires authentication to see)
 * @query   limit - Number of users to return (default: 25)
 * @query   forceRefresh - Force cache refresh (default: false)
 */
router.get('/', authenticate, getLeaderboard);

/**
 * @route   GET /api/leaderboard/me
 * @desc    Get current user's rank and nearby users
 * @access  Private
 */
router.get('/me', authenticate, getMyRank);

/**
 * @route   POST /api/leaderboard/refresh
 * @desc    Force refresh leaderboard cache (admin only)
 * @access  Admin
 */
router.post('/refresh', authenticate, requireAdmin, refreshLeaderboard);

module.exports = router;
