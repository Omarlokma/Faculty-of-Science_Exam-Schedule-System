/**
 * ============================================
 * API Configuration & Auth Helper
 * ============================================
 * Central file for all API communication.
 * All other JS files use the functions here.
 */

const API_BASE = 'https://faculty-of-science-final-exam.free.laravel.cloud/api';
const API = {
    // Auth
    LOGIN:    `${API_BASE}/login`,
    REGISTER: `${API_BASE}/register`,
    LOGOUT:   `${API_BASE}/logout`,
    USER:     `${API_BASE}/user`,

    // Resources
    COURSES:  `${API_BASE}/courses`,
    IMPORT_COURSES: `${API_BASE}/courses/import`,
    SECTIONS: `${API_BASE}/sections`,
    LAIHAS:   `${API_BASE}/laihas`,
    LEVELS:   `${API_BASE}/levels`,
};

// ---- Token Management ----
const Auth = {
    getToken() {
        return localStorage.getItem('auth_token');
    },
    setToken(token) {
        localStorage.setItem('auth_token', token);
    },
    setUser(user) {
        localStorage.setItem('auth_user', JSON.stringify(user));
    },
    getUser() {
        try {
            return JSON.parse(localStorage.getItem('auth_user'));
        } catch { return null; }
    },
    clear() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
    },
    isLoggedIn() {
        return !!this.getToken();
    }
};

// ---- Authenticated Fetch Helper ----
/**
 * Makes a fetch request with the auth token and JSON headers.
 * Also adds ngrok-skip-browser-warning to bypass ngrok interstitial page.
 * @param {string} url - The API endpoint URL
 * @param {object} options - fetch options (method, body, etc.)
 * @returns {Promise<Response>}
 */
async function apiFetch(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
    };

    const token = Auth.getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    // If 401 Unauthorized, redirect to login
    if (response.status === 401) {
        Auth.clear();
        window.location.href = 'login.html';
        return;
    }

    return response;
}
