const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../utils/validation');
const { updateUserSchema } = require('../utils/validation');
const { getCurrentUser, updateUser, deleteUser } = require('../controllers/userController');

router.get('/', authenticate, getCurrentUser);

router.put('/', authenticate, validateBody(updateUserSchema), updateUser);

router.delete('/', authenticate, deleteUser);

module.exports = router;
