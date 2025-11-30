
const {
    User,
    Medidor,
    Lectura,
    Alerta,
    ZonaRural
} = require('../models');

class DashboardController {
    
    // GET /api/dashboard/estadisticas
    async getEstadisticas(req, res) {
        try {
            const { periodo = '30' } = req.query; // días

            const dias = parseInt(periodo) || 30;

            // construir condicion de usuario dependiendo del rol
            const userCondition = req.user.rol !== 'admin' ?
                `AND m.user_id = ${req.user.userId}` : '';

            // 1. estadisticas generales - consultas separadas
            const statsPromises = [];

            // total medidores
            statsPromises.push(
                Medidor.count(req.user.rol !== 'admin' ? { user_id: req.user.userId } : {})
            );

            // total lecturas en el periodo
            const lecturasCountSql = `
                SELECT COUNT(*) as total
                FROM lecturas l
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                WHERE l.fecha >= CURRENT_DATE - INTERVAL '${periodo} days'
                ${userCondition}
            `;
            statsPromises.push(
                Lectura.query(lecturasCountSql).then(result => parseInt(result.rows[0].total))
            );

            // consumo total en el periodo
            const consumoTotalSql = `
                SELECT COALESCE(SUM(l.valor), 0) as total
                FROM lecturas l
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                WHERE l.fecha >= CURRENT_DATE - INTERVAL '${periodo} days'
                ${userCondition}
            `;
            statsPromises.push(
                Lectura.query(consumoTotalSql).then(result => parseFloat(result.rows[0].total))
            );

            // alertas pendientes
            const alertasPendientesSql = `
                SELECT COUNT(*) as total
                FROM alertas a
                LEFT JOIN lecturas l ON a.lectura_id = l.lectura_id
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                WHERE a.resuelta = false
                ${userCondition}
            `;
            statsPromises.push(
                Alerta.query(alertasPendientesSql).then(result => parseInt(result.rows[0].total))
            );

            // total usuarios (solo admin)
            if (req.user.rol === 'admin') {
                statsPromises.push(User.count());
            } else {
                statsPromises.push(Promise.resolve(null));
            }

            // ejecutar consultas en paralelo
            const [
                totalMedidores,
                totalLecturas,
                consumoTotal,
                alertasPendientes,
                totalUsuarios
            ] = await Promise.all(statsPromises);
            
        
            // 2. lecturas recientes
            const lecturasRecientesSql = `
                SELECT
                    l.lectura_id, l.valor, l.fecha, l.observacion,
                    m.serial as medidor_serial,
                    u.nombre as usuario_nombre
                FROM lecturas l
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                LEFT JOIN usuarios u ON m.user_id = u.user_id
                WHERE 1=1 ${userCondition}
                ORDER BY l.fecha DESC
                LIMIT 5
            `;

            const lecturasResult = await Lectura.query(lecturasRecientesSql);

            // 3. alertas PENDIENTES recientes (5)
            // se filtran por resuelta = false para mostrar lo mas urgente
            const alertasRecientesSql = `
                SELECT a.alerta_id, a.tipo, a.mensaje, a.fecha, a.resuelta,
                    m.serial as medidor_serial
                FROM alertas a
                LEFT JOIN lecturas l ON a.lectura_id = l.lectura_id
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                WHERE a.resuelta = false ${userCondition}
                ORDER BY a.fecha DESC LIMIT 5
            `;
            const alertasRecientesResult = await Alerta.query(alertasRecientesSql)

            // 4. consumo por dia (ultimos 15 dias)
            const consumoPorDiaSql = `
                SELECT
                    DATE(l.fecha) as fecha,
                    COUNT(*) as total_lecturas,
                    ROUND(AVG(l.valor)::numeric, 2) as consumo_promedio,
                    ROUND(SUM(l.valor)::numeric, 2) as consumo_total
                FROM lecturas l
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                WHERE l.fecha >= CURRENT_DATE - INTERVAL '${periodo} days'
                ${userCondition}
                GROUP BY DATE(l.fecha)
                ORDER BY fecha DESC
                LIMIT 15
            `;
            const consumoPorDiaResult = await Lectura.query(consumoPorDiaSql);

            // 5. zonas con estadisticas, solo admin
            let zonas = [];
            if (req.user.rol === 'admin') {
                zonas = await ZonaRural.getZonasConEstadisticas();
            }

            // 6. estadisticas por tipo de alerta
            const alertasPorTipoSql = `
                SELECT 
                    a.tipo,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE a.resuelta = true) as resueltas
                FROM alertas a
                LEFT JOIN lecturas l ON a.lectura_id = l.lectura_id
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                WHERE 1=1 ${userCondition}
                GROUP BY a.tipo
                ORDER BY total DESC
            `;

            const alertasPorTipoResult = await Alerta.query(alertasPorTipoSql);
        
            // respuesta final
            const estadisticas = {
                general: {
                    total_usuarios: totalUsuarios,
                    total_medidores: totalMedidores || 0,
                    total_lecturas: totalLecturas || 0,
                    consumo_total: consumoTotal || 0,
                    alertas_pendientes: alertasPendientes || 0
                },
                lecturas_recientes: lecturasResult.rows,
                alertas_recientes: alertasRecientesResult.rows,
                consumo_por_dia: consumoPorDiaResult.rows,
                alertas_por_tipo: alertasPorTipoResult.rows,
                zonas: zonas,
                periodo_dias: dias
            };
        
            res.json(estadisticas);
        
        } catch (error) {
            console.error('Error obteniendo estadísticas del dashboard:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // GET /api/dashboard/consumo-por-zona
    async getConsumoPorZona(req, res) {
        try {
            if (req.user.rol !== 'admin') {
                return res.status(403).json({ error: 'Solo administradoes pueden ver esta información' });
            }

            const { start_date, end_date } = req.query;

            const consumoPorZona = await ZonaRural.getConsumoPorZona(
                start_date || '2025-01-01',
                end_date || new Date().toISOString().split('T')[0]
            );

            res.json(consumoPorZona);

        } catch (error) {
            console.error('Error obteniendo consumo por zona:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // GET /api/dashboard/resumen
    async getResumen(req, res) {
        try {
            const userCondition = req.user.rol !== 'admin' ?
                `AND m.user_id = ${req.user.userId}` : '';

            // consultas separadas
            const resumenPromises = [];

            // total medidores
            resumenPromises.push(
                Medidor.count(req.user.rol !== 'admin' ? { user_id: req.user.userId } : {})
            );

            // lecturas de hoy
            const lecturasHoySql = `
                SELECT COUNT(*) as total
                FROM lecturas l
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                WHERE l.fecha >= CURRENT_DATE
                ${userCondition}
            `;
            resumenPromises.push(
                Lectura.query(lecturasHoySql).then(result => parseInt(result.rows[0].total))
            );

            // consumo de hoy
            const consumoHoySql = `
                SELECT COALESCE(SUM(l.valor), 0) as total
                FROM lecturas l
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                WHERE l.fecha >= CURRENT_DATE
                ${userCondition}
            `;
            resumenPromises.push(
                Lectura.query(consumoHoySql).then(result => parseFloat(result.rows[0].total))
            );

            // alertas de hoy
            const alertasHoySql = `
                SELECT COUNT(*) as total
                FROM alertas a
                LEFT JOIN lecturas l ON a.lectura_id = l.lectura_id
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                WHERE a.resuelta = false
                AND a.fecha >= CURRENT_DATE
                ${userCondition}
            `;
            resumenPromises.push(
                Alerta.query(alertasHoySql).then(result => parseInt(result.rows[0].total))
            );

            const [
                totalMedidores,
                lecturasHoy,
                consumoHoy,
                alertasHoy
            ] = await Promise.all(resumenPromises);

            res.json({
                total_medidores: totalMedidores || 0,
                lecturas_hoy: lecturasHoy || 0,
                consumo_hoy: consumoHoy || 0,
                alertas_hoy: alertasHoy || 0,
                ultima_actualizacion: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error obteniendo resumen del dashboard:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = new DashboardController();