const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const authRoutes = require('./routes/auth');

// middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// rutas
const lecturasRouter = require('./routes/lecturas');
const { testConnection } = require('./config/database');
const { authenticateToken } = require('./middleware/auth');
app.use('/api/lecturas', lecturasRouter);
app.use('/api/auth', authRoutes);

// rutas de api primero

// rutas de health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'API funcionando correctamente',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

// ruta para verificar conexion a la base de datos
app.get('/api/health/db', async (req, res) => {
    try {
        const isConnected = await testConnection();
        if (isConnected) {
            res.json({ status: 'Conexión a la base de datos exitosa' });
        } else {
            res.status(500).json({ status: 'Error al conectar a la base de datos' });
        }
    } catch (error) {
        console.error('Error al verificar la conexión a la base de datos:', error);
        res.status(500).json({ status: 'Error al verificar la conexión a la base de datos' });
    }
});

app.get('/api/protected', authenticateToken, (req, res) => {
    res.json({
      message: 'Acceso concedido a ruta protegida',
      user: req.user
    });
});


// servir archivos estáticos (si es necesario)
app.use(express.static(path.join(__dirname, '../public')));

// ruta para servir formulario de login
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

// ruta para dashboard (después de login)
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});



// manejo de rutas no encontradas
app.use('/*path', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// manejador de errores globales
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Error interno del servidor',
    message : process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor'
  });
});

// iniciar el servidor solo si no estamos en modo test
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, async () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
    console.log(`Archivos estáticos en: ${path.join(__dirname, '../public')}`);
    console.log(`Entorno: ${process.env.NODE_ENV}`);

    // probar la conexion a la base de datos al iniciar el servidor
    await testConnection();
  });
}

module.exports = app;