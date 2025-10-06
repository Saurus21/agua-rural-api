const BaseModel = require('./BaseModel');

class Medidor extends BaseModel {
    constructor() {
        super('medidores', 'medidor_id'); // nombre de la tabla y columna id en la base de datos
    }

    // metodos especificos del modelo Medidor

    // Buscar medidor por serial
    async findBySerial(serial) {
        const query = 'SELECT * FROM medidores WHERE serial = $1';
        const results = await this.query(query, [serial]);
        return results.rows[0] || null;
    }

    // Obtener medidores activos por usuario
    async getMedidoresByUser(userId) {
        const sql = `
            SELECT m.*, u.nombre as usuario_nombre
            FROM medidores m
            LEFT JOIN usuarios u ON m.user_id = u.user_id
            WHERE m.user_id = $1 AND m.activo = true
            ORDER BY m.serial
        `;
        const results = await this.query(sql, [userId]);
        return results.rows;
    }

    // Obtener medidores con estadísticas de lecturas
    async getMedidoresWithStats() {
        const sql = `
            SELECT 
                m.*,
                u.nombre as usuario_nombre,
                z.nombre_zona,
                COUNT(l.lectura_id) as total_lecturas,
                MAX(l.fecha) as ultima_lectura
                AVG(l.valor) as consumo_promedio
            FROM medidores m
            LEFT JOIN usuarios u ON m.user_id = u.user_id
            LEFT JOIN zonasrurales z ON u.zona_id = z.zona_id
            LEFT JOIN lecturas l ON m.medidor_id = l.medidor_id
            WHERE m.activo = true
            GROUP BY m.medidor_id, u.nombre, z.nombre_zona
            ORDER BY z.nombre_zona, m.serial
        `;
        const results = await this.query(sql);
        return results.rows;
    }

    // Desactivar un medidor (soft delete)
    async deactivateMedidor(medidorId) {
        const sql = 'UPDATE medidores SET activo = false, updated_at = CURRENT_TIMESTAMP WHERE medidor_id = $1 RETURNING *';
        const result = await this.query(sql, [medidorId]);
        return { message: 'Medidor desactivado exitosamente', medidor: result.rows[0] };
    }

    // Obtener medidores por zona
    async getMedidoresByZona(zonaId) {
        const sql = `
            SELECT m.*, u.nombre as usuario_nombre
            FROM medidores m
            LEFT JOIN usuarios u ON m.user_id = u.user_id
            WHERE u.zona_id = $1 AND m.activo = true
            ORDER BY m.serial
        `;
        const results = await this.query(sql, [zonaId]);
        return results.rows;
    }
}

module.exports = new Medidor();