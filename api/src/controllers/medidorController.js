const { parse } = require('dotenv');
const { Medidor, User, Lectura } = require('../models');
const { idColumn } = require('../models/User');
const { compare } = require('bcryptjs');

class MedidorController {

    // GET /api/medidores
    async getMedidores(req, res) {
        try {
            const { page = 1, limit = 10, user_id, activo, serial } = req.query;
            const offset = (page - 1) * limit;

            let conditions = {};
            if (user_id) conditions.userId = user_id;
            if (activo !== undefined) conditions.activo = activo === 'true';
            if (serial) conditions.serialNumber = { $like: `%${serial}%` };

            // si no es admin, solo ver sus propios medidores
            if (req.user.role !== 'admin' && !user_id) {
                conditions.userId = req.user.id;
            }

            const medidores = await Medidor.findAll(conditions, parseInt(limit), offset);
            const total = await Medidor.count(conditions);

            // enriquecer con informacion del usuario
            const medidoresWithUser = await Promise.all(
                medidores.map(async (medidor) => {
                    let userInfo = null;
                    if (medidor.userId) {
                        userInfo = await User.findById(medidor.userId);
                        // no enviar informacion sensible
                        if (userInfo) {
                            userInfo = {
                                user_id: userInfo.user_id,
                                nombre: userInfo.nombre,
                                email: userInfo.email
                            };
                        }
                    }

                    // obtener ultima lectura
                    const ultimaLectura = await Lectura.getUltimaLectura(medidor.medidor_id);

                    return {
                        ...medidor,
                        usuario: userInfo,
                        ultima_lectura: ultimaLectura
                    };
                })
            );
        
            res.json({
                medidores: medidoresWithUser,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('Error fetching medidores:', error);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // GET /api/medidores/:id
    async getMedidorById(req, res) {
        try {
            const { id } = req.params;

            const medidor = await Medidor.findById(id);
            if (!medidor) {
                return res.status(404).json({ error: 'Medidor no encontrado' });
            }

            // verificar permisos (admin o propietario)
            if (req.user.role !== 'admin' && req.user.userId !== medidor.userId) {
                return res.status(403).json({ error: 'No tienes permisos para acceder a este medidor' });
            }

            // obtener informacion del usuario
            let userInfo = null;
            if (medidor.user_id) {
                userInfo = await User.findById(medidor.user_id);
                if (userInfo) {
                    userInfo = {
                        user_id: userInfo.user_id,
                        nombre: userInfo.nombre,
                        email: userInfo.email
                    };
                }
            }

            // obtener ultima lectura
            const lecturas = await Lectura.getLecturasByMedidor(id, 10);

            res.json({
                ...medidor,
                usuario: userInfo,
                ultimas_lecturas: lecturas
            });
            
        } catch (error) {
        console.error('Error obteniendo medidor:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
        }
    }


    // POST /api/medidores - solo admin puede crear medidores para otros usuarios
    async createMedidor(req, res) {
        try {
        const { serial, ubicacion, user_id } = req.body;

            // validaciones
            if (!serial || !ubicacion) {
                return res.status(400).json({ error: 'Serial y ubicacion son requeridos' });
            }

            // verificar si el serial ya existe
            const existingMedidor = await Medidor.findBySerial(serial);
            if (existingMedidor) {
                return res.status(400).json({ error: 'Ya existe un medidor con ese serial' });
            }

            // determinar user_id
            let assignedUserId = user_id;
            if (req.user.role !== 'admin') {
                // lectores solo pueden asignarse a si mismos
                assignedUserId = req.user.id;
            }

            // verificar que el usuario asignado exista
            if (assignedUserId) {
                const user = await User.findById(assignedUserId);
                if (!user) {
                    return res.status(404).json({ error: 'Usuario no encontrado' });
                }
            }

            const medidorData = {
                serial,
                ubicacion,
                user_id: assignedUserId,
                activo: true
            };

            const newMedidor = await Medidor.create(medidorData);

            res.status(201).json({
                message: 'Medidor creado exitosamente',
                medidor: newMedidor
            });

        } catch (error) {
        console.error('Error creando medidor:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // PUT /api/medidores/:id
    async updateMedidor(req, res) {
        try {
            const { id } = req.params;

            const medidor = await Medidor.findById(id);
            if (!medidor) {
                return res.status(404).json({ error: 'Medidor no encontrado' });
            }

            // verificar permisos (admin o propietario)
            if (req.user.role !== 'admin' && req.user.userId !== medidor.userId) {
                return res.status(403).json({ error: 'No tienes permisos para actualizar este medidor' });
            }

            const { serial, ubicacion, user_id } = req.body;

            const updateData = {};
            if (serial) updateData.serial = serial;
            if (ubicacion) updateData.ubicacion = ubicacion;

            // solo admin puede cambiar el usuario asignado
            if (req.user.rol === 'admin' && user_id !== undefined) {
                updateData.user_id = user_id;
            }

            const updatedMedidor = await Medidor.update(id, updateData);

            res.json({
                message: 'Medidor actualizado exitosamente',
                medidor: updatedMedidor
            });

        } catch (error) {
            console.error('Error actualizando medidor:', error);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // DELETE api/medidores/:id
    async deleteMedidor(req, res) {
        try {
            const { id } = req.params;

            const medidor = await Medidor.findById(id);
            if (!medidor) {
                return res.status(404).json({ error: 'Medidor no encontrado' });
            }

            // verificar permisos (admin o dueño del medidor)
            if (req.user.rol !== 'admin' && req.user.userId !== medidor.user_id) {
                return res.status(403).json({ error: 'No tienes permisos para eliminar este medidor' });
            }

            // en vez de eliminar, marcar como inactivo
            await Medidor.deactivateMedidor(id);

            res.json({ message: 'Medidor desactivado exitosamente' });

        } catch (error) {
            console.error('Error eliminando medidor:', error);
            res.status(500).json({ error: 'Error interno del servidor' });

        }
    }


    // GET api/medidores/:id/lecturas
    async getMedidorLecturas(req, res) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;

            const medidor = await Medidor.findById(id);
            if (!medidor) {
                return res.status(403).json({ error: 'Medidor no encontrado' })
            }

            // verificar permisos (admin o dueño del medidor)
            if (req.user.rol !== 'admin' && req.user.userId !== medidor.user_id) {
                return res.status(403).json({ error: 'No tienes permisos para ver estas lecturas' });
            }

            const lecturas = await Lectura.getLecturasByMedidor(id, parseInt(limit), offset);
            const total = await Lectura.count({ medidor_id: id });

            res.json({
                lecturas,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('Error obteniendo lecturas del medidor:', error);
            res.status(500).json({ error: 'Error interno del servidor' }); 
        }
    }
}

module.exports = new MedidorController();