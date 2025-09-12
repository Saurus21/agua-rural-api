const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

// rutas
const lecturasRouter = require('./routes/lecturas');
app.use('/api/lecturas', lecturasRouter);

// rutas basicas
app.get('/api/health', (req, res) => {
  res.json({ status: 'API funcionando correctamente', timestamp: new Date() });
});

// manejador de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});

module.exports = app;