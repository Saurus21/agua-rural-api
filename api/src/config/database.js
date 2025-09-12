const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

// manejar errores de conexion
pool.on('error', (err) => {
    console.error('Error inesperado en la conexion a la base de datos', err);
    process.exit(-1);
});

// funcion para probar la conexion
const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('Conexion a la base de datos exitosa');
        client.release();
        return true;
    } catch (err) {
        console.error('Error al conectar a la base de datos', err.message);
        return false;
    }
};

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
    testConnection
};