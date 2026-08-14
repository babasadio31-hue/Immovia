const API_URL = '/api';
let adminToken = localStorage.getItem('immovii_admin_token');

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
    localStorage.setItem('immovii_admin_token', adminToken);
    
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
  localStorage.removeItem('immovii_admin_token');
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

    else if (targetId === 'view-stats') loadDashboard();
    else if (targetId === 'view-journal') loadJournal();
  });
});

// API Calls
async function fetchApi(endpoint, options = {}) {
  const response = await fetch(`${API_URL}/admin${endpoint}`, {
    ...options,
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
      ...(options.headers || {})
    }
  });
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('immovii_admin_token');
    showLogin();
    throw new Error('Non autorisé');
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Erreur lors de la requête API');
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
          <button class="btn-icon" title="Voir" onclick="viewUserDetails('${u.id}')"><i class="fa-solid fa-eye"></i></button>
          <button class="btn-icon" title="${u.status === 'Actif' ? 'Suspendre' : 'Activer'}" onclick="toggleUserStatus('${u.id}', '${u.status}')"><i class="fa-solid fa-ban"></i></button>
          <button class="btn-icon danger" title="Supprimer" onclick="deleteUser('${u.id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  } catch(e) {}
}

let currentAgenciesList = [];

async function loadAgencies() {
  try {
    currentAgenciesList = await fetchApi('/agencies');
    const tbody = document.getElementById('tbody-agencies');
    tbody.innerHTML = currentAgenciesList.map(a => {
      const statusClass = a.subscription_status === 'Actif' ? 'badge-green' : (a.subscription_status === 'Suspendu' ? 'badge-warning' : 'badge-danger');
      const statusLabel = a.subscription_status || 'Actif';
      const expiryLabel = a.subscription_expiry || '-';
      return `
      <tr>
        <td>#${a.id.substring(0,6)}</td>
        <td><strong>${a.name}</strong></td>
        <td>${a.manager_name || '-'}</td>
        <td>${a.email}</td>
        <td>${a.phone || '-'}</td>
        <td><span class="badge badge-blue">${a.subscription_plan || 'Essai'}</span></td>
        <td><span class="badge ${statusClass}">${statusLabel}</span></td>
        <td><span style="color: ${a.subscription_status === 'Expiré' ? '#ef4444' : '#10b981'}; font-weight: 500;">${expiryLabel}</span></td>
        <td>
          <button class="btn-icon" onclick="openEditAgencyModal('${a.id}')" title="Modifier ou activer le compte"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon danger" title="Supprimer l'agence" onclick="deleteAgency('${a.id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
    }).join('');
  } catch(e) {}
}

function openEditAgencyModal(id) {
    const agency = currentAgenciesList.find(a => a.id === id);
    if (!agency) return;
    document.getElementById('edit-agency-id').value = agency.id;
    document.getElementById('edit-agency-name').value = agency.name || '';
    document.getElementById('edit-agency-manager').value = agency.manager_name || '';
    document.getElementById('edit-agency-email').value = agency.email || '';
    document.getElementById('edit-agency-phone').value = agency.phone || '';
    document.getElementById('edit-agency-plan').value = agency.subscription_plan || 'Essai';
    const statusEl = document.getElementById('edit-agency-status');
    const expiryEl = document.getElementById('edit-agency-expiry');
    if (statusEl) statusEl.value = agency.subscription_status || 'Actif';
    if (expiryEl) expiryEl.value = agency.subscription_expiry || '';
    document.getElementById('edit-agency-modal').style.display = 'flex';
}

function closeEditAgencyModal() {
    const modal = document.getElementById('edit-agency-modal');
    if (modal) modal.style.display = 'none';
}
window.closeEditAgencyModal = closeEditAgencyModal;

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const editModal = document.getElementById('edit-agency-modal');
        const confirmModal = document.getElementById('confirm-modal');
        if (editModal && editModal.style.display === 'flex') {
            editModal.style.display = 'none';
        }
        if (confirmModal && confirmModal.style.display === 'flex') {
            confirmModal.style.display = 'none';
        }
    }
});

document.getElementById('edit-agency-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-agency-id').value;
    const data = {
        name: document.getElementById('edit-agency-name').value,
        manager_name: document.getElementById('edit-agency-manager').value,
        email: document.getElementById('edit-agency-email').value,
        phone: document.getElementById('edit-agency-phone').value,
        subscription_plan: document.getElementById('edit-agency-plan').value,
        subscription_status: document.getElementById('edit-agency-status')?.value || 'Actif',
        subscription_expiry: document.getElementById('edit-agency-expiry')?.value || ''
    };
    try {
        await fetchApi(`/agencies/${id}`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data) 
        });
        showToast('Agence modifiée avec succès', 'success');
        document.getElementById('edit-agency-modal').style.display = 'none';
        loadAgencies();
    } catch(err) {
        showToast(err.message, 'error');
    }
});

async function deleteAgency(agencyId) {
  customConfirm("ATTENTION : Voulez-vous vraiment supprimer définitivement cette agence et toutes ses données (biens, locataires, transactions, utilisateurs) ? Cette action est irréversible !", async () => {
    showLoading();
    try {
      const response = await fetch(`${API_URL}/admin/agencies/${agencyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Erreur lors de la suppression');
      
      showToast(data.message, 'success');
      loadAgencies(); // refresh list
      loadUsers();
      loadDashboard(); // refresh stats
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      hideLoading();
    }
  });
}



async function loadJournal() {
  try {
    const logs = await fetchApi('/activity');
    const tbody = document.getElementById('tbody-journal');
    if (!logs || logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; padding: 2.5rem; color: #9CA3AF;">
            <i class="fa-solid fa-clock-rotate-left" style="font-size: 2rem; margin-bottom: 0.75rem; display: block; opacity: 0.5;"></i>
            <strong style="color: #E5E7EB; font-size: 1rem;">Aucune activité enregistrée pour le moment.</strong><br>
            <span style="font-size: 0.85rem; display: inline-block; margin-top: 0.35rem; max-width: 500px;">Le Journal d'Activité enregistre l'historique de sécurité et de traçabilité de la plateforme (connexions, inscriptions, actions d'administration, alertes). Les événements s'afficheront ici automatiquement.</span>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = logs.map(l => `
        <tr>
          <td>#${l.id}</td>
          <td>${l.date}</td>
          <td><span class="badge badge-gray">${l.action}</span></td>
          <td>${l.details}</td>
        </tr>
      `).join('');
    }
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

// User Actions


// Custom Confirm Modal Logic
function customConfirm(message, callback) {
  const modal = document.getElementById('confirm-modal');
  const msgEl = document.getElementById('confirm-message');
  const btnOk = document.getElementById('btn-confirm-ok');
  const btnCancel = document.getElementById('btn-confirm-cancel');
  
  msgEl.innerText = message;
  modal.style.display = 'flex';
  
  // Clear previous listeners
  const newBtnOk = btnOk.cloneNode(true);
  const newBtnCancel = btnCancel.cloneNode(true);
  btnOk.parentNode.replaceChild(newBtnOk, btnOk);
  btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
  
  newBtnCancel.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  newBtnOk.addEventListener('click', () => {
    modal.style.display = 'none';
    callback();
  });
}

// Override toggleUserStatus
async function toggleUserStatus(userId, currentStatus) {
  customConfirm(`Voulez-vous vraiment ${currentStatus === 'Actif' ? 'suspendre' : 'activer'} cet utilisateur ?`, async () => {
    showLoading();
    try {
      const action = currentStatus === 'Actif' ? 'suspend' : 'activate';
      const response = await fetch(`${API_URL}/admin/users/${userId}/${action}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Erreur lors de l\'opération');
      
      showToast(data.message, 'success');
      loadUsers(); // refresh list
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      hideLoading();
    }
  });
}

// Override deleteUser
async function deleteUser(userId) {
  customConfirm("ATTENTION : Voulez-vous vraiment supprimer définitivement cet utilisateur et toutes ses données ? Cette action est irréversible !", async () => {
    showLoading();
    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Erreur lors de la suppression');
      
      showToast(data.message, 'success');
      loadUsers(); // refresh list
      loadDashboard(); // refresh stats
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      hideLoading();
    }
  });
}

// Show specific view manually
function showView(viewId) {
  views.forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
}

// Fetch and show user details
async function viewUserDetails(userId) {
  showLoading();
  try {
    const data = await fetchApi(`/users/${userId}/details`);
    
    // Populate view
    document.getElementById('detail-avatar').innerText = data.name.substring(0, 2).toUpperCase();
    document.getElementById('detail-name').innerText = data.name;
    document.getElementById('detail-email').innerText = data.email;
    
    const roleBadge = document.getElementById('detail-role');
    roleBadge.innerText = data.role;
    roleBadge.className = data.role === 'Super Administrateur' ? 'badge badge-purple' : 'badge badge-blue';
    
    const statusBadge = document.getElementById('detail-status');
    statusBadge.innerHTML = `<i class="fa-solid ${data.status === 'Actif' ? 'fa-check' : 'fa-ban'}"></i> ${data.status}`;
    statusBadge.className = data.status === 'Actif' ? 'badge badge-green' : 'badge badge-orange';
    
    document.getElementById('detail-agency').innerText = data.agency_name;
    document.getElementById('detail-phone').innerText = data.agency_phone || 'Non renseigné';
    document.getElementById('detail-date').innerText = data.date_added || 'Inconnue';
    
    document.getElementById('detail-prop-count').innerText = data.properties_count;
    document.getElementById('detail-owner-count').innerText = data.owners_count;
    document.getElementById('detail-tenant-count').innerText = data.tenants_count;
    
    // Switch to view
    showView('view-user-details');
    
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

// --- MESSAGERIE & SUPPORT LOGIC ---

function switchMsgTab(tabId) {
  // Hide all tabs
  document.getElementById('tab-contact').style.display = 'none';
  document.getElementById('tab-tickets').style.display = 'none';
  document.getElementById('tab-news').style.display = 'none';
  
  // Reset buttons
  document.getElementById('tab-btn-contact').className = 'btn-secondary';
  document.getElementById('tab-btn-tickets').className = 'btn-secondary';
  document.getElementById('tab-btn-news').className = 'btn-secondary';
  
  // Show selected
  document.getElementById(`tab-${tabId}`).style.display = 'block';
  document.getElementById(`tab-btn-${tabId}`).className = 'btn-primary';
  
  if (tabId === 'contact') loadContactMessages();
  if (tabId === 'tickets') loadSupportTickets();
}

async function loadContactMessages() {
  try {
    const messages = await fetchApi('/messages');
    const tbody = document.getElementById('tbody-contact');
    tbody.innerHTML = '';
    
    if (messages.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Aucun message reçu.</td></tr>';
        return;
    }
    
    messages.forEach(msg => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${msg.date}</td>
        <td><strong>${msg.name}</strong></td>
        <td>${msg.email}</td>
        <td>${msg.phone}</td>
        <td><span class="badge ${msg.status === 'Non lu' ? 'badge-orange' : 'badge-green'}">${msg.status}</span></td>
        <td>
          <button class="btn-icon" title="Lire" onclick="viewMessage('${msg.id}', '${msg.name.replace(/'/g, "\'")}', '${msg.email.replace(/'/g, "\'")}', '${msg.phone.replace(/'/g, "\'")}', '${msg.message.replace(/'/g, "\'").replace(/\n/g, "\\n")}')"><i class="fa-solid fa-eye"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Erreur messages:", err);
  }
}

async function loadSupportTickets() {
  try {
    const tickets = await fetchApi('/tickets');
    const tbody = document.getElementById('tbody-tickets');
    tbody.innerHTML = '';
    
    // Check if table header needs an update for Author
    const thead = tbody.closest('table').querySelector('thead tr');
    if (!thead.querySelector('.th-author')) {
        const th = document.createElement('th');
        th.className = 'th-author';
        th.innerText = 'AUTEUR / AGENCE';
        thead.insertBefore(th, thead.children[2]);
    }
    
    if (tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Aucun ticket de support.</td></tr>';
        return;
    }
    
    tickets.forEach(ticket => {
      const tr = document.createElement('tr');
      
      const safeSubject = (ticket.subject || '').replace(/'/g, "\'").replace(/"/g, '&quot;');
      const safeMessage = (ticket.message || '').replace(/'/g, "\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n');
      const safeAuthor = (ticket.author || 'Anonyme').replace(/'/g, "\'");
      const safeEmail = (ticket.email || 'Non spécifié').replace(/'/g, "\'");
      const safeAgency = (ticket.agency || 'Aucune').replace(/'/g, "\'");
      
      tr.innerHTML = `
        <td>#${ticket.id.substring(0,6)}</td>
        <td>${ticket.date ? ticket.date.substring(0,10) : ''}</td>
        <td>
            <div style="font-weight:bold;">${ticket.author}</div>
            <div style="font-size:0.85em; color:var(--color-text-muted);">${ticket.agency !== 'Aucune' ? ticket.agency : ticket.email}</div>
        </td>
        <td><strong>${ticket.subject}</strong></td>
        <td>${ticket.category}</td>
        <td><span class="badge ${ticket.priority === 'Haute' ? 'badge-orange' : 'badge-blue'}">${ticket.priority}</span></td>
        <td><span class="badge badge-purple">${ticket.status}</span></td>
        <td>
          <button class="btn-icon" title="Voir détails" onclick="viewTicketDetails('${ticket.id}', '${safeSubject}', '${safeAuthor}', '${safeAgency}', '${safeEmail}', '${safeMessage}', '${ticket.status}')"><i class="fa-solid fa-eye"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Erreur tickets:", err);
  }
}

async function viewTicketDetails(id, subject, author, agency, email, message, status) {
  // First, show the modal with a loading state for messages
  const modalId = `ticket-modal-${id}`;
  const modalHTML = `
    <div id="${modalId}" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; align-items:center; justify-content:center;">
      <div style="background:var(--color-surface); width:600px; max-width:95%; max-height:90vh; border-radius:12px; display:flex; flex-direction:column; overflow:hidden;">
        <div style="padding:20px; border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Ticket: ${subject}</h3>
          <button onclick="document.getElementById('${modalId}').remove()" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer;"><i class="fa-solid fa-times"></i></button>
        </div>
        <div style="padding:20px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap: 15px;" id="${modalId}-body">
          <div style="display:flex; justify-content:space-between; padding:15px; background:var(--color-background); border-radius:8px;">
            <div>
                <p style="margin:0 0 5px 0;"><strong>Auteur:</strong> ${author}</p>
                <p style="margin:0 0 5px 0;"><strong>Email:</strong> ${email}</p>
            </div>
            <div>
                <p style="margin:0;"><strong>Agence:</strong> ${agency}</p>
            </div>
          </div>
          <div style="padding:15px; border:1px solid var(--color-border); border-radius:8px; background:var(--color-background); color:var(--color-text);">
            <strong style="display:block; margin-bottom:5px;">Description initiale :</strong>
            <span style="white-space:pre-wrap; line-height:1.6;">${message}</span>
          </div>
          <hr style="border: 0; border-top: 1px solid var(--color-border); margin: 5px 0;">
          <div id="${modalId}-messages" style="display:flex; flex-direction:column; gap:10px;">
            <div style="text-align:center; color:var(--color-text-muted);">Chargement des messages...</div>
          </div>
        </div>
        <div style="padding:15px 20px; border-top:1px solid var(--color-border); background:var(--color-background);">
          <form id="${modalId}-form" style="display:flex; gap:10px;">
            <textarea id="${modalId}-textarea" required rows="2" style="flex:1; padding:10px; border-radius:6px; border:1px solid var(--color-border); background:var(--color-surface); color:var(--color-text); resize:none;" placeholder="${status === 'Fermé' ? 'Cette demande est fermée' : 'Tapez votre réponse...'}" ${status === 'Fermé' ? 'disabled' : ''}></textarea>
            <button type="submit" class="btn-primary" style="align-self:flex-end;" ${status === 'Fermé' ? 'disabled' : ''}>Envoyer</button>
          </form>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  let msgCount = 0;
  const loadMessages = async (silent = false) => {
    try {
      const messagesContainer = document.getElementById(`${modalId}-messages`);
      const ts = new Date().getTime();
      const msgs = await fetchApi(`/tickets/${id}/messages?t=${ts}`);
      
      if (silent && msgs && msgs.length === msgCount) return;
      msgCount = msgs ? msgs.length : 0;
      
      messagesContainer.innerHTML = '';
      if (!msgs || msgs.length === 0) {
        messagesContainer.innerHTML = '<div style="text-align:center; color:var(--color-text-muted); font-style:italic;">Aucune réponse pour le moment.</div>';
        return;
      }
      msgs.forEach(msg => {
        const isAdmin = msg.sender_role === 'Admin';
        const msgDiv = document.createElement('div');
        msgDiv.style.cssText = `
          max-width: 85%; padding: 10px 15px; border-radius: 8px;
          align-self: ${isAdmin ? 'flex-end' : 'flex-start'};
          background: ${isAdmin ? 'var(--color-primary)' : 'var(--color-surface)'};
          color: ${isAdmin ? 'white' : 'var(--color-text)'};
          border: 1px solid ${isAdmin ? 'transparent' : 'var(--color-border)'};
        `;
        msgDiv.innerHTML = `
          <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 5px;">
            ${isAdmin ? 'Vous (Admin)' : 'Agence'} - ${new Date(msg.date).toLocaleString('fr-FR')}
          </div>
          <div>${msg.message.replace(/\n/g, '<br>')}</div>
        `;
        messagesContainer.appendChild(msgDiv);
      });
      const bodyEl = document.getElementById(`${modalId}-body`);
      bodyEl.scrollTop = bodyEl.scrollHeight;
    } catch (e) {
      document.getElementById(`${modalId}-messages`).innerHTML = '<div style="color:var(--color-rose); text-align:center;">Erreur lors du chargement des messages.</div>';
    }
  };

  await loadMessages();
  
  let pollInterval = setInterval(() => {
    if (!document.getElementById(modalId)) {
      clearInterval(pollInterval);
      return;
    }
    loadMessages(true);
  }, 3000);

  document.getElementById(`${modalId}-form`).addEventListener('submit', async (e) => {
    e.preventDefault();
    const txt = document.getElementById(`${modalId}-textarea`);
    const val = txt.value.trim();
    if (!val) return;
    
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerText = 'Envoi...';
    
    try {
      const res = await fetchApi(`/tickets/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: val })
      });
      
      if (res) {
        txt.value = '';
        await loadMessages();
        loadSupportTickets(); // Refresh background list
      } else {
        showToast("Erreur lors de l'envoi", "error");
      }
    } catch (err) {
      showToast("Erreur de connexion", "error");
    } finally {
      btn.disabled = false;
      btn.innerText = 'Envoyer';
    }
  });
}


async function submitNewsletter(e) {
  e.preventDefault();
  
  const payload = {
    target: document.getElementById('news-target').value,
    subject: document.getElementById('news-subject').value,
    content: document.getElementById('news-content').value
  };
  
  showLoading();
  try {
    const res = await fetch(`${API_URL}/admin/newsletters/send`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Erreur d\'envoi');
    
    showToast(data.message, 'success');
    document.getElementById('form-newsletter').reset();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}


async function viewMessage(id, subject, email, phone, text) {
  // Show a nice modal
  const modalHTML = `
    <div id="msg-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; align-items:center; justify-content:center;">
      <div style="background:var(--color-surface); width:500px; max-width:90%; border-radius:12px; overflow:hidden;">
        <div style="padding:20px; border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Message de Contact</h3>
          <button onclick="document.getElementById('msg-modal').remove()" style="background:transparent; border:none; color:var(--color-text-muted); cursor:pointer;"><i class="fa-solid fa-times"></i></button>
        </div>
        <div style="padding:20px;">
          <p><strong>De:</strong> ${subject}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Téléphone:</strong> ${phone}</p>
          <hr style="border:0; border-top:1px solid var(--color-border); margin:15px 0;">
          <p style="white-space:pre-wrap; line-height:1.5;">${text}</p>
        </div>
        <div style="padding:15px 20px; background:var(--color-background); text-align:right;">
          <button onclick="document.getElementById('msg-modal').remove()" class="btn-primary">Fermer</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  try {
    await fetchApi(`/messages/${id}/read`, { method: 'PUT' });
    // Refresh messages quietly
    setTimeout(loadContactMessages, 500);
  } catch(e) {
    console.error("Could not mark as read", e);
  }
}


// Update badges for unread messages and open tickets
async function updateMessageBadges() {
  try {
    const messages = await fetchApi('/messages');
    const tickets = await fetchApi('/tickets');
    
    let unreadMessages = 0;
    if (messages && messages.length) {
        unreadMessages = messages.filter(m => m.status === 'Non lu').length;
    }
    
    let openTickets = 0;
    if (tickets && tickets.length) {
        openTickets = tickets.filter(t => t.status === 'Ouvert' || t.status === 'En attente').length;
    }
    
    const totalUnread = unreadMessages + openTickets;
    
    const badgeNav = document.getElementById('badge-nav-emails');
    if (badgeNav) {
        badgeNav.textContent = totalUnread;
        badgeNav.style.display = totalUnread > 0 ? 'inline-block' : 'none';
    }
    
    const badgeContact = document.getElementById('badge-tab-contact');
    if (badgeContact) {
        badgeContact.textContent = unreadMessages;
        badgeContact.style.display = unreadMessages > 0 ? 'inline-block' : 'none';
    }
    
    const badgeTickets = document.getElementById('badge-tab-tickets');
    if (badgeTickets) {
        badgeTickets.textContent = openTickets;
        badgeTickets.style.display = openTickets > 0 ? 'inline-block' : 'none';
    }
  } catch(e) {
    console.error("Error updating badges", e);
  }
}

// ================= TUTORIALS (ADMIN) =================

async function loadAdminTutorials() {
  try {
    const res = await fetch(`${API_URL}/admin/tutorials`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const tutorials = await res.json();
    const tbody = document.getElementById('tbody-admin-tutorials');
    
    if (tutorials.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Aucun tutoriel.</td></tr>';
      return;
    }
    
    tbody.innerHTML = tutorials.map(tut => `
      <tr>
        <td><strong>${tut.title}</strong></td>
        <td>${tut.description.substring(0, 50)}${tut.description.length > 50 ? '...' : ''}</td>
        <td>${tut.video_url ? `<a href="${tut.video_url}" target="_blank" style="color:var(--color-primary);">Lien</a>` : '-'}</td>
        <td>${tut.date_added.substring(0,10)}</td>
        <td>
          <button class="btn-icon" title="Modifier" onclick="editAdminTutorial('${tut.id}', '${tut.title.replace(/'/g, "\\'")}', '${tut.description.replace(/'/g, "\\'").replace(/\n/g, '\\n')}', '${(tut.video_url || '').replace(/'/g, "\\'")}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon" title="Supprimer" onclick="deleteAdminTutorial('${tut.id}')"><i class="fa-solid fa-trash" style="color:var(--color-danger);"></i></button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error("Error loading tutorials", err);
  }
}

function openAdminTutorialModal() {
  document.getElementById('admin-tutorial-id').value = '';
  document.getElementById('admin-tutorial-title').value = '';
  document.getElementById('admin-tutorial-desc').value = '';
  document.getElementById('admin-tutorial-url').value = '';
  document.getElementById('admin-tutorial-modal-title').innerText = 'Ajouter un Tutoriel';
  document.getElementById('admin-tutorial-modal').style.display = 'flex';
}

function editAdminTutorial(id, title, desc, url) {
  document.getElementById('admin-tutorial-id').value = id;
  document.getElementById('admin-tutorial-title').value = title;
  document.getElementById('admin-tutorial-desc').value = desc;
  document.getElementById('admin-tutorial-url').value = url;
  document.getElementById('admin-tutorial-modal-title').innerText = 'Modifier le Tutoriel';
  document.getElementById('admin-tutorial-modal').style.display = 'flex';
}

async function deleteAdminTutorial(id) {
  if (confirm("Êtes-vous sûr de vouloir supprimer ce tutoriel ?")) {
    try {
      const res = await fetch(`${API_URL}/admin/tutorials/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) {
        showToast("Tutoriel supprimé", "success");
        loadAdminTutorials();
      } else {
        showToast("Erreur lors de la suppression", "error");
      }
    } catch (err) {
      showToast("Erreur réseau", "error");
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const tutForm = document.getElementById('admin-tutorial-form');
  if (tutForm) {
    tutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('admin-tutorial-id').value;
      const payload = {
        title: document.getElementById('admin-tutorial-title').value,
        description: document.getElementById('admin-tutorial-desc').value,
        video_url: document.getElementById('admin-tutorial-url').value
      };
      
      showLoading();
      try {
        let url = `${API_URL}/admin/tutorials`;
        let method = 'POST';
        if (id) {
          url += `/${id}`;
          method = 'PUT';
        }
        
        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify(payload)
        });
        
        if (res.ok) {
          showToast(id ? "Tutoriel mis à jour" : "Tutoriel ajouté", "success");
          document.getElementById('admin-tutorial-modal').style.display = 'none';
          loadAdminTutorials();
        } else {
          showToast("Erreur lors de l'enregistrement", "error");
        }
      } catch (err) {
        showToast("Erreur réseau", "error");
      } finally {
        hideLoading();
      }
    });
  }
  
  // Hook up loadAdminTutorials to the view showing
  const navPillsLocal = document.querySelectorAll('.nav-pill');
  navPillsLocal.forEach(pill => {
    pill.addEventListener('click', () => {
      if (pill.dataset.target === 'view-tutorials') {
        loadAdminTutorials();
      }
    });
  });
});
