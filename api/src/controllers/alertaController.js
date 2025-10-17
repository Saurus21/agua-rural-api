const { parse } = require('dotenv');
const { Alerta, Lectura, Medidor, User } = require('../models');

class AlertaController {

    // GET /api/alertas
    async getAlertas(req, res) {
        try {
            const {
                page = 1,
                limit = 20,
                tipo,
                resuelta,
                pendientes
            } = req.query;

            const offset = (page - 1) * limit;

            let conditions = {};
            if (tipo) conditions.tipo = tipo;
            if (resuelta !== undefined) conditions.resuelta = resuelta === 'true';

            // si se piden solo pendientes
            if (pendientes === 'true') {
                conditions.resuelta = false;
            }
            
            let sql = `
                SELECT a.*, l.valor as lectura_valor, m.serial as medidor_serial,
                    u.nombre as usuario_nombre, u.user_id as usuario_id
                FROM alertas a
                LEFT JOIN lecturas l ON a.lectura_id = l.lectura_id
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                LEFT JOIN usuarios u ON m.user_id = u.user_id
                WHERE 1=1
            `;

            const values = [];
            let paramCount = 0;

            // aplicar condiciones
            for (const [key, value] of Object.entries(conditions)) {
                paramCount++;
                sql += ` AND m.user_id = $${paramCount}`;
                values.push(req.user.userId);
            }

            // sino es admin, solo puede ver alertas de sus medidores
            if (req.user.rol !== 'admin') {
                paramCount++;
                sql += ` AND m.user_id = $${paramCount}`;
                values.push(req.user.userId);
            }

            sql += ` ORDER BY a.fecha DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
            values.push(parseInt(limit), offset);

            const result = await Alerta.query(sql, values);
            const alertas = result.rows;

            // obtener total
            let countSql =  `
                SELECT COUNT (*)
                FROM alertas a
                LEFT JOIN lecturas l ON a.lectura_id = l.lectura_id
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                WHERE 1=1
            `;

            const countValues = [...Object.values(conditions)];
            let countParamCount = countValues.length;

            for (const [key, value] of Object.entries(conditions)) {
                countSql += ` AND a.${key} = $${countValues.indexOf(value) + 1}`;
            }

            if (req.user.rol !== 'admin') {
                countParamCount++;
                countSql += ` AND m.user_id = $${countParamCount}`;
                countValues.push(req.user.userId);
            }

            const countResult = await Alerta.query(countSql, countValues);
            const total = parseInt(countResult.rows[0].count);

            res.json({
                alertas,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('Error obteniendo alertas:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // GET /api/alertas/estadisticas
    async getEstadisticasAlertas(req, res) {
        try {
            const { days = 30 } = req.query;

            let sql = `
                SELECT
                    tipo,
                    COUNT (*) as total,
                    COUNT (*) FILTER (WHERE resuelta = true) as resueltas,
                    COUNT (*) FILTER (WHERE resuelta = false) as pendientes
                FROM alertas
                WHERE fecha >= CURRENT_DATE - INTERVAL '${days} days'
            `;

            const values = [];

            // sino es admin, filtrar por usuario
            if (req.user.rol !== 'admin') {
                sql += `
                    AND lectura_id IN (
                        SELECT l.lectura_id
                        FROM lecturas l
                        LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                        WHERE m.user_id = $1    
                    )
                `;
                values.push(req.user.userId);
            }

            sql += ` GROUP BY tipo ORDER BY total DESC`;

            const result = await Alerta.query(sql, values);
            const estadisticas = result.rows;

            // calcular totales
            const totales = {
                total: estadisticas.reduce((sum, item) => sum + parseInt(item.total), 0),
                resueltas: estadisticas.reduce((sum, item) => sum + parseInt(item.resueltas), 0),
                pendientes: estadisticas.reduce((sum, item) => sum + parseInt(item.pendientes), 0)
            };

            res.json({
                estadisticas,
                totales,
                periodo_dias: parseInt(days)
            });

        } catch (error) {
            console.error('Error obteniendo estadísticas de alertas:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // PUT /api/alertas/:id/resolver
    async resolverAlerta(req, res) {
        try {
            const { id } = req.params;

            const alerta = await Alerta.findById(id);
            if (!alerta) {
                res.status(404).json({ error: 'Alerta no encontrada' });
            }

            // verificar permisos
            if (req.user.rol !== 'admin') {
                // obtener informacion de la lectura y medidor para verificar permisos
                const sql = `
                    SELECT m.user_id
                    FROM alertas a
                    LEFT JOIN lecturas l ON a.lectura_id = l.lectura_id
                    LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                    WHERE a.alerta_id = $1
                `;
                const result = await Alerta.query(sql, [id]);

                if (result.rows.length === 0 || result.rows[0].user_id !== req.user.userId) {
                    return res.status(403).json({ error: 'No tienes permiso para resolver esta alerta' });
                }
            }

            const alertaResuelta = await Alerta.marcarComoResuelta(id);

            res.json({
                message: 'Alerta marcada como resuelta',
                alerta: alertaResuelta
            });

        } catch (error){
            console.error('Error resolviendo alerta:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // GET /api/alertas/pendientes
    async getAlertasPendientes(req, res) {
        try {
            const alertas = await Alerta.getAlertasPendientes();

            // filtrar por usuario si no es admin
            let alertasFiltradas = alertas;
            if (req.user.rol !== 'admin') {
                alertasFiltradas = alertas.filter(alerta =>
                    alerta.usuario_id === req.user.userId
                );
            }

            res.json({
                alertas: alertasFiltradas,
                total: alertasFiltradas.length
            });

        } catch (error) {
            console.error('Error obteniendo alertas pendientes', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // POST /api/alertas - crear alertas manualmente (solo admin)
    async crearAlerta(req, res) {
        try {
            const { lectura_id, tipo, mensaje } = req.body;

            // validaciones
            if (!lectura_id || !tipo || !mensaje) {
                return res.status(400).json({ error: 'Lectura ID, tipo y mensaje son requeridos' });
            }

            // verificar que la lectura existe
            const lectura = await Lectura.findById(lectura_id);
            if (!lectura) {
                return res.status(404).json({ error: 'Lectura no encontrada' });
            }

            const alertaData = {
                lectura_id,
                tipo,
                mensaje,
                resuelta: false
            };

            const nuevaAlerta = await Alerta.create(alertaData);

            res.status(200).json({
                message: 'Alerta creada exitosamente',
                alerta: nuevaAlerta
            });

        } catch (error) {
            console.error('Error creando alerta:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
}

module.exports = new AlertaController();    //      |-/