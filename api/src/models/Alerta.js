const BaseModel = require('./BaseModel');

class Alerta extends BaseModel {
    constructor() {
        super('alertas', 'alerta_id'); // nombre de la tabla y columna id en la base de datos
    }

    // metodos especificos del modelo Alerta

    // Crear una nueva alerta
    async create(alertaData) {
        // establecer fecha actual si no se proporciona
        if (!alertaData.fecha) {
            alertaData.fecha = new Date();
        }

        return await super.create(alertaData);
    }

    // Obtener alertas por lectura
    async getAlertasByLectura(lecturaId) {
        const sql = `
            SELECT a.*, l.valor as lectura_valor, m.serial as medidor_serial
            FROM alertas a
            LEFT JOIN lecturas l ON a.lectura_id = l.lectura_id
            LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
            WHERE a.lectura_id = $1
            ORDER BY a.fecha DESC
        `;
        const results = await this.query(sql, [lecturaId]);
        return results.rows;
    }

    // Obtener alertas pendientes (no resueltas)
    async getAlertasPendientes() {
        const sql = `
            SELECT a.*, l.valor as lectura_valor, m.serial as medidor_serial, u.nombre as usuario_nombre
            FROM alertas a
            LEFT JOIN lecturas l ON a.lectura_id = l.lectura_id
            LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
            LEFT JOIN usuarios u ON m.user_id = u.user_id
            WHERE a.resuelta = false
            ORDER BY a.fecha ASC
        `;
        const results = await this.query(sql);
        return results.rows;
    }

    // Marcar alerta como resuelta
    async marcarComoResuelta(alertaId) {
        const sql = 'UPDATE alertas SET resuelta = true WHERE alerta_id = $1 RETURNING *';
        const result = await this.query(sql, [alertaId]);
        return { message: 'Alerta marcada como resuelta', alerta: result.rows[0] };
    }

    // Obtener alertas por tipo
    async getAlertasByTipo(tipo, limit = 100) {
        const sql = `
            SELECT a.*, l.valor as lectura_valor, m.serial as medidor_serial, u.nombre as usuario_nombre
            FROM alertas a
            LEFT JOIN lecturas l ON a.lectura_id = l.lectura_id
            LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
            LEFT JOIN usuarios u ON m.user_id = u.user_id
            WHERE a.tipo = $1
            ORDER BY a.fecha DESC
            LIMIT $2
        `;
        const results = await this.query(sql, [tipo, limit]);
        return results.rows;
    }

    // Obtener estadísticas de alertas en los últimos N días
    async getEstadisticasAlertas(days = 30) {
        const sql = `
            SELECT
                tipo,
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE resuelta = true) as resueltas,
                COUNT(*) FILTER (WHERE resuelta = false) as pendientes
            FROM alertas
            WHERE fecha >= CURRENT_DATE - INTERVAL '${days} days'
            GROUP BY tipo
            ORDER BY total DESC
        `;
        const results = await this.query(sql);
        return results.rows;
    }
}

module.exports = new Alerta();
