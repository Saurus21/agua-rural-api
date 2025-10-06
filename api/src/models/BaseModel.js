const db = require('../config/database');

class BaseModel {
    constructor(tableName, idColumn = null) {
        this.tableName = tableName;

        this.idColumn = idColumn || this.getDefaultIdColumn();
    }

    // obtener el nombre de la columna ID por defecto
    getDefaultIdColumn() {
        const idMappings = {
            'usuarios': 'user_id',
            'medidores': 'medidor_id', 
            'lecturas': 'lectura_id',
            'alertas': 'alerta_id',
            'reportes': 'reporte_id',
            'zonasrurales': 'zona_id'
        };

        return idMappings[this.tableName] || `${this.tableName.slice(0, -1)}_id`;
    }

    // método para ejecutar consultas
    async query(sql, params = []) {
        try {
            const result = await db.query(sql, params);

            // convertir campos NUMERIC a Number
            if (result.rows && result.rows.length > 0) {
                result.rows = this.convertNumericFields(result.rows);
            }

            return result;
        } catch (error) {
            console.error(`Error en la consulta ${this.tableName}: `, error);
            throw error;
        }
    }

    // convertir campos NUMERIC a Number
    convertNumericFields(rows) {
        return rows.map(row => {
            const convertedRow = { ...row };

            for (const key in convertedRow) {
                if (convertedRow[key] !== null && !isNaN(convertedRow[key])) {
                    // si es un string que representa un numero, convertirlo
                    if (typeof convertedRow[key] === 'string' && /^-?\d*\.?\d+$/.test(convertedRow[key])) {
                        convertedRow[key] = parseFloat(convertedRow[key]);
                    }
                }
            }
            return convertedRow;
        });
    }

    // crud básico
    async findAll(conditions = {}, limit = null, offset = null) {
        let whereClause = '';
        const values = [];
        let paramCount = 0;

        if (Object.keys(conditions).length > 0) {
            const conditionsArray = [];
            for (const [key, value] of Object.entries(conditions)) {
                paramCount++;
                conditionsArray.push(`${key} = $${paramCount}`);
                values.push(value);
            }
            whereClause = `WHERE ${conditionsArray.join(' AND ')}`;
        }

        let limitClause = '';
        if (limit) {
            paramCount++;
            limitClause = `LIMIT $${paramCount}`;
            values.push(limit);
        }

        let offsetClause = '';
        if (offset) {
            paramCount++;
            offsetClause = `OFFSET $${paramCount}`;
            values.push(offset);
        }

        const sql = `SELECT * FROM ${this.tableName} ${whereClause} ${limitClause} ${offsetClause}`;
        const result = await this.query(sql, values);
        return result.rows;
    }

    // método para encontrar un registro por su ID

    async findById(id) {
        const sql = `SELECT * FROM ${this.tableName} WHERE ${this.tableName.slice(0, -1)}_id = $1`;
        const result = await this.query(sql, [id]);
        return result.rows[0] || null;
    }

    // método para crear un nuevo registro

    async create(data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map((_, index) => `$${index + 1}`);

        const sql = `
            INSERT INTO ${this.tableName} (${keys.join(', ')}) 
            VALUES (${placeholders.join(', ')}) 
            RETURNING *
        `;

       const result = await this.query(sql, values);
       return result.rows[0];
    }

    // método para actualizar un registro por su ID

    async update(id, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');

        const sql = `
            UPDATE ${this.tableName} 
            SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
            WHERE ${this.idColumn} = $${keys.length + 1} 
            RETURNING *
        `;
       const result = await this.query(sql, [...values, id]);
       return result.rows[0] || null;
    }

    // método para eliminar un registro por su ID

    async delete(id) {
        const sql = `DELETE FROM ${this.tableName} WHERE ${this.idColumn} = $1 RETURNING *`;
        const result = await this.query(sql, [id]);
        return result.rows[0] || null;
    }

    // método para contar registros con condiciones opcionales

    async count(conditions = {}) {
        let whereClause = '';
        const values = [];
        let paramCount = 0;

        if (Object.keys(conditions).length > 0) {
            const conditionsArray = [];
            for (const [key, value] of Object.entries(conditions)) {
                paramCount++;
                conditionsArray.push(`${key} = $${paramCount}`);
                values.push(value);
            }
            whereClause = `WHERE ${conditionsArray.join(' AND ')}`;
        }

        const sql = `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}`;
        const result = await this.query(sql, values);
        return parseInt(result.rows[0].count);
    }
}

module.exports = BaseModel;