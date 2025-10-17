const { User, ZonaRural } = require('../models');

class UserController {

    // GET /api/usuarios - solo admin
    async getUsers(req, res) {
        try {
            const { page = 1, limit = 10, zona_id, activo } = req.query;
            const offset = (page - 1) * limit;

            let conditions = {};
            if (zona_id) conditions.zona_id = zona_id;
            if (activo !== undefined) conditions.activo = activo === 'true';

            const users = await User.findAll(conditions, parseInt(limit), offset);
            const total = await User.count(conditions);

            // obtener informacion de zona_rural para cada usuario
            const usersWithZona = await Promise.all(
                users.map(async user => {
                    let zonaInfo = null;
                    if (user.zona_id) {
                        zonaInfo = await ZonaRural.findById(user.zona_id);
                    }
                    return {
                        ...user,
                        zona: zonaInfo
                    };
                })
            );

            res.json({
                users: usersWithZona,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('Error al obtener usuarios:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // GET /api/usuarios/:id - solo admin o el mismo usuario
    async getUserById(req, res) {
        try {
            const { id } = req.params;

            // si no es admin, solo puede ver su propio usuario
            if (req.user.rol !== 'admin' && req.user.id !== parseInt(id)) {
                return res.status(403).json({ error: 'No tienes permisos para ver a este usuario' });
            }

            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            // obtener informacion de zona_rural si aplica
            let zonaInfo = null;
            if (user.zona_id) {
                zonaInfo = await ZonaRural.findById(user.zona_id);
            }

            res.json({
                ...user,
                zona: zonaInfo
            });

        } catch (error) {
            console.error('Error al obtener usuario por ID:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // PUT /api/usuarios - solo admin
    async createUser(req, res) {
        try {
            const { nombre, email, telefono, password, rol, zona_id } = req.body;

            // validaciones básicas
            if (!nombre || !email || !password) {
                return res.status(400).json({ error: 'Nombre, email y password son requeridos' });
            }

            // verificar si email ya existe
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return res.status(400).json({ error: 'El email ya está en uso' });
            }

            // crear nuevo usuario
            const userData = {
                nombre,
                email,
                telefono,
                password,
                rol: rol || 'lector',
                zona_id,
                activo: true
            };

            const newUser = await User.create(userData);

            // no devolver password_hash
            delete newUser.password_hash;

            res.status(201).json({
                message: 'Usuario creado exitosamente',
                user: newUser
            });

        } catch (error) {
            console.error('Error al crear usuario:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // PUT /api/usuarios/:id - solo admin o el mismo usuario
    async updateUser(req, res) {
        try {
            const { id } = req.params;

            // verificar permisos
            if (req.user.rol !== 'admin' && req.user.id !== parseInt(id)) {
                return res.status(403).json({ error: 'No tienes permisos para actualizar a este usuario' });
            }

            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            const { nombre, telefono, zona_id, activo } = req.body;

            // solo admin puede cambiar rol y estado activo
            const updateData = { nombre, telefono };
            if (req.user.rol === 'admin') {
                if (zona_id !== undefined) updateData.zona_id = zona_id;
                if (activo !== undefined) updateData.activo = activo;
            }

            const updatedUser = await User.update(id, updateData);

            // no devolver password_hash
            delete updatedUser.password_hash;

            res.json({
                message: 'Usuario actualizado exitosamente',
                user: updatedUser
            });

        } catch (error) {
            console.error('Error al actualizar usuario:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // DELETE /api/usuarios/:id - solo admin
    async deleteUser(req, res) {
        try {
            const { id } = req.params;

            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            // no permitir eliminarse a si mismo
            if (req.user.id === parseInt(id)) {
                return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
            }

            // en lugar de eliminar, marcar como inactivo
            await User.deactivateUser(id);

            res.json({ message: 'Usuario desactivado exitosamente' });

        } catch (error) {
            console.error('Error al eliminar usuario:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // GET /api/usuarios/:id/medidores - solo admin o el mismo usuario
    async getUserMedidores(req, res) {
        try {
            const { id } = req.params;

            // verificar permisos
            if (req.user.rol !== 'admin' && req.user.id !== parseInt(id)) {
                return res.status(403).json({ error: 'No tienes permisos para acceder a estos medidores' });
            }

            const medidores = await User.getMedidoresByUser(id);
            res.json(medidores);

        } catch (error) {
            console.error('Error al obtener medidores del usuario:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

}

module.exports = new UserController();