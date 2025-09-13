const request = require('supertest');
const app = require('../app');
const db = require('../config/database');

describe('Auth Endpoints', () => {
  beforeAll(async () => {
    // esperar a que la base de datos este conectada
    await db.testConnection();
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
});