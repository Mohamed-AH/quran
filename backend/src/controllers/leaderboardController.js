const { User, Log, Juz } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Leaderboard Controller
 * Handles leaderboard rankings with caching
 */

// Simple in-memory cache
let leaderboardCache = {
  data: null,
  lastUpdated: null,
  CACHE_DURATION: 60 * 60 * 1000, // 1 hour in milliseconds
};

/**
 * Calculate user rankings
 * This is expensive, so we cache the results
 */
async function calculateLeaderboard() {
  // Get all users who opted into leaderboard
  const users = await User.find({
    'settings.showOnLeaderboard': true,
  }).select('_id name settings.leaderboardDisplayName profilePicture createdAt');

  // Calculate stats for each user
  const leaderboardData = await Promise.all(
    users.map(async (user) => {
      const [totalPagesResult, juzData, logsData] = await Promise.all([
        // Total pages memorized
        Log.aggregate([
          { $match: { userId: user._id } },
          {
            $group: {
              _id: null,
              total: { $sum: { $size: '$newPages' } },
            },
          },
        ]),
        // Juz completed
        Juz.find({ userId: user._id, status: 'completed' }),
        // Get logs for streak calculation
        Log.find({ userId: user._id }).sort({ date: -1 }).select('date'),
      ]);

      const totalPages = totalPagesResult[0]?.total || 0;
      const completedJuz = juzData.length;

      // Calculate current streak
      let streak = 0;
      if (logsData.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let currentDate = new Date(today);

        for (const log of logsData) {
          const logDate = new Date(log.date);
          logDate.setHours(0, 0, 0, 0);

          if (logDate.getTime() === currentDate.getTime()) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
          } else if (logDate.getTime() < currentDate.getTime()) {
            break;
          }
        }
      }

      return {
        userId: user._id,
        name: user.settings.leaderboardDisplayName || user.name,
        profilePicture: user.profilePicture,
        totalPages,
        completedJuz,
        streak,
        joinedAt: user.createdAt,
      };
    })
  );

  // Sort by total pages (descending)
  leaderboardData.sort((a, b) => {
    if (b.totalPages !== a.totalPages) {
      return b.totalPages - a.totalPages;
    }
    // Tie-breaker: completed Juz
    if (b.completedJuz !== a.completedJuz) {
      return b.completedJuz - a.completedJuz;
    }
    // Tie-breaker: streak
    return b.streak - a.streak;
  });

  // Add ranks
  leaderboardData.forEach((user, index) => {
    user.rank = index + 1;
  });

  return leaderboardData;
}

/**
 * Get leaderboard (cached)
 * GET /api/leaderboard
 */
const getLeaderboard = asyncHandler(async (req, res) => {
  const { limit = 25, forceRefresh = false } = req.query;

  // Check if cache is valid
  const now = Date.now();
  const cacheValid =
    leaderboardCache.data &&
    leaderboardCache.lastUpdated &&
    now - leaderboardCache.lastUpdated < leaderboardCache.CACHE_DURATION;

  // Use cache if valid and not forcing refresh
  if (cacheValid && forceRefresh !== 'true') {
    const limitedData = leaderboardCache.data.slice(0, parseInt(limit));
    return res.status(200).json({
      success: true,
      leaderboard: limitedData,
      totalUsers: leaderboardCache.data.length,
      cached: true,
      lastUpdated: new Date(leaderboardCache.lastUpdated).toISOString(),
    });
  }

  // Calculate fresh leaderboard
  const leaderboardData = await calculateLeaderboard();

  // Update cache
  leaderboardCache.data = leaderboardData;
  leaderboardCache.lastUpdated = now;

  const limitedData = leaderboardData.slice(0, parseInt(limit));

  res.status(200).json({
    success: true,
    leaderboard: limitedData,
    totalUsers: leaderboardData.length,
    cached: false,
    lastUpdated: new Date(now).toISOString(),
  });
});

/**
 * Get current user's rank and nearby users
 * GET /api/leaderboard/me
 */
const getMyRank = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Check cache, refresh if needed
  const now = Date.now();
  const cacheValid =
    leaderboardCache.data &&
    leaderboardCache.lastUpdated &&
    now - leaderboardCache.lastUpdated < leaderboardCache.CACHE_DURATION;

  let leaderboardData;
  if (cacheValid) {
    leaderboardData = leaderboardCache.data;
  } else {
    leaderboardData = await calculateLeaderboard();
    leaderboardCache.data = leaderboardData;
    leaderboardCache.lastUpdated = now;
  }

  // Find current user in leaderboard
  const userIndex = leaderboardData.findIndex(
    (u) => u.userId.toString() === userId.toString()
  );

  if (userIndex === -1) {
    // User not on leaderboard (opted out or no activity)
    return res.status(200).json({
      success: true,
      onLeaderboard: false,
      message: 'You are not on the leaderboard. Enable it in settings or start memorizing!',
    });
  }

  const currentUser = leaderboardData[userIndex];

  // Get nearby users (3 above, 3 below)
  const start = Math.max(0, userIndex - 3);
  const end = Math.min(leaderboardData.length, userIndex + 4);
  const nearbyUsers = leaderboardData.slice(start, end);

  res.status(200).json({
    success: true,
    onLeaderboard: true,
    rank: currentUser.rank,
    totalUsers: leaderboardData.length,
    stats: {
      totalPages: currentUser.totalPages,
      completedJuz: currentUser.completedJuz,
      streak: currentUser.streak,
    },
    nearbyUsers,
  });
});

/**
 * Refresh leaderboard cache (admin only)
 * POST /api/admin/leaderboard/refresh
 */
const refreshLeaderboard = asyncHandler(async (req, res) => {
  const leaderboardData = await calculateLeaderboard();

  leaderboardCache.data = leaderboardData;
  leaderboardCache.lastUpdated = Date.now();

  res.status(200).json({
    success: true,
    message: 'Leaderboard cache refreshed',
    totalUsers: leaderboardData.length,
    lastUpdated: new Date(leaderboardCache.lastUpdated).toISOString(),
  });
});

module.exports = {
  getLeaderboard,
  getMyRank,
  refreshLeaderboard,
};
