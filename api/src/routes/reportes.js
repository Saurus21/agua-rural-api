const express = require('express');
const router = express.Router();
const reporteController = require('../controllers/reporteController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', reporteController.getReportes);
router.post('/consumo', reporteController.generarReporteConsumo);
router.post('/alertas', reporteController.generarReporteAlertas);

module.exports = router;