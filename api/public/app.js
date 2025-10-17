class AuthApp {
    constructor() {
        this.apiBaseUrl = window.location.origin + '/api';
        this.token = localStorage.getItem('authToken');
        this.init();
    }

    init() {
        this.loginForm = document.getElementById('loginForm');
        this.messageDiv = document.getElementById('message');
        this.loginBtn = document.getElementById('loginBtn');
        this.spinner = document.getElementById('spinner');

        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        
        // verificar si ya hay un token almacenado
        this.checkExistingToken();
    }

    // meotodo para requests autenticadas
    async authenticatedFetch(url, options = {}) {
        const token = this.token || localStorage.getItem('authToken');

        const defaultOptions = {
            headers: {
                'Content Type': 'application-json',
                ...options.headers
            }
        };

        // agregar token
        if (token) {
            defaultOptions.headers['Authorization'] = `Bearer ${token}`;
        }

        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, finalOptions);

            // si el token expira, redirigir al login
            if (response.status === 403 || response.status === 401) {
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
        this.showMessage('Tu sesión ha expirado. Redirigiendo al login...', 'error');
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
    }

    checkExistingToken() {
        const token = localStorage.getItem('authToken');
        if (token) {
            this.verifyToken(token);
        }
    }

    async verifyToken(token) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                this.showMessage('Ya tienes una sesión activa. Redirigiendo...', 'redirecting');
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 2000);
            } else {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userData');
            }
        } catch (error) {
            console.error('Error verificando token:', error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const formData = new FormData(this.loginForm);
        const credentials = {
            email: formData.get('email'),
            password: formData.get('password')
        };

        this.setLoading(true);
        this.hideMessage();

        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials)
            });

            const data = await response.json();

            if (response.ok) {
                this.handleLoginSuccess(data);
            } else {
                this.handleLoginError(data.error || 'Error en el login');
            }
        } catch (error) {
            this.handleLoginError('Error de conexión: ' + error.message);
        } finally {
            this.setLoading(false);
        }
    }

    handleLoginSuccess(data) {
        // guardar token y datos del usuario
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        
        this.showMessage('¡Login exitoso! Redirigiendo...', 'success');
        
        // redirigir al dashboard después de 1 segundo
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 1000);
    }

    handleLoginError(errorMessage) {
        this.showMessage(errorMessage, 'error');
        
        // Limpiar campos en caso de error
        document.getElementById('password').value = '';
    }

    setLoading(loading) {
        if (loading) {
            this.loginBtn.disabled = true;
            this.spinner.classList.remove('hidden');
            this.loginBtn.querySelector('span').textContent = 'Iniciando sesión...';
        } else {
            this.loginBtn.disabled = false;
            this.spinner.classList.add('hidden');
            this.loginBtn.querySelector('span').textContent = 'Iniciar Sesión';
        }
    }

    showMessage(message, type = 'info') {
        this.messageDiv.textContent = message;
        this.messageDiv.className = `message ${type}`;
        this.messageDiv.classList.remove('hidden');
    }

    hideMessage() {
        this.messageDiv.classList.add('hidden');
    }
}

// inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new AuthApp();
});