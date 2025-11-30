const { parse } = require('dotenv');
const { Medidor, User, Lectura, ZonaRural } = require('../models');
const { idColumn } = require('../models/User');
const { compare } = require('bcryptjs');

class MedidorController {

    // GET /api/medidores
    async getMedidores(req, res) {
        try {
            const { page = 1, limit = 10, user_id, activo, serial } = req.query;
            const offset = (page - 1) * limit;

            let conditions = {};
            if (user_id) conditions.user_id = user_id;
            if (activo !== undefined) conditions.activo = activo === 'true';
            if (serial) conditions.serial = { $like: `%${serial}%` };

            // si no es admin, solo ver sus propios medidores
            if (req.user.rol !== 'admin' && !user_id) {
                conditions.user_id = req.user.userId;
            }

            const medidores = await Medidor.findAll(conditions, parseInt(limit), offset);
            const total = await Medidor.count(conditions);

            // enriquecer con informacion del usuario
            const medidoresWithUser = await Promise.all(
                medidores.map(async (medidor) => {
                    let userInfo = null;
                    let userObj = null;

                    try {
                        const userIdRef = medidor.user_id || medidor.userId;
                        if (userIdRef) {
                            userObj = await User.findById(userIdRef);

                            if (userObj) {
                                let zonaInfo = null;

                                if (typeof ZonaRural !== 'undefined' && userObj.zona_id) {
                                    try {
                                        const zona = await ZonaRural.findById(userObj.zona_id);
                                        if (zona) {
                                            zonaInfo = {
                                                zona_id: zona.zona_id,
                                                nombre_zona: zona.nombre_zona,
                                            };
                                        }
                                    } catch (e) {
                                        console.warn('No se pudo cargar la zona:', e.message);
                                    }
                                }

                                userInfo = {
                                    user_id: userObj.user_id,
                                    nombre: userObj.nombre,
                                    email: userObj.email,
                                    zona: zonaInfo
                                };
                            }
                        }

                    } catch (error) {
                        console.error(`Error cargando usuario para medidor ${medidor.medidor_id}:`, error.message);                   
                    }
                    
                    // obtener ultima lectura
                    const ultimaLectura = await Lectura.getUltimaLectura(medidor.medidor_id);

                    // obtener total de lecturas
                    const totalLecturas = await Lectura.count({ medidor_id: medidor.medidor_id });

                    return {
                        ...medidor,
                        usuario: userInfo,
                        ultima_lectura: ultimaLectura,
                        total_lecturas_conteo: parseInt(totalLecturas)
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
            if (req.user.rol !== 'admin' && req.user.userId !== medidor.user_id) {
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
            if (req.user.rol !== 'admin') {
                // lectores solo pueden asignarse a si mismos
                assignedUserId = req.user.userId;
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
            if (req.user.rol !== 'admin' && String(req.user.userId) !== String(medidor.user_id)) {
                return res.status(403).json({ error: 'No tienes permisos para actualizar este medidor' });
            }

            const { serial, ubicacion, user_id, activo } = req.body;

            const updateData = {};
            if (serial) updateData.serial = serial;
            if (ubicacion) updateData.ubicacion = ubicacion;

            // permitir cambiar estado
            if (activo !== undefined) {
                updateData.activo = activo;
            }

            // solo admin puede cambiar el usuario asignado
            if (req.user.rol === 'admin' && user_id !== undefined) {
                updateData.user_id = user_id;
            }

            console.log('DATOS PROCESADOS PARA UPDATE:', updateData);

            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({ 
                    error: 'No se enviaron datos válidos para actualizar.',
                    recibido: req.body 
                });
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

    // GET api/medidores/resumen - estadísticas para dashboard
    async getResumen(req, res) {
        try {
            const total = await Medidor.count({});
            const activos = await Medidor.count({ activo: true });
            const inactivos = await Medidor.count({ activo: false });

            const ultimaLecturaResult = await Lectura.query(
                'SELECT fecha FROM lecturas ORDER BY fecha DESC LIMIT 1',
                []
            );

            const ultimaFecha = ultimaLecturaResult.rows.length > 0
                ? ultimaLecturaResult.rows[0].fecha
                : null;

            res.json({
                total_medidores: parseInt(total),
                medidores_activos: parseInt(activos),
                medidores_inactivos: parseInt(inactivos),
                ultima_lectura_fecha: ultimaFecha
            });

        } catch (error) {
            console.error('Error obteniendo resumen de medidores:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
}

module.exports = new MedidorController();