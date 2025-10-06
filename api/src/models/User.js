const BaseModel = require('./BaseModel');
const {hashPassword, comparePassword} = require('../utils/password');

class User extends BaseModel {
    constructor() {
        super('usuarios', 'user_id'); // nombre de la tabla y columna id en la base de datos
    }

    // metodos especificos del modelo User

    // Buscar usuario por email
    async findByEmail(email) {
        const query = 'SELECT * FROM usuarios WHERE email = $1';
        const results = await this.query(query, [email.toLowerCase()]);
        return results.rows[0] || null;
    }

    // Crear nuevo usuario con hash de contraseña
    async create(userData) {
        // hashear la contraseña antes de guardarla
        if (userData.password) {
            userData.password_hash = await hashPassword(userData.password);
            delete userData.password; // eliminar la contraseña en texto plano
        }

        return await super.create(userData);
    }

    // Verificar la contraseña
    async verifyPassword(plainPassword, hashedPassword) {
        return await comparePassword(plainPassword, hashedPassword);
    }

    // Actualizar el último login
    async updateLastLogin(userId) {
        const sql = 'UPDATE usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING *';
        const result = await this.query(sql, [userId]);
        return result.rows[0];
    }

    // Cambiar la contraseña
    async changePassword(userId, newPassword) {
        const newPasswordHash = await hashPassword(newPassword);
        const sql = 'UPDATE usuarios SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 RETURNING *';
        const result = await this.query(sql, [newPasswordHash, userId]);
        return result.rows[0];
    }

    // Obtener usuarios por zona rural
    async getUsersByZona(zonaId) {
        const sql = `
            SELECT u.*, z.nombre_zona 
            FROM usuarios u 
            LEFT JOIN zonasrurales z ON u.zona_id = z.zona_id 
            WHERE u.zona_id = $1 AND u.activo = true
        `;
        const results = await this.query(sql, [zonaId]);
        return results.rows;
    }

    // Desactivar usuario
    async deactivateUser(userId) {
        const sql = 'UPDATE usuarios SET activo = false, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING *';
        const result = await this.query(sql, [userId]);
        return result.rows[0];
    }
}

module.exports = new User();