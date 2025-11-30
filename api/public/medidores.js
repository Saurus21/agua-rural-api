class MedidoresManager {
    constructor() {
        this.apiBaseUrl = window.location.origin + '/api';
        this.token = localStorage.getItem('authToken');

        this.userData = JSON.parse(localStorage.getItem('userData')) || {};

        this.paginaActual = 1;
        this.limit = 10;
        this.filtros = {};
        this.init();
    }

    init() {
        this.checkAuthentication();
        this.cargarEstadisticas();
        this.cargarUsuarios();
        this.cargarZonas();
        this.cargarMedidores();
        this.setupUI();
    }

    checkAuthentication() {
        if (!this.token) {
            alert('No estás autenticado. Redirigiendo al login...');
            window.location.href = '/login';
            return;
        }
        console.log('Usuario Autenticado');
    }

    setupUI() {
        const esAdmin = this.userData.rol === 'admin';
        const divNuevo = document.getElementById('divNuevoUsuario');
        const divEdit = document.getElementById('divEditUsuario');

        if (divNuevo) divNuevo.style.display = esAdmin ? 'block' : 'none';
        if (divEdit) divEdit.style.display = esAdmin ? 'block' : 'none';

        // cerrar modales si se hace clic fuera
        window.onclick = (event) => {
            if (event.target.classList.contains('modal')) {
                event.target.style.display = 'none';
            }
        }
    }

    async cargarUsuarios() {
        try {
            // solo admin puede ver todos los usuarios
            if (this.userData.rol !== 'admin') return;

            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/usuarios?limit=100`);
            if (response && response.ok) {
                const data = await response.json();
                this.llenarSelectUsuarios(data.users);
            }
        } catch (error) {
            console.error('Error cargando usuarios:', error);
        }
    }

    llenarSelectUsuarios(usuarios) {
        const selects = ['filterUsuario', 'nuevoUsuarioId', 'editUsuarioId'];

        selects.forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;

            // guardar la primera opcion (placeholder)
            const firstOption = select.options[0];
            select.innerHTML = '';
            select.appendChild(firstOption);

            usuarios.forEach(user => {
                const option = document.createElement('option');
                option.value = user.user_id;
                option.textContent = `${user.nombre} (${user.email})`;
                select.appendChild(option);
            });
        });
    }

    async cargarZonas() {
        try {
            let zonas = [];
            if (this.userData.rol === 'admin') {
                try {
                    const response = await this.authenticatedFetch(`${this.apiBaseUrl}/zonas?limit=100`);
                    if (response && response.ok) zonas = await response.json();
                } catch (error) { console.warn('Fallo carga zonas API'); }      
            }

            if (zonas.length === 0) {
                zonas = [{ nombre_zona: 'Valle Central'}, { nombre_zona: 'Zona Sur' }];
            }

            this.mostrarZonas(zonas);
        } catch (error) {
            console.error('Error cargando zonas:', error);
            // zonas por defecto
            this.mostrarZonas([
                { nombre_zona: 'Valle Central' },
                { nombre_zona: 'Zona Sur' }
            ]);
        }
    }

    mostrarZonas(zonas) {
        const select = document.getElementById('filterZona');
        if (!select) {
            console.warn('No se encontró el select de zonas');
            return;
        }

        const firstOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOption);

        zonas.forEach(zona => {
            const option = document.createElement('option');
            option.value = zona.zona_id || zona.nombre_zona;
            option.textContent = zona.nombre_zona;
            select.appendChild(option);
        });
    }

    async cargarEstadisticas() {
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/medidores/resumen`);
            if (response && response.ok) {
                const data = await response.json();
                
                const ids = {
                    'totalMedidores': data.total_medidores,
                    'medidoresActivos': data.medidores_activos,
                    'medidoresInactivos': data.medidores_inactivos
                };

                for(const [id, val] of Object.entries(ids)) {
                    const el = document.getElementById(id);
                    if (el) el.textContent = val || 0;
                }
                const ult = document.getElementById('ultimaLectura');
                if(ult) ult.textContent = data.ultima_lectura_fecha ? new Date(data.ultima_lectura_fecha).toLocaleDateString() : 'N/A';
            }
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
        }
    }

    async cargarMedidores() {
        try {
            this.mostrarLoading(true);
            
            const queryParams = new URLSearchParams({
                page: this.paginaActual,
                limit: this.limit,
                ...this.filtros
            });

            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/medidores?${queryParams}`);
            
            if (response && response.ok) {
                const data = await response.json();
                this.renderTabla(data);
            }

        } catch (error) {
            console.error('Error cargando medidores:', error);
            this.mostrarError('Error al cargar los medidores: ' + error.message);

            const tbody = document.getElementById('medidoresBody');
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: red;">
                        <b>Error al cargar los medidores.</b><br>
                        Por favor, intente de nuevo más tarde.
                    </td>
                </tr>
            `;
        } finally {
            this.mostrarLoading(false);
        }
    }

    renderTabla(data) {
        const tbody = document.getElementById('medidoresBody');
        const infoPaginacion = document.getElementById('infoPaginacion');
        const paginaActual = document.getElementById('paginaActual');
        const btnAnterior = document.getElementById('btnAnterior');
        const btnSiguiente = document.getElementById('btnSiguiente');

        if (!tbody || !infoPaginacion || !paginaActual || !btnAnterior || !btnSiguiente) {
            console.error('Elementos del DOM no encontrados');
            return;
        }
        
        // información de paginación
        const total = data.pagination ? data.pagination.total : (data.medidores || []).length;
        infoPaginacion.textContent = `Mostrando ${(data.medidores || []).length} de ${total}`;
        paginaActual.textContent = this.paginaActual;
        
        // actualizar botones de paginación
        const totalPages = data.pagination ? data.pagination.pages : 1;
        btnAnterior.disabled = this.paginaActual === 1;
        btnSiguiente.disabled = this.paginaActual >= totalPages;
        
        // mostrar medidores
        tbody.innerHTML = '';
        
        if (!data.medidores || data.medidores.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px;">
                        No se encontraron medidores con los filtros aplicados
                    </td>
                </tr>
            `;
            return;
        }
        
        data.medidores.forEach(medidor => {
            const estadoBadge = medidor.activo ? 
                '<span class="badge badge-activo">Activo</span>' :
                '<span class="badge badge-inactivo">Inactivo</span>';
            
            // información del usuario
            const usuarioNombre = medidor.usuario?.nombre || 'N/A';
            
            // información de la zona
            const zonaNombre = medidor.usuario?.zona?.nombre_zona || 'N/A';
            
            // ultima lectura
            let ultimaLectura = 'Sin lecturas';
            if (medidor.ultima_lectura && medidor.ultima_lectura.fecha) {
                ultimaLectura = new Date(medidor.ultima_lectura.fecha).toLocaleDateString();
            }

            // total lecturas
            const totalLecturas = medidor.total_lecturas_conteo || 0;
            
            const row = `
                <tr>
                    <td><strong>${medidor.serial || 'N/A'}</strong></td>
                    <td>${medidor.ubicacion || 'N/A'}</td>
                    <td>${usuarioNombre}</td>
                    <td>${zonaNombre}</td>
                    <td>${estadoBadge}</td>
                    <td>${ultimaLectura}</td>
                    <td>${totalLecturas}</td>
                    <td>
                        <button class="btn btn-primary" onclick="window.medidoresManager.abrirVer(${medidor.medidor_id})">
                            Ver
                        </button>
                        <button class="btn btn-warning" onclick="window.medidoresManager.abrirEditar(${medidor.medidor_id})">
                            Editar
                        </button>
                        ${medidor.activo ? 
                            `<button class="btn btn-danger" onclick="window.medidoresManager.cambiarEstado(${medidor.medidor_id}, false)">Desactivar</button>` :
                            `<button class="btn btn-success" onclick="window.medidoresManager.cambiarEstado(${medidor.medidor_id}, true)">Activar</button>`
                        }
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    }

    async crearMedidor(datos) {
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/medidores`, {
                method: 'POST',
                body: JSON.stringify(datos)
            });

            if (response && response.ok) {
                alert('Medidor creado exitosamente');
                cerrarModal('modalNuevoMedidor');
                document.getElementById('formNuevoMedidor').reset();
                this.cargarMedidores();
                this.cargarEstadisticas();
            }

        } catch (error) {
            console.error('Error creando medidor:', error);
            this.showMessage('Error creando medidor: ' + error.message, 'error');
        }
    }

    async abrirVer(id) {
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/medidores/${id}`);
            if (response && response.ok) {
                const medidor = await response.json();

                // llenar campos 
                document.getElementById('detSerial').textContent = medidor.serial;
                document.getElementById('detUbicacion').textContent = medidor.ubicacion;
                document.getElementById('detUsuario').textContent = medidor.usuario?.nombre || 'N/A';
                document.getElementById('detEstado').textContent = medidor.activo ? 'Activo' : 'Inactivo';
                document.getElementById('detEstado').style.color = medidor.activo ? 'green' : 'red';

                // llenar tabla de lecturas recientes
                const tbody = document.getElementById('detLecturasBody');
                tbody.innerHTML = '';
                if (medidor.ultimas_lecturas && medidor.ultimas_lecturas.length > 0) {
                    medidor.ultimas_lecturas.forEach(l => {
                        tbody.innerHTML += `
                            <tr>
                                <td>${new Date(l.fecha).toLocaleDateString()}</td>
                                <td>${l.valor}</td>
                                <td>${l.observacion || '-'}</td>
                            </tr>
                        `;
                    });
                } else {
                    tbody.innerHTML = '<tr><td colspan="3">Sin lecturas recientes</td></tr>';
                }

                abrirModal('modalDetalle');
            }
        } catch (error) {
            console.error(error);
            alert('No se pudo cargar el detalle');
        }
    }

    async abrirEditar(id) {
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/medidores/${id}`);
            if (response && response.ok) {
                const medidor = await response.json();

                // llenar campos del formulario
                document.getElementById('editMedidorId').value = medidor.medidor_id;
                document.getElementById('editSerial').value = medidor.serial || '';
                document.getElementById('editUbicacion').value = medidor.ubicacion || '';

                // si es admin
                if (this.userData.rol === 'admin') {
                    const select = document.getElementById('editUsuarioId');
                    const uid = medidor.user_id || (medidor.usuario ? medidor.usuario.user_id : '');
                    select.value = uid;
                }

                abrirModal('modalEditarMedidor');
            }
        } catch (error) {
            console.error(error);
            alert('No se pudo cargar el medidor para editar');
        }
    }

    async actualizarMedidor(id, datos) {
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/medidores/${id}`, {
                method: 'PUT',
                body: JSON.stringify(datos)
            });
            if (response && response.ok) {
                alert('Medidor actualizado exitosamente');
                cerrarModal('modalEditarMedidor');
                this.cargarMedidores();
            }
        } catch (error) {
            console.error('Error actualizando medidor:', error);
            this.showMessage('Error actualizando medidor: ' + error.message, 'error');
        }
    }

    async cambiarEstado(id, nuevoEstado) {
        const accion = nuevoEstado ? 'activar' : 'desactivar';
        if (!confirm(`¿Estás seguro de que quieres ${accion} este medidor?`)) return;

        try {
            // se usa put para cambiar el estado
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/medidores/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ activo: nuevoEstado })
            });

            if (response && response.ok) {
                alert(`Medidor ${accion} exitosamente`);
                this.cargarMedidores();
                this.cargarEstadisticas();
            }

        } catch (error) {
            console.error(`Error ${accion} medidor:`, error);
            this.showMessage(`Error ${accion} medidor: ` + error.message, 'error');
        }
    }

    aplicarFiltros() {
        this.filtros = {};
        
        const usuarioId = document.getElementById('filterUsuario').value;
        const estado = document.getElementById('filterEstado').value;
        const serial = document.getElementById('filterSerial').value;
        const zona = document.getElementById('filterZona').value;
        
        if (usuarioId) this.filtros.user_id = usuarioId;
        if (estado) this.filtros.activo = estado;
        if (serial) this.filtros.serial = serial;
        if (zona) this.filtros.zona = zona;
        
        this.paginaActual = 1;
        this.cargarMedidores();
    }

    cambiarPagina(direccion) {
        this.paginaActual += direccion;
        this.cargarMedidores();
    }

    mostrarLoading(mostrar) {
        const loading = document.getElementById('loading-medidores');
        const tabla = document.getElementById('tablaMedidores');

        if (!loading || !tabla) {
            console.warn('Elementos de loading no encontrados');
            return;
        } 
        
        if(loading && tabla) {
            loading.style.display = mostrar ? 'block' : 'none';
            tabla.style.display = mostrar ? 'none' : 'block';
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

            if (options.method === 'PUT' || options.method === 'POST') {
                console.log(`🚀 ENVIANDO [${options.method}] a ${url}`);
                console.log('📦 BODY:', options.body);
            }

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


    showMessage(message, type = 'info') {
        const messageDiv = document.getElementById('apiResponse');
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.classList.remove('hidden');
    }
}

// funciones globales
function abrirModal(id) {
    document.getElementById(id).style.display = 'block';
}

function cerrarModal(id) {
    document.getElementById(id).style.display = 'none';
}

function showNuevoMedidor() {
    abrirModal('modalNuevoMedidor');
}

function guardarNuevoMedidor() {
    const serial = document.getElementById('nuevoSerial').value;
    const ubicacion = document.getElementById('nuevaUbicacion').value;
    const usuarioId = document.getElementById('nuevoUsuarioId').value;

    const datos = { serial, ubicacion };
    if (usuarioId) datos.user_id = usuarioId;

    window.medidoresManager.crearMedidor(datos);
}

function guardarEdicionMedidor() {
    const id = document.getElementById('editMedidorId').value;
    const serial = document.getElementById('editSerial').value;
    const ubicacion = document.getElementById('editUbicacion').value;
    const usuarioId = document.getElementById('editUsuarioId').value;

    const datos = { serial, ubicacion };

    if (usuarioId !== undefined) datos.user_id = usuarioId;

    window.medidoresManager.actualizarMedidor(id, datos);
}

// funciones para filtros (llamadas desde HTML)
function aplicarFiltrosMedidores() {
    const manager = window.medidoresManager;
    if (manager) {
        manager.aplicarFiltros();
    }
}

function cambiarPagina(direccion) {
    const manager = window.medidoresManager;
    if (manager) {
        manager.cambiarPagina(direccion);
    }
}

function goBack() {
    window.location.href = '/dashboard';
}

// inicializar
document.addEventListener('DOMContentLoaded', () => {
    window.medidoresManager = new MedidoresManager();
});