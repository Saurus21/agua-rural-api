const BaseModel = require('./BaseModel');

class ZonaRural extends BaseModel {
    constructor() {
        super('zonasrurales', 'zona_id'); // nombre de la tabla y columna id en la base de datos
    }

    // metodos especificos del modelo ZonaRural
    
    // Obtener zonas rurales con estadísticas agregadas
    async getZonasConEstadisticas() {
        const sql = `
            SELECT
                z.*,
                COUNT(DISTINCT u.user_id) as total_usuarios,
                COUNT(DISTINCT m.medidor_id) as total_medidores,
                COUNT(DISTINCT l.lectura_id) as total_lecturas
            FROM zonasrurales z
            LEFT JOIN usuarios u ON z.zona_id = u.zona_id
            LEFT JOIN medidores m ON u.user_id = m.user_id
            LEFT JOIN lecturas l ON m.medidor_id = l.medidor_id
            GROUP BY z.zona_id
            ORDER BY z.nombre_zona
        `;
        const result = await this.query(sql);
        return result.rows;
    }


    async getConsumoPorZona(startDate, endDate) {
        const sql = `
            SELECT
                z.zona_id,
                z.nombre_zona,
                z.comuna,
                z.region,
                COUNT(l.lectura_id) as total_lecturas,
                ROUND(AVG(l.valor):: numeric, 2) as consumo_promedio,
                ROUND(SUM(l.valor):: numeric, 2) as consumo_total,
            FROM zonasrurales z
            LEFT JOIN usuarios u ON z.zona_id = u.zona_id
            LEFT JOIN medidores m ON u.user_id = m.user_id
            LEFT JOIN lecturas l ON m.medidor_id = l.medidor_id
                WHERE l.fecha BETWEEN $1 AND $2
            GROUP BY z.zona_id, z.nombre_zona, z.comuna, z.region
            ORDER BY consumo_total DESC NULLS LAST
        `;
        const result = await this.query(sql, [startDate, endDate]);
        return result.rows;
    }
}

module.exports = new ZonaRural(); 