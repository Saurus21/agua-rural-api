
const { param } = require('express-validator');
const { Reporte, Lectura, Medidor, User, ZonaRural } = require('../models');

class ReporteController {

    // GET /api/reportes
    async getReportes(req, res) {
        try {
            const { page = 1, limit = 10, tipo_reporte } = req.query;
            const offset = (page - 1) * limit;

            let conditions = {};
            if (tipo_reporte) conditions.tipo_reporte = tipo_reporte;

            // si no es admin, solo ve sus propios reportes
            if (req.user.rol !== 'admin') {
                conditions.user_id = req.user.userId;
            }

            const reportes = await Reporte.findAll(conditions, parseInt(limit), offset);
            const total = await Reporte.count(conditions);

            res.json({
                reportes,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('Error obteniendo reportes:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // POST /api/reportes/consumo
    async generarReporteConsumo(req, res) {
        try {
            const { start_date, end_date, zona_id, user_id, formato = 'json' } = req.body;

            // validar fechas
            if (!start_date || !end_date) {
                return res.status(400).json({ error: 'Fecha inicio y fecha fin son requeridas' });
            }

            // construir condiciones para hacer la consulta
            let whereConditions = ['l.fecha BETWEEN $1 AND $2'];
            const values = [start_date, end_date];
            let paramCount = 2;

            if (zona_id) {
                paramCount++;
                whereConditions.push(`u.zona_id = $${paramCount}`);
                values.push(zona_id);
            }

            if (user_id) {
                paramCount++;
                whereConditions.push(`m.user_id = $${paramCount}`);
                values.push(req.user.userId);
            }

            const sql = `
                SELECT
                    m.medidor_id, m.serial, m.ubicacion,
                    u.user_id, u.nombre as usuario_nombre,
                    z.zona_id, z.nombre_zona, z.comuna, z.region,
                    COUNT(l.lectura_id) as total_lecturas,
                    ROUND(AVG(l.valor)::numeric, 2) as consumo_promedio,
                    ROUND(SUM(l.valor)::numeric, 2) as consumo_total,
                    ROUND(MIN(l.valor)::numeric, 2) as consumo_minimo,
                    ROUND(MAX(l.valor)::numeric, 2) as consumo_maximo,
                    MIN(l.fecha) as primera_lectura,
                    MAX(l.fecha) as ultima_lectura
                FROM lecturas l
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                LEFT JOIN usuarios u ON m.user_id = u.user_id
                LEFT JOIN zonasrurales z ON u.zona_id = z.zona_id
                WHERE ${whereConditions.join(' AND ')}
                GROUP BY
                    m.medidor_id, m.serial, m.ubicacion,
                    u.user_id, u.nombre,
                    z.zona_id, z.nombre_zona, z.comuna, z.region
                ORDER BY z.nombre_zona, u.nombre, m.serial
            `;

            const result = await Reporte.query(sql, values);
            const datos = result.rows;

            // calcular resumen general
            const resumen = {
                total_medidores: datos.length,
                total_lecturas: datos.reduce((sum, item) => sum + parseInt(item.total_lecturas), 0),
                consumo_total: datos.reduce((sum, item) => sum + parseFloat(item.consumo_total), 0),
                consumo_promedio_global: datos.reduce((sum, item) => sum + parseFloat(item.consumo_promedio), 0) / datos.length,
                periodo: {
                    start_date,
                    end_date
                }
            };

            // crear registro del reporte
            const reporteData = {
                user_id: req.user.userId,
                tipo_reporte: 'consumo',
                parametros: {
                    start_date,
                    end_date,
                    zona_id,
                    user_id
                },
                resumen: `Reporte de consumo del ${start_date} al ${end_date}. ${resumen.total_medidores} medidores analizados.`
            };

            const reporte = await Reporte.create(reporteData);

            // preparar respuesta segun formato
            let respuesta;
            if (formato === 'csv') {
                respuesta = this.formatearCSV(datos, resumen);
            } else {
                respuesta = {
                    reporte,
                    resumen,
                    datos
                };
            }

            res.json(respuesta);

        } catch (error) {
            console.error('Error generando reporte de consumo:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // POST /api/reportes/alertas
    async generarReporteAlertas(req, res) {
        try {
            const { start_date, end_date, tipo } = req.body;

            let whereConditions = ['a.fecha BETWEEN $1 AND $2'];
            const values = [start_date, end_date];
            let paramCount = 2;

            if (tipo) {
                paramCount++;
                whereConditions.push(`a.tipo = $${paramCount}`);
                values.push(tipo);
            }

            // si no es admin, filtrar por usuario
            if (req.user.rol !== 'admin') {
                paramCount++;
                whereConditions.push(`m.user_id = $${paramCount}`);
                values.push(req.user.userId);
            }

            const sql = `
                SELECT
                    a.tipo, a.mensaje, a.fecha, a.resuelta,
                    l.valor as lectura_valor,
                    m.serial as medidor_serial,
                    u.nombre as usuario_nombre,
                    z.nombre_zona
                FROM alertas a
                LEFT JOIN lecturas l ON a.lectura_id = l.lectura_id
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                LEFT JOIN usuarios u ON m.user_id = u.user_id
                LEFT JOIN zonasrurales z ON u.zona_id = z.zona_id
                WHERE ${whereConditions.join(' AND ')}
                ORDER BY a.fecha DESC
            `;

            const result = await Reporte.query(sql, values);
            const alertas = result.rows;

            // estadisticas por tipo
            const estadisticas = alertas.reduce((acc, alerta) => {
                if (!acc[alerta.tipo]) {
                    acc[alerta.tipo] = {
                        total: 0,
                        resueltas: 0,
                        pendientes: 0
                    };
                }
                acc[alerta.tipo].total++;
                if (alerta.resuelta) {
                    acc[alerta.tipo].resueltas++;
                } else {
                    acc[alerta.tipo].pendientes++;
                }
                return acc;
            }, {});

            const resumen = {
                total_alertas: alertas.length,
                total_resueltas: alertas.filter(a => a.resuelta).length,
                total_pendientes: alertas.filter(a => !a.resuelta).length,
                estadisticas,
                periodo: {
                    start_date,
                    end_date
                }
            };

            // crear registro del reporte
            const reporteData = {
                user_id: req.user.userId,
                tipo_reporte: 'alertas',
                parametros: {
                    start_date,
                    end_date,
                    tipo
                },
                resumen: `Resumen de alertas del ${start_date} al ${end_date}. ${resumen.total_alertas} alertas encontradas.`
            };

            const reporte = await Reporte.create(reporteData);

            res.json({
                reporte,
                resumen,
                alertas
            });

        } catch (error) {
            console.error('Error generando reporte de alertas:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // metodo para formatear csv
    formatearCSV(datos, resumen) {
        const headers = [
            'Serial Medidor',
            'Ubicación',
            'Usuario',
            'Zona Rural',
            'Total Lecturas',
            'Consumo Promedio',
            'Consumo Total',
            'Consumo Mínimo',
            'Consumo Máximo',
            'Primera Lectura',
            'Última Lectura'
        ];

        let csv = headers.join(',') + '\n';

        datos.forEach(item => {

            const usuario = item.usuario_nombre ? item.usuario_nombre.replace(/"/g, '""') : '';
            const zona = item.nombre_zona ? item.nombre_zona.replace(/"/g, '""') : '';

            const row = [
                `"${item.serial}"`,
                `"${item.ubicacion || ''}"`,
                `"${usuario}"`,
                `"${zona}"`,
                item.total_lecturas,
                item.consumo_promedio,
                item.consumo_total,
                item.consumo_minimo,
                item.consumo_maximo,
                `"${new Date(item.primera_lectura).toISOString()}"`,
                `"${new Date(item.ultima_lectura).toISOString()}"`
            ];
            csv += row.join(',') + '\n';
        });

        // agregar resumen
        csv += '\nRESUMEN GENERAL\n';
        csv += `Total Medidores,${resumen.total_medidores}\n`;
        csv += `Total Lecturas,${resumen.total_lecturas}\n`;
        csv += `Consumo Total,${resumen.consumo_total}\n`;
        csv += `Consumo Promedio Global,${resumen.consumo_promedio_global}\n`;

        return {
            formato: 'csv',
            contenido: csv,
            filename: `reporte_consumo_${new Date().toISOString().split('T')[0]}.csv`
        };
    }
}

module.exports = new ReporteController();