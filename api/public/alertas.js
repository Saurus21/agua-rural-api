class AlertasManager {
    constructor() {
        this.apiBaseUrl = window.location.origin + '/api';
        this.token = localStorage.getItem('authToken');
        this.paginaActual = 1;
        this.limit = 10;
        this.filtros = {};
        this.alertaActualId = null; // para el modal
        this.init();
    }

    init() {
        this.checkAuthentication();
        this.cargarEstadisticas();
        this.cargarAlertas();
        this.setupEventListeners();
    }

    checkAuthentication() {
        if (!this.token) {
            alert('No estás autenticado. Redirigiendo al login...');
            window.location.href = '/login';
            return;
        }
    }

    async cargarEstadisticas() {
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/alertas/estadisticas`);
            if (response && response.ok) {
                const data = await response.json();
                this.mostrarEstadisticas(data);
            }
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
        }
    }

    mostrarEstadisticas(data) {
        if (data.totales) {
            document.getElementById('totalAlertas').textContent = data.totales.total || 0;
            document.getElementById('alertasPendientes').textContent = data.totales.pendientes || 0;
            document.getElementById('alertasResueltas').textContent = data.totales.resueltas || 0;
            document.getElementById('alertasHoy').textContent = data.totales.pendientes || 0; // simplificado
        }
        
    }

    async cargarAlertas() {
        try {
            this.mostrarLoading(true);
            
            const queryParams = new URLSearchParams({
                page: this.paginaActual,
                limit: this.limit,
                ...this.filtros
            });

            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/alertas?${queryParams}`);
            
            if (response && response.ok) {
                const data = await response.json();
                this.mostrarAlertas(data);
            } else {
                throw new Error('Error cargando alertas');
            }
        } catch (error) {
            console.error('Error cargando alertas:', error);
            this.mostrarError('Error al cargar las alertas: ' + error.message);
        } finally {
            this.mostrarLoading(false);
        }
    }

    mostrarAlertas(data) {
        const tbody = document.getElementById('alertasBody');
        const infoPaginacion = document.getElementById('infoPaginacion');
        const paginaActual = document.getElementById('paginaActual');

        if (!tbody) return;
        
        infoPaginacion.textContent = `Mostrando ${data.alertas.length} de ${data.pagination.total} alertas`;
        paginaActual.textContent = this.paginaActual;
        
        document.getElementById('btnAnterior').disabled = this.paginaActual === 1;
        document.getElementById('btnSiguiente').disabled = this.paginaActual >= data.pagination.pages;
        
        tbody.innerHTML = '';
        
        if (data.alertas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px;">
                        No se encontraron alertas con los filtros aplicados
                    </td>
                </tr>
            `;
            return;
        }
        
        data.alertas.forEach(alerta => {
            const estado = alerta.resuelta ? 
                '<span class="badge badge-resuelta">Resuelta</span>' :
                '<span class="badge badge-pendiente">Pendiente</span>';
            
            const tipoBadge = `<span class="badge badge-${alerta.tipo}">${this.getTipoNombre(alerta.tipo)}</span>`;
            
            const fecha = new Date(alerta.fecha).toLocaleDateString();
            
            const acciones = alerta.resuelta ? 
                `<button class="btn btn-primary" onclick="abrirDetalle(${alerta.alerta_id})">Ver</button>` :
                `
                <button class="btn btn-primary" onclick="abrirDetalle(${alerta.alerta_id})">Ver</button>
                <button class="btn btn-success" onclick="resolverAlerta(${alerta.alerta_id})">Resolver</button>
                `;
            
            const row = `
                <tr>
                    <td>${tipoBadge}</td>
                    <td>${alerta.mensaje}</td>
                    <td><strong>${alerta.medidor_serial || 'N/A'}</strong></td>
                    <td>${alerta.usuario_nombre || 'N/A'}</td>
                    <td>${fecha}</td>
                    <td>${estado}</td>
                    <td>${acciones}</td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    }

    async resolverAlerta(id) {
        if (!confirm('¿Marcar esta alerta como resuelta?')) return;
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/alertas/${id}/resolver`, {
                method: 'PUT'
            });

            if (response && response.ok) {
                alert('Alerta marcada como resuelta');
                this.cargarAlertas();
                this.cargarEstadisticas();
                
                const modal = document.getElementById('modalDetalleAlerta');
                if (modal) {
                    modal.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Error resolviendo alerta:', error);
            this.mostrarError('Error al resolver la alerta: ' + error.message);
        }
    }

    async abrirDetalle(id) {
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/alertas/${id}`);
            if (response && response.ok) {
                const alerta = await response.json();
                this.alertaActualId = id;

                document.getElementById('detId').textContent = alerta.alerta_id;
                document.getElementById('detTipo').textContent = this.getTipoNombre(alerta.tipo);
                document.getElementById('detMensaje').textContent = alerta.mensaje;
                document.getElementById('detFecha').textContent = new Date(alerta.fecha).toLocaleString();

                const estadoSpan = document.getElementById('detEstado');
                estadoSpan.textContent = alerta.resuelta ? 'Resuelta' : 'Pendiente';
                estadoSpan.className = alerta.resuelta ? 'badge badge-resuelta' : 'badge badge-pendiente';

                document.getElementById('detMedidor').textContent = alerta.medidor_serial || 'N/A';
                document.getElementById('detUbicacion').textContent = alerta.medidor_ubicacion || 'N/A';
                document.getElementById('detLectura').textContent = alerta.lectura_valor || 'N/A';
                document.getElementById('detUsuario').textContent = `${alerta.usuario_nombre} (${alerta.usuario_email || ''})`;

                // mostrar boton resolver si no está resuelta
                const btnRes = document.getElementById('btnResolverModal');
                btnRes.style.display = alerta.resuelta ? 'none' : 'inline-block';

                document.getElementById('modalDetalleAlerta').style.display = 'block';
            }

        } catch (error) {
            console.error('Error cargando detalle de alerta:', error);
            this.mostrarError('Error al cargar el detalle de la alerta: ' + error.message);
        }
    }

    getTipoNombre(tipo) {
        const tipos = {
            'consumo_alto': 'Consumo Alto',
            'variacion_brusca': 'Variación Brusca',
            'consumo_cero': 'Consumo Cero'
        };
        return tipos[tipo] || tipo;
    }

    aplicarFiltros() {
        this.filtros = {};
        
        const tipo = document.getElementById('filterTipo').value;
        const estado = document.getElementById('filterEstado').value;
        const fechaInicio = document.getElementById('filterFechaInicio').value;
        const fechaFin = document.getElementById('filterFechaFin').value;
        
        if (tipo) this.filtros.tipo = tipo;
        if (estado) this.filtros.resuelta = estado;
        if (fechaInicio) this.filtros.start_date = fechaInicio;
        if (fechaFin) this.filtros.end_date = fechaFin;
        
        this.paginaActual = 1;
        this.cargarAlertas();
    }

    async cargarSoloPendientes() {
        document.getElementById('filterEstado').value = 'false';
        this.aplicarFiltros();
    }

    cambiarPagina(direccion) {
        this.paginaActual += direccion;
        this.cargarAlertas();
    }

    mostrarLoading(mostrar) {
        const loading = document.getElementById('loadingAlertas');
        const tabla = document.getElementById('tablaAlertas');
        
        if (mostrar) {
            loading.style.display = 'block';
            tabla.style.display = 'none';
        } else {
            loading.style.display = 'none';
            tabla.style.display = 'block';
        }
    }

    mostrarError(mensaje) {
        alert(mensaje);
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
        const hace7Dias = new Date();
        hace7Dias.setDate(hace7Dias.getDate() - 7);
        const fechaHace7Dias = hace7Dias.toISOString().split('T')[0];
        
        document.getElementById('filterFechaInicio').value = fechaHace7Dias;
        document.getElementById('filterFechaFin').value = hoy;
    }
}

// funciones globales
function aplicarFiltrosAlertas() {
    if (window.alertasManager) {
        window.alertasManager.aplicarFiltros();
    }
}

function cambiarPagina(d) { window.alertasManager.cambiarPagina(d); }

function goBack() {
    window.location.href = '/dashboard';
}

function cargarSoloPendientes() { 
    document.getElementById('filterEstado').value = 'false';
    window.alertasManager.aplicarFiltros();
}

function cerrarModal() { document.getElementById('modalDetalleAlerta').style.display = 'none'; }

function resolverAlertaDesdeModal() {
    if(window.alertasManager.alertaActualId) {
        window.alertasManager.resolverAlerta(window.alertasManager.alertaActualId);
    }
}

function abrirDetalle(id) {
    if (window.alertasManager) {
        window.alertasManager.abrirDetalle(id);
    }
}

function resolverAlerta(id) {
    if (window.alertasManager) {
        window.alertasManager.resolverAlerta(id);
    }
}

// inicializar
document.addEventListener('DOMContentLoaded', () => {
    window.alertasManager = new AlertasManager();
});