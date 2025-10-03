const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { login, verify, changePassword } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// rutas públicas
router.post('/login', login);
router.get('/verify', authenticateToken, verify);

// rutas protegidas
router.post('/change-password', 
    [
        authenticateToken,
        body('newPassword', 'La nueva contraseña debe tener al menos 8 caracteres').isLength({ min: 8 }),
        body('currentPassword', 'La contraseña no puede estar vacía').notEmpty(),
    ],
    changePassword
);

module.exports = router;