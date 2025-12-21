const { User, Log, Juz, InviteCode, AppSettings } = require('../models');
const { APIError, asyncHandler } = require('../middleware/errorHandler');

/**
 * Admin Controller
 * Handles admin-only operations: user management, stats, invite codes
 */

// ============================================
// DASHBOARD STATS
// ============================================

/**
 * Get admin dashboard statistics
 * GET /api/admin/stats
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalAdmins,
    totalLogs,
    totalPagesMemorized,
    activeUsers,
    newUsersThisWeek,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'admin' }),
    Log.countDocuments(),
    Log.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $size: '$newPages' } },
        },
      },
    ]),
    User.countDocuments({
      lastLoginAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),
    User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),
  ]);

  // Calculate completed Juz across all users
  const completedJuz = await Juz.countDocuments({ status: 'completed' });

  res.status(200).json({
    success: true,
    stats: {
      totalUsers,
      totalAdmins,
      totalLogs,
      totalPagesMemorized: totalPagesMemorized[0]?.total || 0,
      completedJuz,
      activeUsers, // Active in last 7 days
      newUsersThisWeek,
    },
  });
});

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Get all users with pagination and search
 * GET /api/admin/users
 */
const getUsers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search = '',
    role = '',
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  const query = {};

  // Search by name or email
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  // Filter by role
  if (role && ['user', 'admin'].includes(role)) {
    query.role = role;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

  const [users, totalCount] = await Promise.all([
    User.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v'),
    User.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    users: users.map(u => u.toSafeObject()),
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      totalCount,
      hasMore: skip + users.length < totalCount,
    },
  });
});

/**
 * Get single user details with stats
 * GET /api/admin/users/:id
 */
const getUserDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    throw new APIError('User not found', 404);
  }

  // Get user's stats
  const [logs, juz, totalPages] = await Promise.all([
    Log.find({ userId: id })
      .sort({ date: -1 })
      .limit(10)
      .select('-__v'),
    Juz.find({ userId: id }).select('-__v'),
    Log.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: null,
          total: { $sum: { $size: '$newPages' } },
        },
      },
    ]),
  ]);

  const completedJuz = juz.filter(j => j.status === 'completed').length;

  res.status(200).json({
    success: true,
    user: user.toSafeObject(),
    stats: {
      totalLogs: logs.length,
      totalPages: totalPages[0]?.total || 0,
      completedJuz,
      inProgressJuz: juz.filter(j => j.status === 'in-progress').length,
    },
    recentLogs: logs,
  });
});

/**
 * Update user role
 * PATCH /api/admin/users/:id/role
 */
const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['user', 'admin'].includes(role)) {
    throw new APIError('Invalid role. Must be "user" or "admin"', 400);
  }

  const user = await User.findById(id);
  if (!user) {
    throw new APIError('User not found', 404);
  }

  // Prevent removing last admin
  if (user.role === 'admin' && role === 'user') {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) {
      throw new APIError('Cannot remove the last admin', 400);
    }
  }

  user.role = role;
  await user.save();

  res.status(200).json({
    success: true,
    message: `User role updated to ${role}`,
    user: user.toSafeObject(),
  });
});

/**
 * Delete user
 * DELETE /api/admin/users/:id
 */
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    throw new APIError('User not found', 404);
  }

  // Prevent deleting the last admin
  if (user.role === 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) {
      throw new APIError('Cannot delete the last admin', 400);
    }
  }

  // Delete user's data
  await Promise.all([
    User.findByIdAndDelete(id),
    Log.deleteMany({ userId: id }),
    Juz.deleteMany({ userId: id }),
  ]);

  res.status(200).json({
    success: true,
    message: 'User and all associated data deleted successfully',
  });
});

// ============================================
// INVITE CODE MANAGEMENT
// ============================================

/**
 * Get all invite codes
 * GET /api/admin/invite-codes
 */
const getInviteCodes = asyncHandler(async (req, res) => {
  const { active } = req.query;

  const query = {};
  if (active === 'true') {
    query.isActive = true;
    query.$or = [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ];
  } else if (active === 'false') {
    query.$or = [
      { isActive: false },
      { expiresAt: { $lte: new Date() } },
    ];
  }

  const inviteCodes = await InviteCode.find(query)
    .populate('createdBy', 'name email')
    .populate('usedBy.user', 'name email')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    inviteCodes,
  });
});

/**
 * Create new invite code
 * POST /api/admin/invite-codes
 */
const createInviteCode = asyncHandler(async (req, res) => {
  const { maxUses = 1, expiresAt = null, description = null } = req.body;

  const inviteCode = await InviteCode.createInviteCode({
    createdBy: req.user._id,
    maxUses: parseInt(maxUses),
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    description,
  });

  res.status(201).json({
    success: true,
    message: 'Invite code created successfully',
    inviteCode,
  });
});

/**
 * Deactivate invite code
 * PATCH /api/admin/invite-codes/:id/deactivate
 */
const deactivateInviteCode = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const inviteCode = await InviteCode.findById(id);
  if (!inviteCode) {
    throw new APIError('Invite code not found', 404);
  }

  inviteCode.isActive = false;
  await inviteCode.save();

  res.status(200).json({
    success: true,
    message: 'Invite code deactivated',
    inviteCode,
  });
});

/**
 * Delete invite code
 * DELETE /api/admin/invite-codes/:id
 */
const deleteInviteCode = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const inviteCode = await InviteCode.findByIdAndDelete(id);
  if (!inviteCode) {
    throw new APIError('Invite code not found', 404);
  }

  res.status(200).json({
    success: true,
    message: 'Invite code deleted successfully',
  });
});

// ============================================
// APP SETTINGS
// ============================================

/**
 * Get app settings
 * GET /api/admin/settings
 */
const getAppSettings = asyncHandler(async (req, res) => {
  const settings = await AppSettings.getSettings();

  res.status(200).json({
    success: true,
    settings: {
      requireInviteCode: settings.requireInviteCode,
      leaderboardEnabled: settings.leaderboardEnabled,
    },
  });
});

/**
 * Update app settings
 * PATCH /api/admin/settings
 */
const updateAppSettings = asyncHandler(async (req, res) => {
  const { requireInviteCode, leaderboardEnabled } = req.body;

  const updates = {};
  if (typeof requireInviteCode === 'boolean') {
    updates.requireInviteCode = requireInviteCode;
  }
  if (typeof leaderboardEnabled === 'boolean') {
    updates.leaderboardEnabled = leaderboardEnabled;
  }

  const settings = await AppSettings.updateSettings(updates);

  res.status(200).json({
    success: true,
    message: 'App settings updated successfully',
    settings: {
      requireInviteCode: settings.requireInviteCode,
      leaderboardEnabled: settings.leaderboardEnabled,
    },
  });
});

module.exports = {
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
};
