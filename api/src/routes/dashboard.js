const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/estadisticas', dashboardController.getEstadisticas);
router.get('/consumo-por-zona', dashboardController.getConsumoPorZona);
router.get('/resumen', dashboardController.getResumen);

module.exports = router;