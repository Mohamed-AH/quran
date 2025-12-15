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

// Compound index: userId + date (ensures one log per user per day)
logSchema.index({ userId: 1, date: 1 }, { unique: true });

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
      totalDays: 0,
      avgNewQuality: 0,
      avgReviewQuality: 0,
      currentStreak: 0,
    };
  }

  // Calculate averages
  let newRatingSum = 0;
  let newRatingCount = 0;
  let reviewRatingSum = 0;
  let reviewRatingCount = 0;

  logs.forEach((log) => {
    if (log.newRating > 0) {
      newRatingSum += log.newRating;
      newRatingCount++;
    }
    if (log.reviewRating > 0) {
      reviewRatingSum += log.reviewRating;
      reviewRatingCount++;
    }
  });

  // Calculate streak
  const sortedLogs = logs.sort((a, b) => b.date - a.date);
  let streak = 0;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < sortedLogs.length; i++) {
    const logDate = new Date(sortedLogs[i].date);
    logDate.setUTCHours(0, 0, 0, 0);
    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - streak);
    expectedDate.setUTCHours(0, 0, 0, 0);

    if (logDate.getTime() === expectedDate.getTime()) {
      streak++;
    } else {
      break;
    }
  }

  return {
    totalDays: logs.length,
    avgNewQuality: newRatingCount > 0 ? (newRatingSum / newRatingCount).toFixed(1) : 0,
    avgReviewQuality: reviewRatingCount > 0 ? (reviewRatingSum / reviewRatingCount).toFixed(1) : 0,
    currentStreak: streak,
  };
};

const Log = mongoose.model('Log', logSchema);

module.exports = Log;
