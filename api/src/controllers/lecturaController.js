const { Lectura, Medidor, Alerta } = require('../models');

class LecturaController {

    // GET api/lecturas
    async getLecturas(req, res) {
        try {
            const {
                page = 1,
                limit = 20,
                medidor_id,
                start_date,
                end_date,
                sincronizado
            } = req.query;

            const offset = (page - 1) * limit;

            let conditions = {};
            if (medidor_id) conditions.medidor_id = medidor_id;
            if (sincronizado !== undefined) conditions.sincronizado = sincronizado === 'true';

            // filtrar por fecha si se proporciona
            let dateCondition = '';
            const values = [];
            let paramCount = 0;

            if (start_date || end_date) {
                dateCondition = 'AND';
                if (start_date) {
                    paramCount++;
                    dateCondition += `l.fecha >= $${paramCount} `;
                    values.push(start_date);
                }
                if (end_date) {
                    if (start_date) dateCondition += 'AND';
                    paramCount++;
                    dateCondition += `l.fecha <= $${paramCount} `;
                    values.push(end_date);
                }
            }

            // sino es admin, solo puede ver lecturas de sus medidores
            let userCondition = '';
            if (req.user.rol !== 'admin') {
                paramCount++;
                userCondition = `AND m.user_id = $${paramCount} `;
                values.push(req.user.userId);
            }

            const sql = `
                SELECT l.* , m.serial as medidor_serial, u.nombre as usuario_nombre
                FROM lecturas l
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                LEFT JOIN usuarios u ON m.user_id = u.user_id
                WHERE 1=1 ${Object.keys(conditions).map((key, idx) => {
                    paramCount++;
                    values.push(conditions[key]);
                    return `AND l.${key} = $${paramCount}`;
                        
                }).join(' ')} ${userCondition} ${dateCondition}
                ORDER BY l.fecha DESC
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;

            values.push(parseInt(limit), offset);
            
            const result = await Lectura.query(sql, values);
            const lecturas = result.rows;

            // obtener total para la paginacion
            const countSql = `
                SELECT COUNT(*)
                FROM lecturas l
                LEFT JOIN medidores m ON l.medidor_id = m.medidor_id
                WHERE 1=1 ${Object.keys(conditions).map((key, idx) => {
                    return `AND l.${key} = $${idx + 1}`;
                }).join(' ')} ${userCondition} ${dateCondition}
            `;

            const countValues = [
                ...Object.values(conditions),
                ...(req.user.rol !== 'admin' ? [req.user.userId] : []),
                ...(start_date ? [start_date] : []),
                ...(end_date ? [end_date] : [])
            ];

            const countResult = await Lectura.query(countSql, countValues);
            const total = parseInt(countResult.rows[0].count);

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
            console.error('Error obteniendo lecturas:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // POST /api/lecturas
    async createLectura(req, res) {
        try {
            const { medidor_id, valor, observacion, latitud, longitud } = req.body;

            // validaciones
            if (!medidor_id || valor === undefined) {
                return res.status(400).json({ error: 'Medidor ID y valor son requeridos' });
            }

            if (valor < 0) {
                return res.status(400).json({ error: 'El valor no puede ser negativo' });
            }

            // verificar que el medidor existe y tiene permisos
            const medidor = await Medidor.findById(medidor_id);
            if (!medidor) {
                return res.status(404).json({ error: 'Medidor no encontrado' });
            }

            if (req.user.rol !== 'admin' && req.user.userId !== medidor.user_id) {
                return res.status(403).json({ error: 'No tienes permisos para crear lecturas en este medidor' });
            }

            const lecturaData = {
                medidor_id,
                valor: parseFloat(valor),
                observacion,
                latitud: latitud ? parseFloat(latitud) : null,
                longitud: longitud ? parseFloat(longitud) : null,
                sincronizado: true // se asume que viene de fuente online
            };

            const nuevaLectura = await Lectura.create(lecturaData);

            // verifica si genera alguna alerta
            await this.verificarAlertas(nuevaLectura);

            res.status(201).json({
                message: 'Lectura creada exitosamente',
                lectura: nuevaLectura
            });

        } catch (error) {
            console.error('Error creando lectura:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // metodo para verificar alertas automaticas
    async verificarAlertas(lectura) {
        try {
            // obtener lecturas anteriores para comparar
            const lecturasAnteriores = await Lectura.getLecturasByMedidor(lectura.medidor_id, 5);

            // alertas basicas
            const alertas = [];

            // alerta por consumo muy alto > 1000
            if (lectura.valor > 1000) {
                alertas.push({
                    lectura_id: lectura.lectura_id,
                    tipo: 'consumo_alto',
                    mensaje: `Consumo anormalmente alto: ${lectura.valor}`
                });
            }

            // alerta por consumo cero 0, posible medidor dañado
            if (lectura .valor === 0 && lecturasAnteriores.length > 0) {
                const promedioAnterior = lecturasAnteriores.reduce((sum, l) => sum + l.valor, 0) / lecturasAnteriores.length;
                if (promedioAnterior > 10) {
                    alertas.push({
                        lectura_id: lectura.lectura_id,
                        tipo: 'consumo__cero',
                        mensaje: 'Consumo cero detectado - posible falla en el medidor'
                    });
                }
            }

            // alerta por variacion brusca > 50% del promedio
            if (lecturasAnteriores >= 3) {
                const promedio = lecturasAnteriores.reduce((sum, l) => sum + l.valor, 0) / lecturasAnteriores.length;
                const variacion = Math.abs((lectura.valor - promedio) / promedio);

                if (variacion > 0.5) {
                    alertas.push({
                        lectura_id: lectura.lectura_id,
                        tipo: 'variacion_brusca',
                        mensaje: `Variación del ${Math.round(variacion * 100)}% detectada`
                    });
                }
            }

            // crear alertas
            for (const alertaData of alertas) {
                await Alerta.create(alertaData);
            }

        } catch (error) {
            console.error('Error verificando alertas:', error);
        }
    }

    // POST /api/lecturas/sincronizar - para sincronizacion offline
    async sincronizarLecturas(req, res) {
        try {
            const { lecturas } = req.body;

            if (!Array.isArray(lecturas)) {
                return res.status(400).json({ error: 'Se requiere un array de lecturas' });
            }

            const resultados = {
                exitosas: 0,
                fallidas: 0,
                detalles: []
            };

            for (const lecturaData of lecturas) {
                try {
                    //verificar permisos por cada lectura
                    const medidor = await Medidor.findById(lecturaData.medidor_id);
                    if (!medidor) {
                        resultados.fallidas++;
                        resultados.detalles.push({
                            lectura: lecturaData,
                            error: 'Medidor no encontrado'
                        });
                        continue;
                    }

                    if (req.user.rol !== 'admin' && req.user.userId !== medidor.user_id) {
                        resultados.fallidas++;
                        resultados.detalles.push({
                            lectura: lecturaData,
                            error: 'Sin permisos para este medidor'
                        });
                        continue;
                    }

                    // marcar como sincronizada
                    lecturaData.sincronizado = true;
                    const lectura = await Lectura.create(lecturaData);

                    // verificar alertas
                    await this.verificarAlertas(lectura);

                    resultados.exitosas++;
                    resultados.detalles.push({
                        lectura: lectura,
                        estado: 'sincronizada'
                    });


                } catch (error) {
                    resultados.fallidas++;
                    resultados.detalles.push({
                        lectura: lecturaData,
                        error: error.message
                    });
                }
            }

            res.json({
                message: `Sincronización completada: ${resultados.exitosas} exitosas, ${resultados.fallidas} fallidas`,
                ...resultados
            });

        } catch (error) {
            console.error('Error sincronizando lecturas', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
}

module.exports = new LecturaController();