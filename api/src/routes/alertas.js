const express = require('express');
const router = express.Router();
const alertaController = require('../controllers/alertaController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', alertaController.getAlertas);
router.get('/estadisticas', alertaController.getEstadisticasAlertas);
router.get('/pendientes', alertaController.getAlertasPendientes);
router.get('/:id', alertaController.getAlertaById);
router.put('/:id/resolver', alertaController.resolverAlerta);
router.post('/', requireRole(['admin']), alertaController.crearAlerta);

module.exports = router;