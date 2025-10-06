const BaseModel = require('./BaseModel');

class Lectura extends BaseModel {
    constructor() {
        super('lecturas', 'lectura_id'); // nombre de la tabla y columna id en la base de datos
    }

    // metodos especificos del modelo Lectura

    // Crear una nueva lectura
    async create(lecturaData) {
        // validar valor positivo
        if (lecturaData.valor < 0) {
            throw new Error('El valor de la lectura debe ser positivo');
        }

        return await super.create(lecturaData);
    }

    // Obtener lecturas por medidor
    async getLecturasByMedidor(medidorId, limit = 50, offset = 0) {
        const sql = `
            SELECT l.*, m.serial as medidor_serial, u.nombre as usuario_nombre
            FROM lecturas l
            LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
            LEFT JOIN usuarios u ON m.user_id = u.user_id
            WHERE l.medidor_id = $1
            ORDER BY l.fecha DESC
            LIMIT $2 OFFSET $3
        `;
        const results = await this.query(sql, [medidorId, limit, offset]);
        return results.rows;
    }

    // Obtener lecturas recientes por usuario
    async getLecturasByUser(userId, days = 30) {
        const sql = `
            SELECT l.*, m.serial as medidor_serial, m.ubicacion
            FROM lecturas l
            LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
            WHERE m.user_id = $1 AND l.fecha >= CURRENT_DATE - INTERVAL '${days} days'
            ORDER BY l.fecha DESC
        `;
        const results = await this.query(sql, [userId]);
        return results.rows;
    }

    // Obtener lecturas pendientes de sincronización
    async getLecturasPendientesSincronizacion() {
        const sql = `
            SELECT l.*, m.serial as medidor_serial, u.nombre as usuario_nombre
            FROM lecturas l
            LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
            LEFT JOIN usuarios u ON m.user_id = u.user_id
            WHERE l.sincronizado = false
            ORDER BY l.fecha ASC
        `;
        const results = await this.query(sql);
        return results.rows;
    }

    // Marcar lectura como sincronizada
    async marcarComoSincronizado(lecturaId) {
        const sql = 'UPDATE lecturas SET sincronizado = true, updated_at = CURRENT_TIMESTAMP WHERE lectura_id = $1 RETURNING *';
        const result = await this.query(sql, [lecturaId]);
        return result.rows[0];
    }

    // Obtener estadísticas de consumo para un medidor en un rango de fechas
    async getEstadisticasConsumo(medidorId, startDate, endDate) {
        const sql = `
            SELECT
                COUNT(*) as total_lecturas,
                AVG(valor) as consumo_promedio,
                MIN(valor) as consumo_minimo,
                MAX(valor) as consumo_maximo,
                SUM(valor) as total_consumo
            FROM lecturas
            WHERE medidor_id = $1
                AND fecha BETWEEN $2 AND $3
        `;
        const results = await this.query(sql, [medidorId, startDate, endDate]);
        return results.rows[0];
    }


    async getUltimaLectura(medidorId) {
        const sql = `
            SELECT * FROM lecturas
            WHERE medidor_id = $1
            ORDER BY fecha DESC
            LIMIT 1
        `;
        const results = await this.query(sql, [medidorId]);
        return results.rows[0] || null;
    }
}

module.exports = new Lectura();
