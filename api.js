// Fichier de communication avec l'API Backend (Railway)

// TODO: Remplacer par l'URL publique fournie par Railway (ex: https://immovia-production.up.railway.app)
// Si on est en local, on utilise localhost, sinon l'URL de production
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000/api'
    : '/api'; 

// --- GESTION DU TOKEN JWT ---
function getAuthToken() {
  return localStorage.getItem('immovi_jwt');
}

function setAuthToken(token) {
  localStorage.setItem('immovi_jwt', token);
}

function removeAuthToken() {
  localStorage.removeItem('immovi_jwt');
}

// Fonction générique pour faire les appels API avec le token de sécurité
async function apiFetch(endpoint, options = {}) {
  const token = getAuthToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // Non autorisé ou token expiré -> on renvoie vers le login
    removeAuthToken();
    window.location.href = 'login.html';
    throw new Error('Session expirée');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Une erreur est survenue avec le serveur');
  }

  return response.json();
}

// --- APPELS API SPÉCIFIQUES ---

const API = {
  // Authentification
  register: async (name, email, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        email,
        password,
        role: "Manager",
        permissions: ["all"]
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Erreur lors de l\'inscription');
    }
    return await response.json();
  },

  login: async (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await fetch(`${API_BASE_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData
    });
    
    if (!response.ok) {
        throw new Error('Email ou mot de passe incorrect');
    }
    const data = await response.json();
    setAuthToken(data.access_token);
    return data;
  },
  
  getCurrentUser: () => apiFetch('/auth/me'),

  // Bailleurs (Owners)
  getOwners: () => apiFetch('/owners/'),
  createOwner: (owner) => apiFetch('/owners/', { method: 'POST', body: JSON.stringify(owner) }),
  updateOwner: (id, owner) => apiFetch(`/owners/${id}`, { method: 'PUT', body: JSON.stringify(owner) }),
  deleteOwner: (id) => apiFetch(`/owners/${id}`, { method: 'DELETE' }),

  // Biens (Properties)
  getProperties: () => apiFetch('/properties/'),
  createProperty: (prop) => apiFetch('/properties/', { method: 'POST', body: JSON.stringify(prop) }),
  updateProperty: (id, prop) => apiFetch(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(prop) }),
  deleteProperty: (id) => apiFetch(`/properties/${id}`, { method: 'DELETE' }),

  // Locataires (Tenants)
  getTenants: () => apiFetch('/tenants/'),
  createTenant: (tenant) => apiFetch('/tenants/', { method: 'POST', body: JSON.stringify(tenant) }),
  updateTenant: (id, tenant) => apiFetch(`/tenants/${id}`, { method: 'PUT', body: JSON.stringify(tenant) }),
  deleteTenant: (id) => apiFetch(`/tenants/${id}`, { method: 'DELETE' }),

  // Transactions
  getTransactions: () => apiFetch('/transactions/'),
  createTransaction: (trans) => apiFetch('/transactions/', { method: 'POST', body: JSON.stringify(trans) }),
  updateTransaction: (id, trans) => apiFetch(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(trans) }),
  deleteTransaction: (id) => apiFetch(`/transactions/${id}`, { method: 'DELETE' }),
};
