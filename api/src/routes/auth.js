const express = require('express');
const router = express.Router();
const { login, verify, changePassword } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// rutas públicas
router.post('/login', login);
router.get('/verify', authenticateToken, verify);

// rutas protegidas
router.post('/change-password', authenticateToken, changePassword);

module.exports = router;