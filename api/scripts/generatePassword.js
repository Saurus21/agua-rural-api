const { hashPassword } = require('../src/utils/password');

const generateHashedPasswords = async () => {
  const passwords = ['admin123', 'lector123', 'password123']; // pruebas
  
  for (const password of passwords) {
    const hash = await hashPassword(password);
    console.log(`Password: ${password} -> Hash: ${hash}`);
  }
};

generateHashedPasswords().catch(console.error);

// Uso: node scripts/generatePassword.js