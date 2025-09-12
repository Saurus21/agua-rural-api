const request = require('supertest');
const app = require('../src/app');

describe('API Endpoints', () => {
    it('GET /api/health - should return API status', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('status', 'API funcionando correctamente');
        expect(res.body).toHaveProperty('timestamp');
    });
});
