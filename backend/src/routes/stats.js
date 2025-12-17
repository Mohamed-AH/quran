const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { authenticate } = require('../middleware/auth');
const Juz = require('../models/Juz');
const Log = require('../models/Log');

/**
 * @desc    Get combined statistics (Juz + Log stats)
 * @route   GET /api/stats/combined
 * @access  Private
 */
router.get('/combined', authenticate, asyncHandler(async (req, res) => {
  // Get Juz statistics (primary source for progress)
  const juzStats = await Juz.getProgressSummary(req.userId);

  // Get Log statistics (activity tracking)
  const logStats = await Log.calculateStats(req.userId);

  // Combine both statistics
  const combinedStats = {
    // Juz-based metrics (primary)
    totalPages: juzStats.totalPages, // Pages from Juz tracking (0-600)
    completedJuz: juzStats.completedJuz, // Number of completed Juz
    inProgressJuz: juzStats.inProgressJuz, // Number of in-progress Juz
    notStartedJuz: juzStats.notStartedJuz, // Number of not-started Juz
    juzCompletionPercentage: juzStats.juzCompletionPercentage, // Primary progress metric
    pageProgressPercentage: juzStats.pageProgressPercentage, // Secondary page metric

    // Activity metrics (from daily logs)
    totalLogs: logStats.totalLogs, // Number of log entries
    totalDays: logStats.totalDays, // Unique days with activity
    currentStreak: logStats.currentStreak, // Consecutive days with logs
    avgNewQuality: logStats.avgNewQuality, // Average new memorization quality
    avgReviewQuality: logStats.avgReviewQuality, // Average review quality
  };

  res.status(200).json({
    success: true,
    stats: combinedStats,
  });
}));

module.exports = router;
