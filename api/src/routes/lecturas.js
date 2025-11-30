const express = require('express');
const router = express.Router();
const LecturaController = require('../controllers/lecturaController');
const { authenticateToken } = require('../middleware/auth');
const lecturaController = require('../controllers/lecturaController');

// todas las rutas necesitan autenticacion
router.use(authenticateToken);

router.get('/', lecturaController.getLecturas);
router.get('/:id', lecturaController.getLecturaById);
router.post('/', lecturaController.createLectura.bind(lecturaController));
router.post('/sincronizar', lecturaController.sincronizarLecturas);

module.exports = router;