const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const userController = require('../controllers/userController');

// todas las rutas requieren autenticacion
router.use(authenticateToken);

// rutas publicas para usuarios (propias)
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.get('/:id/medidores', userController.getUserMedidores);

// rutas de admin
router.get('/', requireRole(['admin']), userController.getUsers);
router.post('/', requireRole(['admin']), userController.createUser);
router.delete('/:id', requireRole(['admin']), userController.deleteUser);

module.exports = router;
