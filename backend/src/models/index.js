/**
 * Models Index
 * Central export for all Mongoose models
 */

const User = require('./User');
const Log = require('./Log');
const Juz = require('./Juz');
const InviteCode = require('./InviteCode');
const AppSettings = require('./AppSettings');

module.exports = {
  User,
  Log,
  Juz,
  InviteCode,
  AppSettings,
};
