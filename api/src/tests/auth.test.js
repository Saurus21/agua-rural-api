const request = require('supertest');
const app = require('../app');
const db = require('../config/database');

const { User } = require('../models');

describe('Auth Endpoints', () => {
  let testUserId;

  beforeAll(async () => {
    // primero verificar si el usuario inactivo ya existe y eliminarlo
    const existingUsers = await User.findAll({ email: 'inactivo@test.com' });
    for (const user of existingUsers) {
      await User.delete(user.user_id);
    }
    // despues, crear un usuario inactivo para las pruebas
    const userInactivo = await User.create({
      nombre: 'Usuario Inactivo Test',
      email: 'inactivo@test.com',
      password: 'test123',
      rol: 'lector',
      activo: false,
      zona_id: 1
    });
    testUserId = userInactivo.user_id;
  });

  afterAll(async () => {
    // limpiar el usuario de prueba
    if (testUserId) {
      await User.delete(testUserId);
    }
  });

  it('debería fallar login con credenciales inválidas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'noexiste@test.com',
        password: 'wrongpassword'
      });
    
    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('error');
  });

  it('debería hacer login exitoso con credenciales válidas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'lector@ruraldata.cl',
        password: 'lector123'
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('email', 'lector@ruraldata.cl');
  });

  it('debería verificar un token válido', async () => {
    // primero obtener un token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'lector@ruraldata.cl',
        password: 'lector123'
      });
    
    const token = loginRes.body.token;

    // verificar el token
    const verifyRes = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${token}`);
    
    expect(verifyRes.statusCode).toEqual(200);
    expect(verifyRes.body).toHaveProperty('valid', true);
  });

  it('debería fallar el login si el usuario está inactivo', async () => {
    // solo ejecutar esta prueba si tenemos un usuario inactivo
    if (!testUserId) {
      console.log('⚠️  Saltando prueba de usuario inactivo - no se pudo crear usuario de prueba');
      return;
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'inactivo@test.com',
        password: 'test123'
      });
    
    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('error', 'Usuario inactivo');
  });

  it('debería rechazar la verificación con un token inválido', async () => {
    const invalidtoken = 'un.token.falso';
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${invalidtoken}`); 

    expect(res.statusCode).toEqual(403);
    expect(res.body.error).toMatch(/Token inválido o expirado/);
  });

});