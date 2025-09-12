const request = require('supertest');
const app = require('../app');

describe('API Endpoints', () => {
    it('deberia responder en el endpoint de health check', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('status');
        expect(res.body.status).toBe('API funcionando correctamente');
    });

    it('deberia manejar rutas no encontradas', async () => {
        const res = await request(app).get('/api/ruta-inexistente');
        expect(res.statusCode).toEqual(404);
        expect(res.body).toHaveProperty('error');
        
    });
});
