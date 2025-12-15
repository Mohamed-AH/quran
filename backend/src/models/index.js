/**
 * Models Index
 * Central export for all Mongoose models
 */

const User = require('./User');
const Log = require('./Log');
const Juz = require('./Juz');

module.exports = {
  User,
  Log,
  Juz,
};
