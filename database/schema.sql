-- Crear base de datos (ejecutar primero en psql o pgAdmin)
-- CREATE DATABASE rural_data_db;

-- Tabla: ZonasRurales
CREATE TABLE IF NOT EXISTS ZonasRurales (
    zona_id SERIAL PRIMARY KEY,
    nombre_zona VARCHAR(100) NOT NULL,
    comuna VARCHAR(100),
    region VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Usuarios
CREATE TABLE IF NOT EXISTS Usuarios (
    user_id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    telefono VARCHAR(20),
    password_hash VARCHAR(255), -- para autenticacion
    rol VARCHAR(20) DEFAULT 'lector', -- roles: admin, lector
    zona_id INT REFERENCES ZonasRurales(zona_id),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Medidores
CREATE TABLE IF NOT EXISTS Medidores (
    medidor_id SERIAL PRIMARY KEY,
    serial VARCHAR(50) NOT NULL UNIQUE,
    ubicacion TEXT,
    user_id INT REFERENCES Usuarios(user_id),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Lecturas
CREATE TABLE IF NOT EXISTS Lecturas (
    lectura_id SERIAL PRIMARY KEY,
    medidor_id INT REFERENCES Medidores(medidor_id),
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valor NUMERIC(10,2) NOT NULL CHECK (valor >= 0),
    observacion TEXT,
    latitud DECIMAL(10, 8),
    longitud DECIMAL(11, 8),
    sincronizado BOOLEAN DEFAULT FALSE, -- para funcionalidad offline
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Alertas
CREATE TABLE IF NOT EXISTS Alertas (
    alerta_id SERIAL PRIMARY KEY,
    lectura_id INT REFERENCES Lecturas(lectura_id),
    tipo VARCHAR(50) NOT NULL, -- fuga, consumo_alto, etc.
    mensaje TEXT,
    resuelta BOOLEAN DEFAULT FALSE,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Reportes
CREATE TABLE IF NOT EXISTS Reportes (
    reporte_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Usuarios(user_id),
    tipo_reporte VARCHAR(50) NOT NULL,
    parametros JSONB, -- parametros del reporte
    fecha_generacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resumen TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_lecturas_medidor_id ON Lecturas(medidor_id);
CREATE INDEX IF NOT EXISTS idx_lecturas_fecha ON Lecturas(fecha);
CREATE INDEX IF NOT EXISTS idx_lecturas_sincronizado ON Lecturas(sincronizado);
CREATE INDEX IF NOT EXISTS idx_alertas_lectura_id ON Alertas(lectura_id);
CREATE INDEX IF NOT EXISTS idx_medidores_serial ON Medidores(serial);