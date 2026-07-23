const API_URL = '/api';
let adminToken = localStorage.getItem('immovi_admin_token');

// Elements
const loginView = document.getElementById('login-view');
const adminInterface = document.getElementById('admin-interface');
const loginForm = document.getElementById('admin-login-form');
const btnLogout = document.getElementById('btn-logout');
const loadingOverlay = document.getElementById('loading-overlay');
const navPills = document.querySelectorAll('.nav-pill');
const views = document.querySelectorAll('.admin-view');

// Check auth on load
document.addEventListener('DOMContentLoaded', () => {
  if (adminToken) {
    showInterface();
    loadDashboard();
  } else {
    showLogin();
  }
});

// Auth Flow
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('admin-email').value;
  const password = document.getElementById('admin-password').value;
  
  showLoading();
  try {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    
    const response = await fetch(`${API_URL}/auth/token`, {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Login failed');
    
    adminToken = data.access_token;
    localStorage.setItem('immovi_admin_token', adminToken);
    
    showToast('Connexion réussie', 'success');
    showInterface();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
});

btnLogout.addEventListener('click', () => {
  localStorage.removeItem('immovi_admin_token');
  adminToken = null;
  showLogin();
});

// Navigation
navPills.forEach(pill => {
  pill.addEventListener('click', () => {
    // switch active class on pill
    navPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    
    // switch active class on view
    const targetId = pill.getAttribute('data-target');
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    
    // load data based on view
    if (targetId === 'view-users') loadUsers();
    else if (targetId === 'view-agencies') loadAgencies();
    else if (targetId === 'view-properties') loadProperties();
    else if (targetId === 'view-stats') loadDashboard();
    else if (targetId === 'view-journal') loadJournal();
  });
});

// API Calls
async function fetchApi(endpoint) {
  const response = await fetch(`${API_URL}/admin${endpoint}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('immovi_admin_token');
    showLogin();
    throw new Error('Non autorisé');
  }
  return response.json();
}

async function loadDashboard() {
  try {
    const data = await fetchApi('/dashboard');
    document.getElementById('stat-users').innerText = data.stats.users;
    document.getElementById('stat-agencies').innerText = data.stats.agencies;
    document.getElementById('stat-revenue').innerText = data.stats.revenue.toLocaleString('fr-FR');
    document.getElementById('stat-properties').innerText = data.stats.properties;
    
    loadUsers(); // Default load
  } catch (e) {
    console.error(e);
  }
}

async function loadUsers() {
  try {
    const users = await fetchApi('/users');
    const tbody = document.getElementById('tbody-users');
    document.getElementById('users-count').innerText = users.length;
    
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div class="user-cell">
            <div class="avatar">${u.name.substring(0,2).toUpperCase()}</div>
            <div class="user-info">
              <span class="user-name">${u.name}</span>
              <span class="user-email">${u.email}</span>
            </div>
          </div>
        </td>
        <td>${u.phone || '-'}</td>
        <td>${u.agency}</td>
        <td><span class="badge badge-blue">${u.subscription_plan}</span></td>
        <td><span class="badge ${u.status === 'Actif' ? 'badge-green' : 'badge-orange'}"><i class="fa-solid fa-check"></i> ${u.status}</span></td>
        <td>${u.subscription_expiry || '-'}</td>
        <td>
          <button class="btn-icon" title="Voir"><i class="fa-solid fa-eye"></i></button>
          <button class="btn-icon danger" title="Suspendre/Supprimer"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  } catch(e) {}
}

async function loadAgencies() {
  try {
    const agencies = await fetchApi('/agencies');
    const tbody = document.getElementById('tbody-agencies');
    tbody.innerHTML = agencies.map(a => `
      <tr>
        <td>#${a.id.substring(0,6)}</td>
        <td><strong>${a.name}</strong></td>
        <td>${a.manager_name || '-'}</td>
        <td>${a.email}</td>
        <td>${a.phone || '-'}</td>
        <td><span class="badge badge-blue">${a.subscription_plan}</span></td>
        <td>
          <button class="btn-icon"><i class="fa-solid fa-pen"></i></button>
        </td>
      </tr>
    `).join('');
  } catch(e) {}
}

async function loadProperties() {
  try {
    const properties = await fetchApi('/properties');
    const tbody = document.getElementById('tbody-properties');
    tbody.innerHTML = properties.map(p => `
      <tr>
        <td>#${p.id.substring(0,6)}</td>
        <td><strong>${p.name}</strong></td>
        <td>${p.type}</td>
        <td><span class="badge badge-gray">${p.status}</span></td>
        <td>${p.agency}</td>
        <td>${p.owner}</td>
      </tr>
    `).join('');
  } catch(e) {}
}

async function loadJournal() {
  try {
    const logs = await fetchApi('/activity');
    const tbody = document.getElementById('tbody-journal');
    tbody.innerHTML = logs.map(l => `
      <tr>
        <td>#${l.id}</td>
        <td>${l.date}</td>
        <td><span class="badge badge-gray">${l.action}</span></td>
        <td>${l.details}</td>
      </tr>
    `).join('');
  } catch(e) {}
}

// Helpers
function showLogin() {
  loginView.style.display = 'flex';
  adminInterface.style.display = 'none';
}
function showInterface() {
  loginView.style.display = 'none';
  adminInterface.style.display = 'flex';
}
function showLoading() { loadingOverlay.style.display = 'flex'; }
function hideLoading() { loadingOverlay.style.display = 'none'; }

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'}"></i> <span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
