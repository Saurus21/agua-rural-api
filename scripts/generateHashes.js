const bcrypt = require('bcryptjs');

const generateHashes = async () => {
    const passwords = ['admin123', 'lector123', 'password123']; // ejemplos de passwords

    for (const password of passwords) {
        const hash = await bcrypt.hash(password,12);

        console.log(`Password: ${password}`);
        console.log(`Hash: ${hash}`);
        console.log('---');
    }
};

generateHashes();