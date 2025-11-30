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

            let whereClause = 'WHERE 1=1';
            const values = [];
            let paramCount = 0;

            if (tipo) {
                paramCount++;
                whereClause += ` AND a.tipo = $${paramCount}`;
                values.push(tipo);
            }

            if (resuelta !== undefined) {
                paramCount++;
                whereClause += ` AND a.resuelta = $${paramCount}::boolean`;
                values.push(resuelta === 'true');
            }

            if (pendientes === 'true') {
                paramCount++;
                whereClause += ` AND a.resuelta = $${paramCount}::boolean`;
                values.push(false);
            }

            if (req.user.rol !== 'admin') {
                paramCount++;
                whereClause += ` AND m.user_id = $${paramCount}`;
                values.push(req.user.userId);
            }

            const sql = `
                SELECT a.*, l.valor as lectura_valor, m.serial as medidor_serial,
                    u.nombre as usuario_nombre, u.user_id as usuario_id
                FROM alertas a
                LEFT JOIN lecturas l ON a.lectura_id = l.lectura_id
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                LEFT JOIN usuarios u ON m.user_id = u.user_id
                ${whereClause}
                ORDER BY a.fecha DESC
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;

            const queryValues = [...values, parseInt(limit), offset];
            const result = await Alerta.query(sql, queryValues);
            const alertas = result.rows;

            const countSql = `
                SELECT COUNT(*) as total
                FROM alertas a
                LEFT JOIN lecturas l ON a.lectura_id = l.lectura_id
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                ${whereClause}
            `;

            const countResult = await Alerta.query(countSql, values);
            const total = parseInt(countResult.rows[0].total);

            res.json({
                alertas,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });

        } catch (error) {
            console.error('Error obteniendo alertas:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // GET /api/alertas/:id
    async getAlertaById(req, res) {
        try {
            const { id } = req.params;

            const sql = `
                SELECT a.*,
                    l.valor as lectura_valor, l.fecha as lectura_fecha,
                    m.serial as medidor_serial, m.ubicacion as medidor_ubicacion,
                    u.nombre as usuario_nombre, u.email as usuario_email, u.user_id as owner_id
                FROM alertas a
                LEFT JOIN lecturas l ON a.lectura_id = l.lectura_id
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                LEFT JOIN usuarios u ON m.user_id = u.user_id
                WHERE a.alerta_id = $1
            `;

            const result = await Alerta.query(sql, [id]);
            const alerta = result.rows[0];

            if (!alerta) {
                return res.status(404).json({ error: 'Alerta no encontrada' });
            }

            if (req.user.rol !== 'admin' && alerta.owner_id !== req.user.userId) {
                return res.status(403).json({ error: 'No tienes permiso para ver esta alerta' });
            }

            res.json(alerta);

        } catch (error) {
            console.error('Error obteniendo alerta por ID:', error);
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

            const sqlCheck = `
                SELECT a.*, m.user_id as owner_id
                FROM alertas a
                LEFT JOIN lecturas l ON a.lectura_id = l.lectura_id
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                WHERE a.alerta_id = $1
            `;

            const checkResult = await Alerta.query(sqlCheck, [id]);

            if (checkResult.rows.length === 0) {
                return res.status(404).json({ error: 'Alerta no encontrada' });
            }

            const alerta = checkResult.rows[0];
            if (req.user.rol !== 'admin' && alerta.owner_id !== req.user.userId) {
                return res.status(403).json({ error: 'No tienes permiso para resolver esta alerta' });
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