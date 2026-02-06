import { FULL_API_URL } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('negociApp Frontend Inicializado 🚀');

    const loginForm = document.getElementById('loginForm');
    
    if(loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const submitButton = loginForm.querySelector('button[type="submit"]');
            
            // UI Feedback
            const originalButtonText = submitButton.innerText;
            submitButton.disabled = true;
            submitButton.innerText = 'Ingresando...';

            try {
                // Preparamos form-data (lo que espera OAuth2PasswordRequestForm del backend)
                const formData = new URLSearchParams();
                formData.append('username', usernameInput.value);
                formData.append('password', passwordInput.value);

                const response = await fetch(`${FULL_API_URL}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    
                    // Guardamos el token
                    localStorage.setItem('access_token', data.access_token);
                    localStorage.setItem('token_type', data.token_type);
                    
                    console.log('Login Exitoso:', data);
                    
                    // Redirigir al Dashboard
                    window.location.href = 'dashboard.html';
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.detail || 'Credenciales incorrectas'}`);
                }
            } catch (error) {
                console.error('Error de red:', error);
                alert('No se pudo conectar con el servidor. Verifica que el backend esté corriendo.');
            } finally {
                submitButton.disabled = false;
                submitButton.innerText = originalButtonText;
            }
        });
    }
});
