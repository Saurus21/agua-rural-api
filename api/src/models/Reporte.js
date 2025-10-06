const { param } = require('express-validator');
const BaseModel = require('./BaseModel');

class Reporte extends BaseModel {
    constructor() {
        super('reportes', 'reporte_id'); // nombre de la tabla y columna id en la base de datos
    }
    // metodos especificos del modelo Reporte

    // Crear un nuevo reporte
    async create(reporteData) {
        // establecer fecha actual si no se proporciona
        if (!reporteData.fecha_generacion) {
            reporteData.fecha_generacion = new Date();
        }

        return await super.create(reporteData);
    }

    // Obtener reportes por usuario con paginación
    async getReportesByUser(userId, limit = 20, offset = 0) {
        const sql = `
            SELECT r.*, u.nombre as usuario_nombre
            FROM reportes r
            LEFT JOIN usuarios u ON r.user_id = u.user_id
            WHERE r.user_id = $1
            ORDER BY r.fecha_generacion DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await this.query(sql, [userId, limit, offset]);
        return result.rows;
    }

    // Obtener reportes por tipo con límite
    async getReportesByTipo(tipoReporte, limit = 50) {
        const sql = `
            SELECT r.*, u.nombre as usuario_nombre
            FROM reportes r
            LEFT JOIN usuarios u ON r.user_id = u.user_id
            WHERE r.tipo_reporte = $1
            ORDER BY r.fecha_generacion DESC
            LIMIT $2
        `;
        const result = await this.query(sql, [tipoReporte, limit]);
        return result.rows;
    }

    // Generar reporte de consumo (lógica placeholder)
    async generarReporteConsumo(userId, parametros) {
        
        const { startDate, endDate, zonaId } = parametros;

        let whereClause = 'WHERE 1=1';
        const values = [userId];
        let paramCount = 1;

        if (startDate) {
            paramCount++;
            whereClause += ` AND r.fecha_generacion >= $${paramCount}`;
            values.push(startDate);
        }

        if (endDate) {
            paramCount++;
            whereClause += ` AND r.fecha_generacion <= $${paramCount}`;
            values.push(endDate);
        }

        if (zonaId) {
            paramCount++;
            whereClause += ` AND r.zona_id = $${paramCount}`;
            values.push(zonaId);
        }

        const sql = `
            SELECT
                m.serial,
                u.nombre as usuario_nombre,
                z.nombre_zona,
                COUNT(l.lectura_id) as total_lecturas,
                AVG(l.valor) as consumo_promedio,
                SUM(l.valor) as consumo_total,
                MIN(l.valor) as consumo_minimo,
                MAX(l.valor) as consumo_maximo
            FROM lecturas l
            LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
            LEFT JOIN usuarios u ON m.user_id = u.user_id
            LEFT JOIN zonasrurales z ON m.zona_id = z.zona_id
            ${whereClause}
            GROUP BY m.serial, u.nombre, z.nombre_zona
            ORDER BY z.nombre_zona, u.nombre
        `;
        const result = await this.query(sql, values);

        const reporteData = {
            user_id: userId,
            tipo_reporte: 'consumo',
            parametros: parametros,
            resumen: `Reporte de consumo generado el ${new Date().toLocaleDateString()}`
        }

        const reporte = await this.create(reporteData);

        return {
            reporte,
            datos: result.rows
        };
    }
}

module.exports =  new Reporte();