class AuthApp {
    constructor() {
        this.apiBaseUrl = window.location.origin + '/api';
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
        
        // redirigir al dashboard después de 2 segundos
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 2000);
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