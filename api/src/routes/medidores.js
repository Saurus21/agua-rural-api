const express = require('express');
const router = express.Router();
const medidorController = require('../controllers/medidorController');
const { authenticateToken } = require('../middleware/auth');

// todas las rutas requieren autenticacion
router.use(authenticateToken);

router.get('/', medidorController.getMedidores);
router.get('/:id', medidorController.getMedidorById);
router.post('/', medidorController.createMedidor);
router.put('/:id', medidorController.updateMedidor);
router.delete('/:id', medidorController.deleteMedidor);
router.get('/:id/lecturas', medidorController.getMedidorLecturas);

module.exports = router;
