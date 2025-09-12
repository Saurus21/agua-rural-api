-- Tabla: ZonasRurales
CREATE TABLE ZonasRurales (
    zona_id SERIAL PRIMARY KEY,
    nombre_zona VARCHAR(100) NOT NULL,
    comuna VARCHAR(100),
    region VARCHAR(100)
);

-- Tabla: Usuarios
CREATE TABLE Usuarios (
    user_id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    telefono VARCHAR(20),
    zona_id INT REFERENCES ZonasRurales(zona_id)
);

-- Tabla: Medidores
CREATE TABLE Medidores (
    medidor_id SERIAL PRIMARY KEY,
    serial VARCHAR(50) NOT NULL,
    ubicacion TEXT,
    user_id INT REFERENCES Usuarios(user_id)
);

-- Tabla: Lecturas
CREATE TABLE Lecturas (
    lectura_id SERIAL PRIMARY KEY,
    medidor_id INT REFERENCES Medidores(medidor_id),
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valor NUMERIC(10,2),
    observacion TEXT
);

-- Tabla: Alertas
CREATE TABLE Alertas (
    alerta_id SERIAL PRIMARY KEY,
    lectura_id INT REFERENCES Lecturas(lectura_id),
    tipo VARCHAR(50),
    mensaje TEXT,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Reportes
CREATE TABLE Reportes (
    reporte_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Usuarios(user_id),
    fecha_generacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resumen TEXT
);