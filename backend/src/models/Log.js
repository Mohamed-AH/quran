const mongoose = require('mongoose');

/**
 * Log Schema
 * Stores daily memorization and review entries for each user
 */
const logSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      index: true,
    },
    newPages: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'New pages cannot exceed 100 characters'],
      validate: {
        validator: function (v) {
          // Allow empty or valid page format: "1-3", "5", "1-3, 5-7"
          if (!v) return true;
          return /^[\d\s,\-]*$/.test(v);
        },
        message: 'Invalid page format. Use numbers, commas, spaces, and hyphens only (e.g., "1-3, 5")',
      },
    },
    newRating: {
      type: Number,
      min: [0, 'Rating must be between 0 and 5'],
      max: [5, 'Rating must be between 0 and 5'],
      default: 0,
    },
    reviewPages: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Review pages cannot exceed 100 characters'],
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^[\d\s,\-]*$/.test(v);
        },
        message: 'Invalid page format. Use numbers, commas, spaces, and hyphens only (e.g., "10-15")',
      },
    },
    reviewRating: {
      type: Number,
      min: [0, 'Rating must be between 0 and 5'],
      max: [5, 'Rating must be between 0 and 5'],
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Compound index for efficient querying of user's logs by date
logSchema.index({ userId: 1, date: -1 });

// Pre-save hook: Normalize date to midnight UTC (prevent timezone issues)
logSchema.pre('save', function (next) {
  if (this.isModified('date')) {
    const d = new Date(this.date);
    d.setUTCHours(0, 0, 0, 0);
    this.date = d;
  }
  next();
});

// Validation: At least one field must be filled
logSchema.pre('save', function (next) {
  if (!this.newPages && !this.reviewPages) {
    return next(new Error('At least one of newPages or reviewPages must be provided'));
  }
  next();
});

// Instance method: Check if log is for today
logSchema.methods.isToday = function () {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const logDate = new Date(this.date);
  logDate.setUTCHours(0, 0, 0, 0);
  return today.getTime() === logDate.getTime();
};

// Static method: Get user's logs with pagination
logSchema.statics.getUserLogs = async function (userId, options = {}) {
  const { limit = 50, offset = 0, startDate, endDate } = options;

  const query = { userId };

  // Date range filter
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  const logs = await this.find(query)
    .sort({ date: -1 }) // Newest first
    .skip(offset)
    .limit(limit)
    .lean();

  const total = await this.countDocuments(query);

  return {
    logs,
    total,
    limit,
    offset,
    hasMore: offset + logs.length < total,
  };
};

// Static method: Calculate user statistics
logSchema.statics.calculateStats = async function (userId) {
  const logs = await this.find({ userId }).lean();

  if (logs.length === 0) {
    return {
      totalLogs: 0,
      totalDays: 0,
      totalPages: 0,
      avgNewQuality: 0,
      avgReviewQuality: 0,
      currentStreak: 0,
    };
  }

  // Calculate averages and total pages
  let newRatingSum = 0;
  let newRatingCount = 0;
  let reviewRatingSum = 0;
  let reviewRatingCount = 0;
  const allPages = new Set(); // Track unique pages

  logs.forEach((log) => {
    // Calculate ratings
    if (log.newRating > 0) {
      newRatingSum += log.newRating;
      newRatingCount++;
    }
    if (log.reviewRating > 0) {
      reviewRatingSum += log.reviewRating;
      reviewRatingCount++;
    }

    // Extract unique pages from newPages
    if (log.newPages) {
      const pages = parsePages(log.newPages);
      pages.forEach(p => allPages.add(p));
    }
  });

  // Get unique days (multiple logs per day count as 1 day)
  const uniqueDates = new Set(
    logs.map(log => {
      const d = new Date(log.date);
      d.setUTCHours(0, 0, 0, 0);
      return d.getTime();
    })
  );

  // Calculate streak (count consecutive unique days)
  const sortedDates = Array.from(uniqueDates).sort((a, b) => b - a);
  let streak = 0;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < sortedDates.length; i++) {
    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - streak);
    expectedDate.setUTCHours(0, 0, 0, 0);

    if (sortedDates[i] === expectedDate.getTime()) {
      streak++;
    } else {
      break;
    }
  }

  return {
    totalLogs: logs.length,
    totalDays: uniqueDates.size,
    totalPages: allPages.size,
    avgNewQuality: newRatingCount > 0 ? (newRatingSum / newRatingCount).toFixed(1) : 0,
    avgReviewQuality: reviewRatingCount > 0 ? (reviewRatingSum / reviewRatingCount).toFixed(1) : 0,
    currentStreak: streak,
  };
};

// Helper function to parse page ranges
function parsePages(pageStr) {
  const pages = new Set();
  if (!pageStr) return pages;

  const parts = pageStr.split(',').map(s => s.trim());
  parts.forEach(part => {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(n => parseInt(n.trim()));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          pages.add(i);
        }
      }
    } else {
      const page = parseInt(part.trim());
      if (!isNaN(page)) pages.add(page);
    }
  });
  return pages;
}

const Log = mongoose.model('Log', logSchema);

module.exports = Log;
