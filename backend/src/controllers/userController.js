const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Log = require('../models/Log');
const Juz = require('../models/Juz');
const APIError = require('../utils/errors');

/**
 * @desc    Get current user profile
 * @route   GET /api/user
 * @access  Private
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);

  if (!user) {
    throw new APIError('User not found', 404);
  }

  res.status(200).json({
    success: true,
    user: user.toSafeObject()
  });
});

/**
 * @desc    Update user profile
 * @route   PUT /api/user
 * @access  Private
 */
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);

  if (!user) {
    throw new APIError('User not found', 404);
  }

  const { name, language, theme } = req.body;

  if (name !== undefined) user.name = name;
  if (language !== undefined) user.settings.language = language;
  if (theme !== undefined) user.settings.theme = theme;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'User profile updated successfully',
    user: user.toSafeObject()
  });
});

/**
 * @desc    Delete user account and all associated data
 * @route   DELETE /api/user
 * @access  Private
 */
const deleteUser = asyncHandler(async (req, res) => {
  const userId = req.userId;

  await Promise.all([
    Log.deleteMany({ userId }),
    Juz.deleteMany({ userId }),
    User.findByIdAndDelete(userId)
  ]);

  res.status(200).json({
    success: true,
    message: 'User account and all associated data deleted successfully'
  });
});

module.exports = {
  getCurrentUser,
  updateUser,
  deleteUser
};
