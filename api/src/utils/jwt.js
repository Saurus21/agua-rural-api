const jwt = require('jsonwebtoken');
require('dotenv').config();

const generateToken = (userId, email, rol) => {
  return jwt.sign(
    { 
      userId, 
      email, 
      rol,
      iss: 'rural-data-api',
      aud: 'rural-data-app'
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      algorithm: 'HS256'
    }
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'rural-data-api',
      audience: 'rural-data-app'
    });
  } catch (error) {
    throw new Error('Token inválido o expirado');
  }
};

const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateToken,
  verifyToken,
  decodeToken
};