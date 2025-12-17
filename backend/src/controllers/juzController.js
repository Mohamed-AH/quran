const asyncHandler = require('express-async-handler');
const Juz = require('../models/Juz');
const APIError = require('../utils/errors');

/**
 * @desc    Get all 30 Juz for current user
 * @route   GET /api/juz
 * @access  Private
 */
const getAllJuz = asyncHandler(async (req, res) => {
  const juzList = await Juz.find({ userId: req.userId }).sort({ juzNumber: 1 });

  if (juzList.length === 0) {
    await Juz.initializeForUser(req.userId);
    const newJuzList = await Juz.find({ userId: req.userId }).sort({ juzNumber: 1 });
    return res.status(200).json({
      success: true,
      count: newJuzList.length,
      juz: newJuzList
    });
  }

  res.status(200).json({
    success: true,
    count: juzList.length,
    juz: juzList
  });
});

/**
 * @desc    Get a single Juz by number
 * @route   GET /api/juz/:juzNumber
 * @access  Private
 */
const getJuzByNumber = asyncHandler(async (req, res) => {
  const juzNumber = parseInt(req.params.juzNumber);

  const juz = await Juz.findOne({
    userId: req.userId,
    juzNumber
  });

  if (!juz) {
    throw new APIError('Juz not found', 404);
  }

  res.status(200).json({
    success: true,
    juz
  });
});

/**
 * @desc    Update a Juz entry
 * @route   PUT /api/juz/:juzNumber
 * @access  Private
 */
const updateJuz = asyncHandler(async (req, res) => {
  const juzNumber = parseInt(req.params.juzNumber);

  const juz = await Juz.findOne({
    userId: req.userId,
    juzNumber
  });

  if (!juz) {
    throw new APIError('Juz not found', 404);
  }

  const { status, pages, startDate, endDate, notes } = req.body;

  if (status !== undefined) juz.status = status;
  if (pages !== undefined) juz.pages = pages;

  // Handle dates gracefully - only set if provided and not empty
  if (startDate !== undefined) {
    juz.startDate = startDate || null;
  }
  if (endDate !== undefined) {
    juz.endDate = endDate || null;
  }

  if (notes !== undefined) juz.notes = notes;

  await juz.save();

  res.status(200).json({
    success: true,
    message: 'Juz updated successfully',
    juz
  });
});

/**
 * @desc    Get Juz summary (counts by status)
 * @route   GET /api/juz/summary
 * @access  Private
 */
const getJuzSummary = asyncHandler(async (req, res) => {
  const juzList = await Juz.find({ userId: req.userId });

  if (juzList.length === 0) {
    await Juz.initializeForUser(req.userId);
    return res.status(200).json({
      success: true,
      summary: {
        total: 30,
        notStarted: 30,
        inProgress: 0,
        completed: 0,
        totalPages: 0,
        completionPercentage: 0
      }
    });
  }

  const summary = {
    total: juzList.length,
    notStarted: juzList.filter(j => j.status === 'not-started').length,
    inProgress: juzList.filter(j => j.status === 'in-progress').length,
    completed: juzList.filter(j => j.status === 'completed').length,
    totalPages: juzList.reduce((sum, j) => sum + j.pages, 0),
    completionPercentage: Math.round(
      (juzList.filter(j => j.status === 'completed').length / 30) * 100
    )
  };

  res.status(200).json({
    success: true,
    summary
  });
});

module.exports = {
  getAllJuz,
  getJuzByNumber,
  updateJuz,
  getJuzSummary
};
