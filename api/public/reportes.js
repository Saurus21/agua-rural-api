class ReportesManager {
    constructor() {
        this.apiBaseUrl = window.location.origin + '/api';
        this.token = localStorage.getItem('authToken');
        this.init();
    }

    init() {
        this.checkAuthentication();
        this.cargarZonas();
        this.cargarHistorialReportes();
        this.setupEventListeners();
    }

    checkAuthentication() {
        if (!this.token) {
            alert('No estás autenticado. Redirigiendo al login...');
            window.location.href = '/login';
            return;
        }
    }

    async cargarZonas() {
        try {
            const userData = JSON.parse(localStorage.getItem('userData'));
            if (userData.rol !== 'admin') return;

            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/dashboard/consumo-por-zona`);
            if (response && response.ok) {
                const data = await response.json();
                this.mostrarZonas(data);
            }
        } catch (error) {
            console.error('Error cargando zonas:', error);
        }
    }

    mostrarZonas(zonas) {
        const selectConsumo = document.getElementById('consumoZona');
        selectConsumo.innerHTML = '<option value="">Todas las zonas</option>';
        
        zonas.forEach(zona => {
            const option = document.createElement('option');
            option.value = zona.zona_id;
            option.textContent = zona.nombre_zona;
            selectConsumo.appendChild(option);
        });
    }

    async generarReporteConsumo() {
        try {
            const fechaInicio = document.getElementById('consumoFechaInicio').value;
            const fechaFin = document.getElementById('consumoFechaFin').value;
            const zonaId = document.getElementById('consumoZona').value;
            const formato = document.getElementById('consumoFormato').value;

            if (!fechaInicio || !fechaFin) {
                alert('Por favor, completa las fechas de inicio y fin');
                return;
            }

            const reporteData = {
                start_date: fechaInicio,
                end_date: fechaFin,
                zona_id: zonaId || undefined,
                formato: formato
            };

            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/reportes/consumo`, {
                method: 'POST',
                body: JSON.stringify(reporteData)
            });

            if (response && response.ok) {
                const data = await response.json();
                this.mostrarResultadosConsumo(data, formato);
                this.cargarHistorialReportes(); // recargar historial
            } else {
                throw new Error('Error generando reporte');
            }
        } catch (error) {
            console.error('Error generando reporte de consumo:', error);
            alert('Error al generar el reporte: ' + error.message);
        }
    }

    async generarReporteAlertas() {
        try {
            const fechaInicio = document.getElementById('alertasFechaInicio').value;
            const fechaFin = document.getElementById('alertasFechaFin').value;
            const tipo = document.getElementById('alertasTipo').value;

            if (!fechaInicio || !fechaFin) {
                alert('Por favor, completa las fechas de inicio y fin');
                return;
            }

            const reporteData = {
                start_date: fechaInicio,
                end_date: fechaFin,
                tipo: tipo || undefined
            };

            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/reportes/alertas`, {
                method: 'POST',
                body: JSON.stringify(reporteData)
            });

            if (response && response.ok) {
                const data = await response.json();
                this.mostrarResultadosAlertas(data);
                this.cargarHistorialReportes(); // recargar historial
            } else {
                throw new Error('Error generando reporte');
            }
        } catch (error) {
            console.error('Error generando reporte de alertas:', error);
            alert('Error al generar el reporte: ' + error.message);
        }
    }

    mostrarResultadosConsumo(data, formato) {
        const resultsSection = document.getElementById('resultsSection');
        const resultsContent = document.getElementById('resultsContent');
        
        resultsSection.style.display = 'block';

        if (formato === 'csv') {
            resultsContent.innerHTML = `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                    <h4>Reporte CSV Generado</h4>
                    <p>Nombre del archivo: <strong>${data.filename}</strong></p>
                    <button class="btn btn-primary" onclick="descargarCSV('${btoa(data.contenido)}', '${data.filename}')">
                        Descargar CSV
                    </button>
                </div>
                <pre style="background: #2c3e50; color: white; padding: 15px; border-radius: 6px; overflow-x: auto; max-height: 300px;">${data.contenido}</pre>
            `;
        } else {
            let tablaHTML = `
                <h4>Resumen del Reporte</h4>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                    <p><strong>Total Medidores:</strong> ${data.resumen.total_medidores}</p>
                    <p><strong>Total Lecturas:</strong> ${data.resumen.total_lecturas}</p>
                    <p><strong>Consumo Total:</strong> ${data.resumen.consumo_total}</p>
                    <p><strong>Consumo Promedio Global:</strong> ${data.resumen.consumo_promedio_global}</p>
                </div>
                
                <h4>Detalle por Medidor</h4>
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>Serial</th>
                            <th>Usuario</th>
                            <th>Zona</th>
                            <th>Total Lecturas</th>
                            <th>Consumo Promedio</th>
                            <th>Consumo Total</th>
                            <th>Consumo Mínimo</th>
                            <th>Consumo Máximo</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            data.datos.forEach(item => {
                tablaHTML += `
                    <tr>
                        <td>${item.serial}</td>
                        <td>${item.usuario_nombre}</td>
                        <td>${item.nombre_zona}</td>
                        <td>${item.total_lecturas}</td>
                        <td>${item.consumo_promedio}</td>
                        <td>${item.consumo_total}</td>
                        <td>${item.consumo_minimo}</td>
                        <td>${item.consumo_maximo}</td>
                    </tr>
                `;
            });

            tablaHTML += '</tbody></table>';
            resultsContent.innerHTML = tablaHTML;
        }

        // scroll a los resultados
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    mostrarResultadosAlertas(data) {
        const resultsSection = document.getElementById('resultsSection');
        const resultsContent = document.getElementById('resultsContent');
        
        resultsSection.style.display = 'block';

        let tablaHTML = `
            <h4>Resumen del Reporte de Alertas</h4>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                <p><strong>Total Alertas:</strong> ${data.resumen.total_alertas}</p>
                <p><strong>Alertas Resueltas:</strong> ${data.resumen.total_resueltas}</p>
                <p><strong>Alertas Pendientes:</strong> ${data.resumen.total_pendientes}</p>
            </div>
            
            <h4>📊 Estadísticas por Tipo</h4>
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Tipo</th>
                        <th>Total</th>
                        <th>Resueltas</th>
                        <th>Pendientes</th>
                    </tr>
                </thead>
                <tbody>
        `;

        Object.entries(data.resumen.estadisticas).forEach(([tipo, stats]) => {
            tablaHTML += `
                <tr>
                    <td>${tipo}</td>
                    <td>${stats.total}</td>
                    <td>${stats.resueltas}</td>
                    <td>${stats.pendientes}</td>
                </tr>
            `;
        });

        tablaHTML += `
                </tbody>
            </table>
            
            <h4>📋 Detalle de Alertas</h4>
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Tipo</th>
                        <th>Mensaje</th>
                        <th>Medidor</th>
                        <th>Usuario</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.alertas.forEach(alerta => {
            const estado = alerta.resuelta ? 
                '<span class="badge badge-resuelta">Resuelta</span>' :
                '<span class="badge badge-pendiente">Pendiente</span>';
            
            tablaHTML += `
                <tr>
                    <td>${alerta.tipo}</td>
                    <td>${alerta.mensaje}</td>
                    <td>${alerta.medidor_serial}</td>
                    <td>${alerta.usuario_nombre}</td>
                    <td>${new Date(alerta.fecha).toLocaleDateString()}</td>
                    <td>${estado}</td>
                </tr>
            `;
        });

        tablaHTML += '</tbody></table>';
        resultsContent.innerHTML = tablaHTML;

        // scroll a los resultados
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    async cargarHistorialReportes() {
        try {
            this.mostrarLoadingHistorial(true);
            
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/reportes?limit=10`);
            
            if (response && response.ok) {
                const data = await response.json();
                this.mostrarHistorial(data.reportes);
            } else {
                throw new Error('Error cargando historial');
            }
        } catch (error) {
            console.error('Error cargando historial de reportes:', error);
        } finally {
            this.mostrarLoadingHistorial(false);
        }
    }

    mostrarHistorial(reportes) {
        const historialContainer = document.getElementById('historialReportes');
        
        if (reportes.length === 0) {
            historialContainer.innerHTML = '<p>No hay reportes generados recientemente</p>';
            return;
        }
        
        let historialHTML = '';
        
        reportes.forEach(reporte => {
            const fecha = new Date(reporte.fecha_generacion).toLocaleDateString();
            
            historialHTML += `
                <div class="report-item">
                    <div class="report-info">
                        <h4>${this.getTipoReporteNombre(reporte.tipo_reporte)}</h4>
                        <p class="report-meta">
                            Generado el ${fecha} | 
                            Parámetros: ${JSON.stringify(reporte.parametros || {})}
                        </p>
                        <p>${reporte.resumen || 'Sin resumen'}</p>
                    </div>
                    <div>
                        <button class="btn btn-primary" onclick="verReporte(${reporte.reporte_id})">
                            Ver
                        </button>
                    </div>
                </div>
            `;
        });
        
        historialContainer.innerHTML = historialHTML;
    }

    getTipoReporteNombre(tipo) {
        const tipos = {
            'consumo': 'Reporte de Consumo',
            'alertas': 'Reporte de Alertas',
            'usuarios': 'Reporte de Usuarios',
            'zonas': 'Reporte por Zonas'
        };
        return tipos[tipo] || tipo;
    }

    mostrarLoadingHistorial(mostrar) {
        const loading = document.getElementById('loadingHistorial');
        const historial = document.getElementById('historialReportes');
        
        if (mostrar) {
            loading.style.display = 'block';
            historial.style.display = 'none';
        } else {
            loading.style.display = 'none';
            historial.style.display = 'block';
        }
    }

    async authenticatedFetch(url, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`,
            ...options.headers
        };

        try {
            const response = await fetch(url, { ...options, headers });
            
            if (response.status === 401 || response.status === 403) {
                this.handleTokenExpired();
                return null;
            }
            
            return response;
        } catch (error) {
            console.error('Error en request:', error);
            throw error;
        }
    }

    handleTokenExpired() {
        alert('Tu sesión ha expirado. Redirigiendo al login...');
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        window.location.href = '/login';
    }

    setupEventListeners() {
        // fechas por defecto
        const hoy = new Date().toISOString().split('T')[0];
        const hace30Dias = new Date();
        hace30Dias.setDate(hace30Dias.getDate() - 30);
        const fechaHace30Dias = hace30Dias.toISOString().split('T')[0];
        
        document.getElementById('consumoFechaInicio').value = fechaHace30Dias;
        document.getElementById('consumoFechaFin').value = hoy;
        document.getElementById('alertasFechaInicio').value = fechaHace30Dias;
        document.getElementById('alertasFechaFin').value = hoy;
    }
}

// funciones globales
function aplicarFiltrosReportes() {
    if (window.reportesManager) window.reportesManager.aplicarFiltros();
}

function goBack() {
    window.location.href = '/dashboard';
}

function descargarCSV(contenidoBase64, filename) {
    const contenido = atob(contenidoBase64);
    const blob = new Blob([contenido], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function verReporte(reporteId) {
    alert(`Ver reporte ${reporteId} - Funcionalidad próximamente`);
}

function generarReporteConsumo() {
    if (window.reportesManager) {
        window.reportesManager.generarReporteConsumo();
    }
}

function generarReporteAlertas() {
    if (window.reportesManager) {
        window.reportesManager.generarReporteAlertas();
    }
}

// inicializar
document.addEventListener('DOMContentLoaded', () => {
    window.reportesManager = new ReportesManager();
});