const asyncHandler = require('express-async-handler');
const Log = require('../models/Log');
const APIError = require('../utils/errors');

/**
 * @desc    Create a new log entry
 * @route   POST /api/logs
 * @access  Private
 */
const createLog = asyncHandler(async (req, res) => {
  const { date, newPages, newRating, reviewPages, reviewRating, notes } = req.body;

  const logData = {
    userId: req.userId,
    date: date || new Date(),
    newPages: newPages || '',
    newRating: newRating || 0,
    reviewPages: reviewPages || '',
    reviewRating: reviewRating || 0,
    notes: notes || ''
  };

  const log = await Log.create(logData);

  res.status(201).json({
    success: true,
    message: 'Log created successfully',
    log
  });
});

/**
 * @desc    Get all logs for current user with pagination
 * @route   GET /api/logs
 * @access  Private
 */
const getLogs = asyncHandler(async (req, res) => {
  const { limit = 50, offset = 0, startDate, endDate } = req.query;

  const options = {
    limit: parseInt(limit),
    offset: parseInt(offset)
  };

  if (startDate) options.startDate = new Date(startDate);
  if (endDate) options.endDate = new Date(endDate);

  const result = await Log.getUserLogs(req.userId, options);

  res.status(200).json({
    success: true,
    ...result
  });
});

/**
 * @desc    Get a single log by ID
 * @route   GET /api/logs/:id
 * @access  Private
 */
const getLogById = asyncHandler(async (req, res) => {
  const log = await Log.findOne({
    _id: req.params.id,
    userId: req.userId
  });

  if (!log) {
    throw new APIError('Log not found', 404);
  }

  res.status(200).json({
    success: true,
    log
  });
});

/**
 * @desc    Update a log entry
 * @route   PUT /api/logs/:id
 * @access  Private
 */
const updateLog = asyncHandler(async (req, res) => {
  const log = await Log.findOne({
    _id: req.params.id,
    userId: req.userId
  });

  if (!log) {
    throw new APIError('Log not found', 404);
  }

  const { newPages, newRating, reviewPages, reviewRating, notes } = req.body;

  if (newPages !== undefined) log.newPages = newPages;
  if (newRating !== undefined) log.newRating = newRating;
  if (reviewPages !== undefined) log.reviewPages = reviewPages;
  if (reviewRating !== undefined) log.reviewRating = reviewRating;
  if (notes !== undefined) log.notes = notes;

  await log.save();

  res.status(200).json({
    success: true,
    message: 'Log updated successfully',
    log
  });
});

/**
 * @desc    Delete a log entry
 * @route   DELETE /api/logs/:id
 * @access  Private
 */
const deleteLog = asyncHandler(async (req, res) => {
  const log = await Log.findOne({
    _id: req.params.id,
    userId: req.userId
  });

  if (!log) {
    throw new APIError('Log not found', 404);
  }

  await log.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Log deleted successfully'
  });
});

/**
 * @desc    Get user statistics (streaks, averages, total logs)
 * @route   GET /api/logs/stats
 * @access  Private
 */
const getStats = asyncHandler(async (req, res) => {
  const stats = await Log.calculateStats(req.userId);

  res.status(200).json({
    success: true,
    stats
  });
});

module.exports = {
  createLog,
  getLogs,
  getLogById,
  updateLog,
  deleteLog,
  getStats
};
