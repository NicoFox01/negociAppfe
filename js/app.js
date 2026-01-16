document.addEventListener('DOMContentLoaded', () => {
    console.log('negociApp Frontend Inicializado 🚀');

    const loginForm = document.getElementById('loginForm');
    
    if(loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Mock Login Logic
            alert('Funcionalidad de Login TBD - Esperando Backend');
        });
    }
});
