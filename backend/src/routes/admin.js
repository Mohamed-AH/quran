const express = require('express');
const {
  getDashboardStats,
  getUsers,
  getUserDetails,
  updateUserRole,
  deleteUser,
  getInviteCodes,
  createInviteCode,
  deactivateInviteCode,
  deleteInviteCode,
  getAppSettings,
  updateAppSettings,
} = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

const router = express.Router();

/**
 * Admin Routes
 * All routes require authentication + admin role
 * Protected by authenticate (checks JWT) + requireAdmin (checks role)
 */

// Apply authentication and admin check to all routes
router.use(authenticate);
router.use(requireAdmin);

// ============================================
// DASHBOARD
// ============================================

/**
 * @route   GET /api/admin/stats
 * @desc    Get dashboard statistics
 * @access  Admin
 */
router.get('/stats', getDashboardStats);

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with pagination/search/filter
 * @access  Admin
 */
router.get('/users', getUsers);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get single user details with stats
 * @access  Admin
 */
router.get('/users/:id', getUserDetails);

/**
 * @route   PATCH /api/admin/users/:id/role
 * @desc    Update user role (user <-> admin)
 * @access  Admin
 */
router.patch('/users/:id/role', updateUserRole);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete user and all associated data
 * @access  Admin
 */
router.delete('/users/:id', deleteUser);

// ============================================
// INVITE CODE MANAGEMENT
// ============================================

/**
 * @route   GET /api/admin/invite-codes
 * @desc    Get all invite codes
 * @access  Admin
 */
router.get('/invite-codes', getInviteCodes);

/**
 * @route   POST /api/admin/invite-codes
 * @desc    Create new invite code
 * @access  Admin
 */
router.post('/invite-codes', createInviteCode);

/**
 * @route   PATCH /api/admin/invite-codes/:id/deactivate
 * @desc    Deactivate invite code
 * @access  Admin
 */
router.patch('/invite-codes/:id/deactivate', deactivateInviteCode);

/**
 * @route   DELETE /api/admin/invite-codes/:id
 * @desc    Delete invite code
 * @access  Admin
 */
router.delete('/invite-codes/:id', deleteInviteCode);

// ============================================
// APP SETTINGS
// ============================================

/**
 * @route   GET /api/admin/settings
 * @desc    Get app settings (signup control, leaderboard toggle)
 * @access  Admin
 */
router.get('/settings', getAppSettings);

/**
 * @route   PATCH /api/admin/settings
 * @desc    Update app settings
 * @access  Admin
 */
router.patch('/settings', updateAppSettings);

module.exports = router;
