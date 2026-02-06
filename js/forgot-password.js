import { FULL_API_URL } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgotPasswordForm');
    const successDiv = document.getElementById('successMessage');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.innerText = "Enviando...";
            btn.disabled = true;

            const username = document.getElementById('username').value;

            try {
                const res = await fetch(`${FULL_API_URL}/auth/recover-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username })
                });

                // Always show success to prevent enumeration, unless server error (500)
                if (res.status >= 500) {
                     throw new Error('Error del servidor. Intente más tarde.');
                }
                
                // Redirect to Login immediately
                window.location.href = 'index.html';

            } catch (err) {
                console.error(err);
                showToast(err.message, 'error');
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }
});

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = type === 'success' ? '<i class="ph ph-check-circle"></i>' : '<i class="ph ph-warning-circle"></i>';
  
  toast.innerHTML = `
      ${icon}
      <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Trigger reflow
  toast.offsetHeight;
  toast.style.opacity = '1';
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
