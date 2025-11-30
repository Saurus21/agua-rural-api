class LecturasManager {
    constructor() {
        this.apiBaseUrl = window.location.origin + '/api';
        this.token = localStorage.getItem('authToken');
        this.paginaActual = 1;
        this.limit = 10;
        this.filtros = {};
        this.medidoresCache = [];
        this.init();
    }

    init() {
        this.checkAuthentication();
        this.cargarMedidores();
        this.cargarLecturas();
        this.setupEventListeners();
    }

    checkAuthentication() {
        if (!this.token){
            alert('No estas autenticado. Redirigiendo al login...');
            window.location.href = '/login';
            return;
        }
    }

    async cargarMedidores() {
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/medidores?limit=100`);
            if (response && response.ok) {
                const data = await response.json();

                // guardar en cache para reutilizar
                this.medidoresCache = data.medidores || [];
                this.llenarSelectMedidores('filterMedidor', this.medidoresCache, 'Todos los medidores');

                // intentar llenar el modal
                this.llenarSelectMedidores('nuevoMedidorId', this.medidoresCache, 'Selecciona un medidor');

                this.mostrarMedidores(data.medidores);
            }
        } catch (error) {
            console.error('Error cargando medidores:', error);
        }
    }

    llenarSelectMedidores(elementId, medidores, placeholder) {
        const select = document.getElementById(elementId);
        if (!select) return;

        select.innerHTML = `<option value="">${placeholder}</option>`;
        medidores.forEach(medidor => {
            const option = document.createElement('option');
            option.value = medidor.medidor_id;
            option.textContent = `${medidor.serial} - ${medidor.ubicacion}`;
            select.appendChild(option);
        });
    }

    prepararYAbrirModal() {
        if (this.medidoresCache.length > 0) {
            this.llenarSelectMedidores('nuevoMedidorId', this.medidoresCache, 'Seleccione un medidor...');
        } else {
            this.cargarMedidores().then(() => {
                this.llenarSelectMedidores('nuevoMedidorId', this.medidoresCache, 'Seleccione un medidor...');
            });
        }
        
        // abrir el modal visualmente
        const modal = document.getElementById('modalNuevaLectura');
        if(modal) modal.style.display = 'block';
    }
    
    mostrarMedidores(medidores) {
        const select = document.getElementById('filterMedidor');
        select.innerHTML = '<option value="">Todos los medidores</option>';

        medidores.forEach(medidor => {
            const option = document.createElement('option');
            option.value = medidor.medidor_id;
            option.textContent = `${medidor.serial} - ${medidor.ubicacion}`;
            select.appendChild(option);
        });
    }

    async cargarLecturas() {
        try {
            this.mostrarLoading(true);

            // construir query string
            const queryParams = new URLSearchParams({
                page: this.paginaActual,
                limit: this.limit,
                ...this.filtros
            });

            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/lecturas?${queryParams}`);

            if (response && response.ok) {
                const data = await response.json();
                this.mostrarLecturas(data);
            } else {
                throw new Error('Error cargando lecturas');
            }
        } catch (error) {
            console.error('Error cargando lecturas:', error);
            this.mostrarError('Error al cargar las lecturas: ' + error.message);
        } finally {
            this.mostrarLoading(false);
        }
    }

    mostrarLecturas(data) {
        const tbody = document.getElementById('lecturasBody');
        const infoPaginacion = document.getElementById('infoPaginacion');
        const paginaActual = document.getElementById('paginaActual');
        const btnAnterior = document.getElementById('btnAnterior');
        const btnSiguiente = document.getElementById('btnSiguiente');

        if (!tbody) return;

        // actualizar informacion de paginacion
        infoPaginacion.textContent = `Mostrando ${data.lecturas.length} de ${data.pagination.total} lecturas`;
        paginaActual.textContent = this.paginaActual;

        // actualizar botones de paginacion
        if (btnAnterior) btnAnterior.disabled = this.paginaActual === 1;
        if (btnSiguiente) btnSiguiente.disabled = this.paginaActual >= data.pagination.pages;

        // mostrar lecturas
        tbody.innerHTML = '';

        if (data.lecturas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px;">
                        No se encontraron lecturas con los filtros aplicados
                    </td>
                </tr>
            `;
            return;
        }

        data.lecturas.forEach(lectura => {
            const fecha = new Date(lectura.fecha).toLocaleDateString();
            const estado = lectura.sincronizado ?
                '<span class="badge badge-sincronizado">Sincronizado</span>' :
                '<span class="badge badge-pendiente">Pendiente</span>';

            const row = `
                <tr>
                    <td>${fecha}</td>
                    <td><strong>${lectura.medidor_serial || 'N/A'}</strong></td>
                    <td><strong>${lectura.valor}</strong></td>
                    <td>${lectura.usuario_nombre || 'N/A'}</td>
                    <td>${lectura.observacion || '-'}</td>
                    <td>${estado}</td>
                    <td>
                        <button class="btn btn-primary" onclick="abrirModalDetalle(${lectura.lectura_id})">
                            Ver
                        </button>
                    </td>
                </tr>

            `;
            tbody.innerHTML += row;
        });
    }

    async crearLectura(datosLectura) {
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/lecturas`, {
                method: 'POST',
                body: JSON.stringify(datosLectura)
            });

            if (response && response.ok) {
                alert('Lectura creada exitosamente');
                document.getElementById('formNuevaLectura').reset();
                cerrarModal('modalNuevaLectura');
                this.paginaActual = 1;
                this.cargarLecturas();
            }

        } catch (error) {
            console.error('Error creando lectura:', error);
            alert('Error al crear la lectura: ' + error.message);
        }
    }

    async obtenerLecturaPorId(id) {
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/lecturas/${id}`);
            if (response && response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Error obteniendo detalle:', error);
            alert('No se pudo obtener el detalle de la lectura');
        }
        return null;
    }

    aplicarFiltros() {
        this.filtros = {};

        const medidorId = document.getElementById('filterMedidor').value;
        const fechaInicio = document.getElementById('filterFechaInicio').value;
        const fechaFin = document.getElementById('filterFechaFin').value;
        const sincronizado = document.getElementById('filterSincronizado').value;

        if (medidorId) this.filtros.medidor_id = medidorId;
        if (fechaInicio) this.filtros.start_date = fechaInicio;
        if (fechaFin) this.filtros.end_date = fechaFin;
        if (sincronizado) this.filtros.sincronizado = sincronizado;

        this.paginaActual = 1;
        this.cargarLecturas();
    }

    cambiarPagina(direccion) {
        this.paginaActual += direccion;
        this.cargarLecturas();
    }

    mostrarLoading(mostrar) {
        const loading = document.getElementById('loadingLecturas');
        const tabla = document.getElementById('tablaLecturas');

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

    // metodo para hacer requests autenticadas
    async authenticatedFetch(url, options = {}) {
        try {
            console.log(`Haciendo request autenticada a: ${url}`);
                    
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                ...options.headers
            };

            const response = await fetch(url, {
                ...options,
                headers: headers
            });

            console.log(`Response status: ${response.status}`);
                    
            // si el token expira, redirigir al login
            if (response.status === 403 || response.status === 401) {
                this.handleTokenExpired();
                        return null;
            }
                    
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error en response:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            return response;
        } catch (error) {
            console.error('Error en authenticatedFetch:', error);
            this.showMessage('Error de conexión: ' + error.message, 'error');
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
        // los filtros ya tienen el onchange en el html
    }

    showMessage(message, type = 'info') {
        const messageDiv = document.getElementById('apiResponse');
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.classList.remove('hidden');
    }
}

// funciones globales
function abrirModalNuevaLectura() {
    if (window.lecturasManager) {
        window.lecturasManager.prepararYAbrirModal();
    }
}

function cerrarModal(id) {
    document.getElementById(id).style.display = 'none';
}

function guardarLectura() {
    if (window.lecturasManager) {
        const medidorId = document.getElementById('nuevoMedidorId').value;
        const valor = document.getElementById('nuevoValor').value;
        const observacion = document.getElementById('nuevaObservacion').value;
        
        // validaciones básicas
        if (!medidorId || !valor) {
            alert('Por favor, complete todos los campos obligatorios.');
            return;
        }

        const datos = {
            medidor_id: medidorId,
            valor: parseFloat(valor),
            observacion: observacion,
            // opcional, agregar geolocalizacion si el navegador lo permite
            latitud: null,
            longitud: null
        };

        window.lecturasManager.crearLectura(datos);
    }
}

async function abrirModalDetalle(id) {
    if (window.lecturasManager) {
        const lectura = await window.lecturasManager.obtenerLecturaPorId(id);

        if (lectura) {
            document.getElementById('detId').textContent = lectura.lectura_id || lectura.id;
            document.getElementById('detFecha').textContent = new Date(lectura.fecha).toLocaleString();
            document.getElementById('detMedidor').textContent = lectura.medidor_serial || 'N/A';
            document.getElementById('detValor').textContent = lectura.valor;
            document.getElementById('detUsuario').textContent = lectura.usuario_nombre || lectura.usuario?.nombre || 'N/A';
            document.getElementById('detEstado').innerHTML = lectura.sincronizado ? 
                '<span class="badge badge-sincronizado">Sincronizado</span>' : 
                '<span class="badge badge-pendiente">Pendiente</span>';
            document.getElementById('detObs').textContent = lectura.observacion || 'Sin observaciones';
            // mostrar modal
            const modal = document.getElementById('modalDetalle');
            if (modal) modal.style.display = 'block';
        }
    }
}
 

function aplicarFiltrosLecturas() {
    if (window.lecturasManager) {
        window.lecturasManager.aplicarFiltros();
    }
}

function cambiarPagina(d) { window.lecturasManager.cambiarPagina(d); }

function goBack() {
    window.location.href = '/dashboard';
}

function showNuevaLectura() {
    abrirModalNuevaLectura()
}


// inicializar cuando el DOM este listo
document.addEventListener('DOMContentLoaded', () => {
    window.lecturasManager = new LecturasManager();
});