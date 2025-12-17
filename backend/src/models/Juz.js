const mongoose = require('mongoose');

/**
 * Juz Schema
 * Stores progress tracking for each of the 30 Juz of the Quran
 */
const juzSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    juzNumber: {
      type: Number,
      required: [true, 'Juz number is required'],
      min: [1, 'Juz number must be between 1 and 30'],
      max: [30, 'Juz number must be between 1 and 30'],
      index: true,
    },
    status: {
      type: String,
      enum: ['not-started', 'in-progress', 'completed'],
      default: 'not-started',
    },
    pages: {
      type: Number,
      min: [0, 'Pages must be between 0 and 20'],
      max: [20, 'Pages must be between 0 and 20'],
      default: 0,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Compound index: userId + juzNumber (ensures one record per user per juz)
juzSchema.index({ userId: 1, juzNumber: 1 }, { unique: true });

// Pre-save hook: Auto-sync status and pages bidirectionally
juzSchema.pre('save', function (next) {
  const statusWasModified = this.isModified('status');
  const pagesWereModified = this.isModified('pages');

  // If status is explicitly changed, update pages accordingly (takes priority)
  if (statusWasModified) {
    if (this.status === 'completed') {
      this.pages = 20; // Completed = full Juz
      if (!this.endDate) {
        this.endDate = new Date();
      }
    } else if (this.status === 'not-started') {
      this.pages = 0; // Not started = 0 pages
      this.startDate = null;
      this.endDate = null;
    }
    // For 'in-progress', keep current pages value (1-19)
  }
  // If ONLY pages are changed (not status), update status accordingly
  else if (pagesWereModified) {
    if (this.pages === 0) {
      this.status = 'not-started';
      this.startDate = null;
      this.endDate = null;
    } else if (this.pages >= 20) {
      this.status = 'completed';
      this.pages = 20; // Cap at 20
      if (!this.endDate) {
        this.endDate = new Date();
      }
    } else {
      this.status = 'in-progress';
      if (!this.startDate) {
        this.startDate = new Date();
      }
    }
  }

  next();
});

// Pre-save hook: Validate dates
juzSchema.pre('save', function (next) {
  if (this.startDate && this.endDate) {
    if (this.endDate < this.startDate) {
      return next(new Error('End date cannot be before start date'));
    }
  }
  next();
});

// Static method: Initialize all 30 Juz for a new user
juzSchema.statics.initializeForUser = async function (userId) {
  const juzData = [];
  for (let i = 1; i <= 30; i++) {
    juzData.push({
      userId,
      juzNumber: i,
      status: 'not-started',
      pages: 0,
    });
  }

  try {
    await this.insertMany(juzData);
  } catch (error) {
    // If already exist, ignore (duplicate key error)
    if (error.code !== 11000) {
      throw error;
    }
  }
};

// Static method: Get user's progress summary
juzSchema.statics.getProgressSummary = async function (userId) {
  const juzList = await this.find({ userId }).sort({ juzNumber: 1 }).lean();

  if (juzList.length === 0) {
    return {
      totalPages: 0,
      completedJuz: 0,
      inProgressJuz: 0,
      notStartedJuz: 30,
      pageProgressPercentage: 0,
      juzCompletionPercentage: 0,
    };
  }

  // Use a Map to ensure only one record per juzNumber (in case of duplicates)
  const juzMap = new Map();
  juzList.forEach((juz) => {
    // Keep the most recently updated record if duplicates exist
    if (!juzMap.has(juz.juzNumber) ||
        new Date(juz.updatedAt) > new Date(juzMap.get(juz.juzNumber).updatedAt)) {
      juzMap.set(juz.juzNumber, juz);
    }
  });

  let totalPages = 0;
  let completedJuz = 0;
  let inProgressJuz = 0;
  let notStartedJuz = 0;

  // Calculate from unique Juz records only
  juzMap.forEach((juz) => {
    totalPages += juz.pages;
    if (juz.status === 'completed') completedJuz++;
    else if (juz.status === 'in-progress') inProgressJuz++;
    else notStartedJuz++;
  });

  // Account for any missing Juz numbers (should be 30 total)
  notStartedJuz = 30 - completedJuz - inProgressJuz;

  // Total pages from Juz tracking: 30 Juz × 20 pages = 600
  const TOTAL_JUZ_PAGES = 600;
  const pageProgressPercentage = ((totalPages / TOTAL_JUZ_PAGES) * 100).toFixed(1);

  // Juz completion percentage (primary metric)
  const juzCompletionPercentage = ((completedJuz / 30) * 100).toFixed(1);

  return {
    totalPages,
    completedJuz,
    inProgressJuz,
    notStartedJuz,
    pageProgressPercentage: parseFloat(pageProgressPercentage),
    juzCompletionPercentage: parseFloat(juzCompletionPercentage),
  };
};

// Static method: Get specific Juz for user
juzSchema.statics.getUserJuz = async function (userId, juzNumber) {
  return await this.findOne({ userId, juzNumber });
};

// Static method: Update Juz for user
juzSchema.statics.updateUserJuz = async function (userId, juzNumber, updateData) {
  // Validate juzNumber
  if (juzNumber < 1 || juzNumber > 30) {
    throw new Error('Invalid Juz number. Must be between 1 and 30.');
  }

  // Clamp pages to 0-20
  if (updateData.pages !== undefined) {
    updateData.pages = Math.max(0, Math.min(20, updateData.pages));
  }

  return await this.findOneAndUpdate(
    { userId, juzNumber },
    updateData,
    { new: true, runValidators: true }
  );
};

const Juz = mongoose.model('Juz', juzSchema);

module.exports = Juz;
