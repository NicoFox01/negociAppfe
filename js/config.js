// Configuración Global

// Detectamos si estamos en local o en producción automáticamente
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// URL del Backend
// - En local: http://localhost:8000
// - En produccion: La URL que configures aquí (la de tu deploy en Render/Railway/Vercel)
export const API_BASE_URL = isLocal 
    ? 'http://localhost:8000' 
    : 'https://negociapp-be.vercel.app';

export const API_V1_STR = '/api/v1';

export const FULL_API_URL = `${API_BASE_URL}${API_V1_STR}`;
