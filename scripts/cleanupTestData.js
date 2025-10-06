const { User } = require('../api/src/models');

const cleanupTestData = async () => {
  try {
    console.log('🧹 Limpiando datos de prueba...');
    
    // Eliminar usuarios de prueba
    const testUsers = await User.findAll({ email: 'inactivo@test.com' });
    for (const user of testUsers) {
      await User.delete(user.user_id);
      console.log(`✅ Usuario eliminado: ${user.email}`);
    }
    
    console.log('✅ Limpieza completada');
  } catch (error) {
    console.error('❌ Error en limpieza:', error);
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  cleanupTestData();
}

module.exports = cleanupTestData;