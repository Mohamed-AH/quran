const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validateBody, validateQuery } = require('../utils/validation');
const {
  createLogSchema,
  updateLogSchema,
  getLogsQuerySchema
} = require('../utils/validation');
const {
  createLog,
  getLogs,
  getLogById,
  updateLog,
  deleteLog,
  getStats
} = require('../controllers/logsController');

router.get('/stats', authenticate, getStats);

router.get('/', authenticate, validateQuery(getLogsQuerySchema), getLogs);

router.post('/', authenticate, validateBody(createLogSchema), createLog);

router.get('/:id', authenticate, getLogById);

router.put('/:id', authenticate, validateBody(updateLogSchema), updateLog);

router.delete('/:id', authenticate, deleteLog);

module.exports = router;
