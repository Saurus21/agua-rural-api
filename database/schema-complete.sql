-- Crear usuario si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'rural_app_user') THEN
        CREATE USER rural_app_user WITH PASSWORD 'password_seguro_123';
    END IF;
END
$$;

-- Crear base de datos si no existe
SELECT 'CREATE DATABASE rural_data_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rural_data_db')\gexec

-- Conectarse a la base de datos (ejecutar manualmente en pgAdmin)
-- \c rural_data_db

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
    password_hash VARCHAR(255),
    rol VARCHAR(20) DEFAULT 'lector',
    activo BOOLEAN DEFAULT TRUE,
    ultimo_login TIMESTAMP,
    zona_id INT REFERENCES ZonasRurales(zona_id),
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
    sincronizado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Alertas
CREATE TABLE IF NOT EXISTS Alertas (
    alerta_id SERIAL PRIMARY KEY,
    lectura_id INT REFERENCES Lecturas(lectura_id),
    tipo VARCHAR(50) NOT NULL,
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
    parametros JSONB,
    fecha_generacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resumen TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lecturas_medidor_id ON Lecturas(medidor_id);
CREATE INDEX IF NOT EXISTS idx_lecturas_fecha ON Lecturas(fecha);
CREATE INDEX IF NOT EXISTS idx_lecturas_sincronizado ON Lecturas(sincronizado);
CREATE INDEX IF NOT EXISTS idx_alertas_lectura_id ON Alertas(lectura_id);
CREATE INDEX IF NOT EXISTS idx_medidores_serial ON Medidores(serial);

-- CONCEDER PERMISOS
GRANT CONNECT ON DATABASE rural_data_db TO rural_app_user;

GRANT USAGE ON SCHEMA public TO rural_app_user;

-- Permisos en tablas
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rural_app_user;

-- Permisos en secuencias
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rural_app_user;

-- Permisos para futuras tablas
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL PRIVILEGES ON TABLES TO rural_app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL PRIVILEGES ON SEQUENCES TO rural_app_user;

-- Insertar datos de prueba
INSERT INTO ZonasRurales (nombre_zona, comuna, region) VALUES
('Valle Central', 'Pirque', 'Metropolitana'),
('Zona Sur', 'Paine', 'Metropolitana')
ON CONFLICT DO NOTHING;

-- Insertar usuarios de prueba (passwords: admin123 y lector123)
INSERT INTO Usuarios (nombre, email, telefono, password_hash, rol, zona_id) VALUES
('Administrador', 'admin@ruraldata.cl', '+56912345678', '$2b$12$ewaxIm778m9pgXm1ZWExeOazbT7X2sb6AEYeiQC9VVbCrOoBHdQsa', 'admin', 1),
('Lector Ejemplo', 'lector@ruraldata.cl', '+56987654321', '$2b$12$AxelCIOagdWbT7fqB64daezL.L59WDMDKHaIMX8YJ91XAdpP6h8n.', 'lector', 2)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    updated_at = CURRENT_TIMESTAMP;

-- Insertar medidores de prueba
INSERT INTO Medidores (serial, ubicacion, user_id) VALUES
('MED-001', 'Casa principal, Valle Central', 2),
('MED-002', 'Poste de luz, Zona Sur', 2),
('MED-003', 'Estación de bombeo', 2)
ON CONFLICT (serial) DO NOTHING;