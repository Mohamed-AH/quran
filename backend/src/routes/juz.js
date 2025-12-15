const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validateBody, validateParams } = require('../utils/validation');
const { updateJuzSchema, juzNumberSchema } = require('../utils/validation');
const {
  getAllJuz,
  getJuzByNumber,
  updateJuz,
  getJuzSummary
} = require('../controllers/juzController');

router.get('/summary', authenticate, getJuzSummary);

router.get('/', authenticate, getAllJuz);

router.get('/:juzNumber', authenticate, validateParams(juzNumberSchema), getJuzByNumber);

router.put('/:juzNumber', authenticate, validateParams(juzNumberSchema), validateBody(updateJuzSchema), updateJuz);

module.exports = router;
