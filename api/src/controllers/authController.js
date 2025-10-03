const db = require('../config/database');
const { generateToken } = require('../utils/jwt');
const { comparePassword } = require('../utils/password');
const { hashPassword } = require('../utils/password');
const { validationResult } = require('express-validator');

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // validar campos requeridos
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y password son requeridos' });
    }

    // buscar usuario por email
    const userResult = await db.query(
      'SELECT user_id, nombre, email, password_hash, rol, activo FROM Usuarios WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = userResult.rows[0];

    // verificar si el usuario esta activo
    if (!user.activo) {
      return res.status(401).json({ error: 'Usuario inactivo' });
    }

    // verificar password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // generar token JWT
    const token = generateToken(user.user_id, user.email, user.rol);

    // registrar login exitoso (opcional)
    await db.query(
      'UPDATE Usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [user.user_id]
    );

    // devolver respuesta exitosa
    res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.user_id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const verify = async (req, res) => {
  try {
    // middleware auth ya valido el token y agrego user a req
    res.json({
      valid: true,
      user: req.user
    });
  } catch (error) {
    res.status(401).json({ 
      valid: false, 
      error: 'Token inválido' 
    });
  }
};

const changePassword = async (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { currentPassword, newPassword } = req.body;
  const userId = req.user.userId;

  try {
    // verificar password actual
    const userResult = await db.query(
      'SELECT password_hash FROM Usuarios WHERE user_id = $1',
      [userId]
    );

    const isCurrentPasswordValid = await comparePassword(
      currentPassword, 
      userResult.rows[0].password_hash
    );

    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Password actual incorrecto' });
    }

    // hashear nuevo password
    const newPasswordHash = await hashPassword(newPassword);

    // actualizar password
    await db.query(
      'UPDATE Usuarios SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [newPasswordHash, userId]
    );

    res.json({ message: 'Password actualizado exitosamente' });

  } catch (error) {
    console.error('Error al cambiar password:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  login,
  verify,
  changePassword
};