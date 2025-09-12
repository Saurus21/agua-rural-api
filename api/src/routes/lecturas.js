const express = require('express');
const router = express.Router();
const db = require('../config/database');

// obtener todas las lecturas
router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM lecturas ORDER BY fecha DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener las lecturas:', error);
        res.status(500).json({ error: 'Error al obtener las lecturas' });
    }
});

// crear una nueva lectura
router.post('/', async (req, res) => {
    const { medidor_id, valor, observacion } = req.body;

    try {
        const result = await db.query(
            'INSERT INTO lecturas (medidor_id, valor, observacion) VALUES ($1, $2, $3) RETURNING *',
            [medidor_id, valor, observacion]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error al crear la lectura:', error);
        res.status(500).json({ error: 'Error al crear la lectura' });
    }
});

module.exports = router;