const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * InviteCode Schema
 * Used to control signups - admin generates codes for students
 */
const inviteCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    maxUses: {
      type: Number,
      default: 1, // Single-use by default
      min: [1, 'Max uses must be at least 1'],
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    usedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        usedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    expiresAt: {
      type: Date,
      default: null, // null = never expires
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters'],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Instance method: Check if code is valid for use
inviteCodeSchema.methods.isValid = function () {
  // Check if active
  if (!this.isActive) {
    return { valid: false, reason: 'Code is inactive' };
  }

  // Check if expired
  if (this.expiresAt && this.expiresAt < new Date()) {
    return { valid: false, reason: 'Code has expired' };
  }

  // Check if max uses reached
  if (this.usedCount >= this.maxUses) {
    return { valid: false, reason: 'Code has been fully used' };
  }

  return { valid: true };
};

// Instance method: Mark code as used
inviteCodeSchema.methods.markAsUsed = async function (userId) {
  this.usedCount += 1;
  this.usedBy.push({
    user: userId,
    usedAt: new Date(),
  });

  // Deactivate if max uses reached
  if (this.usedCount >= this.maxUses) {
    this.isActive = false;
  }

  await this.save();
};

// Static method: Generate unique code
inviteCodeSchema.statics.generateCode = function (length = 8) {
  return crypto
    .randomBytes(length)
    .toString('hex')
    .toUpperCase()
    .slice(0, length);
};

// Static method: Create new invite code
inviteCodeSchema.statics.createInviteCode = async function ({
  createdBy,
  maxUses = 1,
  expiresAt = null,
  description = null,
}) {
  // Generate unique code
  let code;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    code = this.generateCode();
    const existing = await this.findOne({ code });
    if (!existing) break;
    attempts++;
  }

  if (attempts === maxAttempts) {
    throw new Error('Failed to generate unique invite code');
  }

  // Create invite code
  return await this.create({
    code,
    createdBy,
    maxUses,
    expiresAt,
    description,
  });
};

const InviteCode = mongoose.model('InviteCode', inviteCodeSchema);

module.exports = InviteCode;
