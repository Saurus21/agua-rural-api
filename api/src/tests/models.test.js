const {
    User,
    Medidor,
    Lectura,
    Alerta,
    Reporte,
    ZonaRural
} = require('../models');

describe('Model Tests', () => {
  it('debería encontrar usuario por email', async () => {
    const user = await User.findByEmail('lector@ruraldata.cl');
    expect(user).toBeDefined();
    expect(user.email).toBe('lector@ruraldata.cl');
  });

  it('debería encontrar medidor por serial', async () => {
    const medidor = await Medidor.findBySerial('MED-001');
    expect(medidor).toBeDefined();
    expect(medidor.serial).toBe('MED-001');
  });

  it('debería obtener todas las zonas rurales', async () => {
    const zonas = await ZonaRural.findAll();
    expect(zonas).toBeDefined();
    expect(Array.isArray(zonas)).toBe(true);
  });

  it('debería crear una nueva lectura', async () => {
    const lecturaData = {
      medidor_id: 1,
      valor: 150.5,
      observacion: 'Lectura de prueba'
    };

    const lectura = await Lectura.create(lecturaData);
    expect(lectura).toBeDefined();
    // postgre devuelve NUMERIC como string
    // se usa toBeCloseTo para comparar numeros flotantes
    // el segundo parametro es la precision (1 decimal)
    expect(parseFloat(lectura.valor)).toBeCloseTo(150.5, 1);
  });
});