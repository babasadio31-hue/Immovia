/* ==========================================================================
   Immovi - Moteur de Gestion d'Agence Immobilière (FCFA)
   ========================================================================== */

// État Global de l'Agence
let state = {
  owners: [],      // [ { id, name, phone, email, commissionRate } ]
  properties: [],  // [ { id, name, address, ownerId, rent, status } ]
  transactions: [], // [ { id, description, amount, type, propertyId, date } ]
  staff: [],       // [ { id, name, phone, email, role, status, dateAdded } ]
  agencySettings: {} // { name, address, phone, email, currency, commissionRate }
};

// Références globales pour Chart.js
let charts = {
  dashboardOverview: null,
  analyticsExpenses: null,
  analyticsIncome: null,
  analyticsTrends: null
};

// ==========================================================================
// Initialisation & Persistance Locale
// ==========================================================================

function initApp() {
  
  

  // Initialisation par défaut si le state ne contenait pas ces nouveaux attributs
  let dataChanged = false;
  if (!state.agencySettings || Object.keys(state.agencySettings).length === 0) {
    state.agencySettings = {
      name: 'Immovi S.A.R.L',
      address: 'Rue du Golf, Immeuble Horizon, Bamako, Mali',
      phone: '+223 20 22 44 66',
      email: 'contact@immovi.ml',
      currency: 'FCFA',
      commissionRate: 10
    };
    dataChanged = true;
  }
  
  const allPermissions = ['dashboard', 'owners', 'tenants', 'properties', 'accounting', 'staff', 'settings'];
  

  if (dataChanged) {
  }
  
  setupEventListeners();
  populateDropdowns();
  renderGlobalPrintHeader();
    applyThemeUI();
  
  // Date du jour par défaut
  document.getElementById('input-tx-date').value = getTodayDateString();
  
  // Onglet initial
  switchTab('dashboard');
  showToast('Immovi : Système chargé avec succès.', 'success');
}

function applyUserSession(userId) {
  const user = state.staff.find(s => s.id === userId);
  if (!user) return;
  
  // Update UI Sidebar
  const avatarEl = document.getElementById('sidebar-user-avatar');
  const nameEl = document.getElementById('sidebar-user-name');
  const roleEl = document.getElementById('sidebar-user-role');
  
  if (avatarEl) avatarEl.textContent = user.name.substring(0, 2).toUpperCase();
  if (nameEl) nameEl.textContent = user.name;
  if (roleEl) roleEl.textContent = user.role;
  
  // Enforce Permissions (Hide unallowed tabs)
  const allPermissions = ['dashboard', 'owners', 'tenants', 'properties', 'accounting', 'staff', 'settings'];
  allPermissions.forEach(perm => {
    const btn = document.getElementById('btn-nav-' + perm);
    if (btn) {
      if (user.permissions && user.permissions.includes(perm)) {
        btn.style.display = 'flex';
      } else {
        btn.style.display = 'none';
      }
    }
  });
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  const user = state.staff.find(s => s.email === email && s.password === password);
  if (user) {
    if (user.status !== 'Actif') {
      showToast('Votre compte est inactif.', 'error');
      return;
    }
    sessionStorage.setItem('immovi_session', user.id);
    document.getElementById('login-password').value = '';
    async function startApp() {
  const token = getAuthToken();
  if (!token) {
    window.location.href = 'login.html';
    return;
  }
  await loadData();
  // Call the original initApp logic synchronously now that data is loaded
  initApp();
}
startApp(); // reload the app with session
  } else {
    showToast('Email ou mot de passe incorrect.', 'error');
  }
}

function handleLogout() {
  removeAuthToken();
  localStorage.removeItem('immovi_local_user');
  sessionStorage.removeItem('immovi_session');
  window.location.href = 'login.html';
}

async function loadData() {
  try {
    const [apiOwners, apiProperties, apiTenants, apiTransactions, apiSettings, apiUsers] = await Promise.all([
      API.getOwners().catch(() => []),
      API.getProperties().catch(() => []),
      API.getTenants().catch(() => []),
      API.getTransactions().catch(() => []),
      API.getSettings().catch(() => null),
      (typeof API.getUsers === 'function') ? API.getUsers().catch(() => []) : Promise.resolve([])
    ]);
    state.owners = (apiOwners || []).map(o => {
        let cr = 10;
        let actualNotes = o.notes || "";
        if (o.notes && o.notes.startsWith('{')) {
          try {
            const parsed = JSON.parse(o.notes);
            if (parsed.commissionRate !== undefined) cr = parsed.commissionRate;
            if (parsed.notes !== undefined) actualNotes = parsed.notes;
          } catch(e) {}
        }
        return {
          ...o,
          commissionRate: cr,
          notes: actualNotes
        };
      });
    state.properties = (apiProperties || []).map(p => ({
      ...p,
      ownerId: p.owner_id,
      rent: p.rent_amount !== null && p.rent_amount !== undefined ? p.rent_amount : (p.price || 0),
      commissionRate: p.commission_rate
    }));
    state.transactions = (apiTransactions || []).map(t => ({
      ...t,
      propertyId: t.property_id
    }));
    state.tenants = (apiTenants || []).map(t => ({
      ...t,
      propertyId: t.property_id,
      rent: t.rent_amount,
      caution: t.caution_amount
    }));

    state.staff = (apiUsers || []).map(u => ({
      ...u,
      dateAdded: u.date_added
    }));
    
    const currentTheme = localStorage.getItem('immovi_theme') || (state.agencySettings && state.agencySettings.theme) || 'dark';
    if (apiSettings && apiSettings.name) {
      state.agencySettings = {
        ...state.agencySettings,
        name: apiSettings.name,
        address: apiSettings.address,
        phone: apiSettings.phone,
        email: apiSettings.email,
        currency: apiSettings.currency || 'FCFA',
        commissionRate: apiSettings.commission_rate !== null && apiSettings.commission_rate !== undefined ? apiSettings.commission_rate : 10,
        nif: apiSettings.nif || '',
        slogan: apiSettings.slogan || '',
        logoBase64: apiSettings.logo_base64 || null,
        theme: currentTheme
      };
    }
    renderGlobalPrintHeader();
    applyThemeUI();
  } catch (e) {
    console.error("Erreur API:", e);
  }
}




// ==========================================================================
// Remplissage des Listes Déroulantes des Modales
// ==========================================================================

function populateDropdowns() {
  // Propriétaires pour le formulaire de création de bien
  const ownerSelect = document.getElementById('select-property-owner');
  if (ownerSelect) {
    ownerSelect.innerHTML = '';
    state.owners.forEach(owner => {
      ownerSelect.innerHTML += `<option value="${owner.id}">${owner.name}</option>`;
    });
  }

  // Biens pour le formulaire de transaction
  const propSelect = document.getElementById('select-tx-property');
  if (propSelect) {
    propSelect.innerHTML = '<option value="">Aucun (Dépense Agence)</option>';
    state.properties.forEach(prop => {
      propSelect.innerHTML += `<option value="${prop.id}">${prop.name} (${prop.address})</option>`;
    });
  }

  // Auto-fill commission rate when property owner is selected
  const selectPropertyOwner = document.getElementById('select-property-owner');
  if (selectPropertyOwner) {
    selectPropertyOwner.removeEventListener('change', handlePropertyOwnerChange);
    selectPropertyOwner.addEventListener('change', handlePropertyOwnerChange);
  }
  
  // Catégorie filtre (Toutes les catégories pour la table de transactions)
  populateCategorySelects();
}

function populateCategorySelects() {
  const filterCatSelect = document.getElementById('select-filter-category');
  if (filterCatSelect) {
    filterCatSelect.innerHTML = '<option value="all">Toutes les catégories</option>';
    state.properties.forEach(prop => {
      filterCatSelect.innerHTML += `<option value="${prop.id}">${prop.name}</option>`;
    });
  }
}

// ==========================================================================
// Liaisons d'Événements
// ==========================================================================

function handlePropertyOwnerChange(e) {
  const owner = state.owners.find(o => o.id === e.target.value);
  if (owner) {
    const commissionInput = document.getElementById('input-property-commission');
    if (commissionInput) commissionInput.value = owner.commissionRate;
  }
}

// Helper pour lier les filtres de date globalement
function setupDateFilterControls(typeId, dayId, monthId, yearId, callback) {
  const filterType = document.getElementById(typeId);
  const filterDay = document.getElementById(dayId);
  const filterMonth = document.getElementById(monthId);
  const filterYear = document.getElementById(yearId);
  
  if (filterType) {
    filterType.addEventListener('change', (e) => {
      const val = e.target.value;
      if (filterDay) filterDay.style.display = val === 'day' ? 'block' : 'none';
      if (filterMonth) filterMonth.style.display = val === 'month' ? 'block' : 'none';
      if (filterYear) filterYear.style.display = val === 'year' ? 'block' : 'none';
      callback();
    });
  }
  if (filterDay) filterDay.addEventListener('change', callback);
  if (filterMonth) filterMonth.addEventListener('change', callback);
  if (filterYear) filterYear.addEventListener('input', callback);
}

function setupEventListeners() {

  // Onglets Paramètres (Général / Apparence)
  const settingsTabBtns = document.querySelectorAll('.settings-tab-btn');
  settingsTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Deactivate all
      settingsTabBtns.forEach(b => {
        b.classList.remove('active');
        b.style.borderBottomColor = 'transparent';
        b.style.color = 'var(--color-text-muted)';
      });
      document.querySelectorAll('#view-settings .settings-tab-content').forEach(c => {
        c.style.display = 'none';
        c.classList.remove('active');
      });
      
      // Activate clicked
      btn.classList.add('active');
      btn.style.borderBottomColor = 'var(--color-primary)';
      btn.style.color = 'var(--color-text-primary)';
      const targetId = btn.getAttribute('data-settings-target');
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.style.display = 'block';
        targetContent.classList.add('active');
      }
    });
  });
  // Onglets principaux
  document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  // Ouverture des modales
  document.getElementById('btn-open-owner-modal').addEventListener('click', () => openOwnerModal());
  document.getElementById('btn-open-property-modal').addEventListener('click', () => openPropertyModal());

  // Checkbox staff permissions select all
  const btnStaffSelectAll = document.getElementById('btn-staff-select-all');
  if (btnStaffSelectAll) {
    btnStaffSelectAll.addEventListener('click', () => {
      document.querySelectorAll('.staff-permission-cb').forEach(cb => cb.checked = true);
    });
  }

  // Auth Form
  const formLogin = document.getElementById('form-login');
  if (formLogin) {
    formLogin.addEventListener('submit', handleLogin);
  }
  
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', handleLogout);
  }

  // Ouverture modale Nouvelle Dépense
  const btnAddExpense = document.getElementById('btn-accounting-add-expense');
  if (btnAddExpense) {
    btnAddExpense.addEventListener('click', () => {
      document.getElementById('form-transaction').reset();
      document.getElementById('input-tx-id').value = '';
      document.getElementById('input-tx-date').value = getTodayDateString();
      const motifAutreInput = document.getElementById('input-tx-motif-autre');
      if (motifAutreInput) motifAutreInput.style.display = 'none';
      document.getElementById('modal-transaction').classList.add('active');
    });
  }

  // Changement motif de dépense
  const selectTxMotif = document.getElementById('select-tx-motif');
  if (selectTxMotif) {
    selectTxMotif.addEventListener('change', (e) => {
      const motifAutreInput = document.getElementById('input-tx-motif-autre');
      if (motifAutreInput) {
        if (e.target.value === 'Autre') {
          motifAutreInput.style.display = 'block';
          motifAutreInput.required = true;
        } else {
          motifAutreInput.style.display = 'none';
          motifAutreInput.required = false;
        }
      }
    });
  }

  // Raccourcis Dashboard
  document.getElementById('btn-see-all-transactions').addEventListener('click', () => switchTab('transactions'));
  document.getElementById('btn-nav-to-owners').addEventListener('click', () => switchTab('owners'));
  document.getElementById('btn-nav-to-properties').addEventListener('click', () => switchTab('properties'));

  // Fermetures des modales
  document.getElementById('btn-close-transaction-modal').addEventListener('click', () => closeAllModals());
  document.getElementById('btn-close-owner-modal').addEventListener('click', () => closeAllModals());
  document.getElementById('btn-close-property-modal').addEventListener('click', () => closeAllModals());
  
  document.getElementById('btn-cancel-transaction').addEventListener('click', () => closeAllModals());
  document.getElementById('btn-cancel-owner').addEventListener('click', () => closeAllModals());
  document.getElementById('btn-cancel-property').addEventListener('click', () => closeAllModals());
  
  // Retour à la liste des propriétaires
  document.getElementById('btn-back-to-owners').addEventListener('click', () => switchTab('owners'));

  // Helper pour lier les filtres de date (Dashboard, Entrées, Sorties)
  // (Moved to global scope)

  setupDateFilterControls('sorties-filter-type', 'sorties-filter-day', 'sorties-filter-month', 'sorties-filter-year', () => renderAccounting());
  setupDateFilterControls('entrees-filter-type', 'entrees-filter-day', 'entrees-filter-month', 'entrees-filter-year', () => renderAccounting());
  setupDateFilterControls('dashboard-filter-type', 'dashboard-filter-day', 'dashboard-filter-month', 'dashboard-filter-year', () => renderDashboard());
  
  const btnPrintEntrees = document.getElementById('btn-print-entrees');
  if (btnPrintEntrees) {
    btnPrintEntrees.addEventListener('click', () => {
      document.body.classList.add('print-entrees-active');
      window.print();
      document.body.classList.remove('print-entrees-active');
    });
  }

  const btnPrintSorties = document.getElementById('btn-print-sorties');
  if (btnPrintSorties) {
    btnPrintSorties.addEventListener('click', () => {
      document.body.classList.add('print-sorties-active');
      window.print();
      document.body.classList.remove('print-sorties-active');
    });
  }

  const btnPrintTenantDossier = document.getElementById('btn-print-tenant-dossier');
  if (btnPrintTenantDossier) {
    btnPrintTenantDossier.addEventListener('click', () => {
      document.body.classList.add('print-tenant-dossier-active');
      window.print();
      document.body.classList.remove('print-tenant-dossier-active');
    });
  }
  // Sous-onglets de la fiche propriétaire
  document.querySelectorAll('.owner-sub-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.owner-sub-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      document.querySelectorAll('.owner-panel').forEach(panel => panel.classList.remove('active'));
      const subtab = btn.getAttribute('data-subtab');
      document.getElementById(`panel-owner-${subtab}`).classList.add('active');
    });
  });

  const editOwnerCommission = document.getElementById('input-edit-owner-commission');
  if (editOwnerCommission) {
    editOwnerCommission.addEventListener('change', async (e) => {
      const newRate = parseInt(e.target.value);
      if (!isNaN(newRate) && state.activeOwnerId) {
        const owner = state.owners.find(o => o.id === state.activeOwnerId);
        if (owner) {
          try {
            owner.commissionRate = newRate;
            await API.updateOwner(owner.id, {
              type: owner.type || "Particulier",
              name: owner.name,
              cni: owner.cni || "",
              phone: owner.phone,
              email: owner.email || "",
              address: owner.address || "Non spécifiée",
              notes: JSON.stringify({ commissionRate: owner.commissionRate, notes: owner.notes || "" }),
              avatar_url: owner.avatar_url || ""
            });
            openOwnerDossier(state.activeOwnerId); // Refresh dossier
            showToast(`Honoraires mis à jour (${newRate}%)`, 'success');
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      }
    });
  }

  // Boutons du reçu de retrait de loyer
  document.getElementById('btn-receipt-add-row').addEventListener('click', () => {
    addReceiptRow(null);
  });
  document.getElementById('btn-print-receipt').addEventListener('click', () => {
    document.body.classList.add('print-receipt-active');
    window.print();
    document.body.classList.remove('print-receipt-active');
  });
  document.getElementById('btn-save-receipt').addEventListener('click', handleSaveReceipt);
  document.getElementById('btn-clear-receipt').addEventListener('click', handleClearReceiptTable);

  document.getElementById('btn-clear-fonds').addEventListener('click', () => {
      showCustomConfirm("Voulez-vous supprimer définitivement l'historique des retraits et dépenses de ce bailleur ? Cette action est irréversible.").then(async confirmed => {
        if (confirmed) {
          const ownerProperties = state.properties.filter(p => p.ownerId === state.activeOwnerId);
          const ownerPropIds = ownerProperties.map(p => p.id);
          const txToDelete = state.transactions.filter(tx => tx.type === 'expense' && ownerPropIds.includes(tx.propertyId));
          await Promise.all(txToDelete.map(tx => API.deleteTransaction(tx.id)));
          state.transactions = state.transactions.filter(tx => !(tx.type === 'expense' && ownerPropIds.includes(tx.propertyId)));
          renderAccounting();
          renderDashboard();
          openOwnerDossier(state.activeOwnerId); 
          showToast("L'historique des retraits du bailleur a été définitivement supprimé.", "success");
        }
      });
    });

  document.getElementById('btn-clear-statement')?.addEventListener('click', () => {
    showCustomConfirm("Voulez-vous supprimer définitivement tout l'historique financier de ce bailleur ? Cette action est irréversible.").then(async confirmed => {
      if (confirmed) {
        const ownerProperties = state.properties.filter(p => p.ownerId === state.activeOwnerId);
        const ownerPropIds = ownerProperties.map(p => p.id);
        const txToDelete = state.transactions.filter(tx => ownerPropIds.includes(tx.propertyId));
        await Promise.all(txToDelete.map(tx => API.deleteTransaction(tx.id)));
        state.transactions = state.transactions.filter(tx => !ownerPropIds.includes(tx.propertyId));
        document.getElementById('modal-statement').classList.remove('active');
        openOwnerDossier(state.activeOwnerId);
        showToast("L'historique du relevé financier a été définitivement supprimé.", "success");
      }
    });
  });

  document.getElementById('btn-clear-entrees').addEventListener('click', () => {
    showCustomConfirm("Voulez-vous supprimer définitivement toutes les entrées financières (Recettes) ? Cette action est irréversible.").then(async confirmed => {
      if (confirmed) {
        const txToDelete = state.transactions.filter(tx => tx.type === 'income');
        await Promise.all(txToDelete.map(tx => API.deleteTransaction(tx.id)));
        state.transactions = state.transactions.filter(tx => tx.type !== 'income');
        renderAccounting();
        showToast("Toutes les entrées ont été supprimées définitivement.", "success");
      }
    });
  });

  document.getElementById('btn-clear-sorties').addEventListener('click', () => {
    showCustomConfirm("Voulez-vous supprimer définitivement toutes les sorties financières (Dépenses) ? Cette action est irréversible.").then(async confirmed => {
      if (confirmed) {
        const txToDelete = state.transactions.filter(tx => tx.type === 'expense');
        await Promise.all(txToDelete.map(tx => API.deleteTransaction(tx.id)));
        state.transactions = state.transactions.filter(tx => tx.type !== 'expense');
        renderAccounting();
        showToast("Toutes les sorties ont été supprimées définitivement.", "success");
      }
    });
  });
  
  // Gestion du Logo
  const btnUploadLogoTrigger = document.getElementById('btn-settings-upload-logo');
  if (btnUploadLogoTrigger) {
    btnUploadLogoTrigger.addEventListener('click', () => {
      document.getElementById('input-settings-upload-logo').click();
    });
  }
  const inputLogoUpload = document.getElementById('input-settings-upload-logo');
  if (inputLogoUpload) {
    inputLogoUpload.addEventListener('change', handleLogoUpload);
  }
  const btnResetLogo = document.getElementById('btn-settings-reset-logo');
  if (btnResetLogo) {
    btnResetLogo.addEventListener('click', resetLogo);
  }

  // Formulaire Agence
  const formSettingsAgency = document.getElementById('form-settings-agency');
  if (formSettingsAgency) {
    formSettingsAgency.addEventListener('submit', handleSettingsAgencySubmit);
  }

  // Modale Relevé Financier
  document.getElementById('btn-close-statement-modal').addEventListener('click', () => {
    document.getElementById('modal-statement').classList.remove('active');
  });
  document.getElementById('btn-print-statement').addEventListener('click', () => {
    document.body.classList.add('print-statement-active');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-statement-active');
    }, 1000);
  });

  // Modale Retrait de Fonds
  document.getElementById('btn-close-withdrawal-modal').addEventListener('click', () => {
    document.getElementById('modal-withdrawal').classList.remove('active');
  });
  document.getElementById('btn-cancel-withdrawal').addEventListener('click', () => {
    document.getElementById('modal-withdrawal').classList.remove('active');
  });
  document.getElementById('form-withdrawal').addEventListener('submit', handleWithdrawalSubmit);

  // Modale Locataires
  const btnOpenTenantModal = document.getElementById('btn-open-tenant-modal');
  if (btnOpenTenantModal) {
    btnOpenTenantModal.addEventListener('click', openTenantModal);
  }
  document.getElementById('btn-close-tenant-modal').addEventListener('click', () => {
    document.getElementById('modal-tenant').classList.remove('active');
  });
  document.getElementById('btn-cancel-tenant').addEventListener('click', () => {
    document.getElementById('modal-tenant').classList.remove('active');
  });
  document.getElementById('form-tenant').addEventListener('submit', handleTenantSubmit);
  
  const selectTenantProp = document.getElementById('select-tenant-property');
  if (selectTenantProp) {
    selectTenantProp.addEventListener('change', () => {
      const selectedPropId = selectTenantProp.value;
      const prop = state.properties.find(p => p.id === selectedPropId);
      if (prop) {
        document.getElementById('input-tenant-rent').value = formatCurrency(prop.rent);
        document.getElementById('input-tenant-caution').value = prop.rent * 2;
      }
    });
  }

  // Retour fiche locataire à la liste
  const btnBackToTenants = document.getElementById('btn-back-to-tenants');
  if (btnBackToTenants) {
    btnBackToTenants.addEventListener('click', () => switchTab('tenants'));
  }

  // Formulaires soumissions
  document.getElementById('form-transaction').addEventListener('submit', handleTransactionSubmit);
  document.getElementById('form-owner').addEventListener('submit', handleOwnerSubmit);
  document.getElementById('form-property').addEventListener('submit', handlePropertySubmit);
  
  // Affichage conditionnel des champs locataire dans la modale bien
  document.getElementById('select-property-status').addEventListener('change', (e) => {
    const container = document.getElementById('tenant-fields-container');
    if (container) {
      container.style.display = e.target.value === 'Loué' ? 'block' : 'none';
    }
  });

  // Toggle Location/Vente fields for modal-owner
  document.querySelectorAll('input[name="owner_prop_transaction"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'Location') {
        document.getElementById('owner-prop-location-fields').style.display = 'block';
        document.getElementById('owner-prop-vente-fields').style.display = 'none';
      } else {
        document.getElementById('owner-prop-location-fields').style.display = 'none';
        document.getElementById('owner-prop-vente-fields').style.display = 'block';
      }
    });
  });

  // Toggle Location/Vente fields for modal-property
  document.querySelectorAll('input[name="property_transaction"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'Location') {
        document.getElementById('property-location-fields').style.display = 'block';
        document.getElementById('property-vente-fields').style.display = 'none';
      } else {
        document.getElementById('property-location-fields').style.display = 'none';
        document.getElementById('property-vente-fields').style.display = 'block';
      }
    });
  });

  // Recherche / filtres transactions
  document.getElementById('input-search-transactions').addEventListener('input', filterAndRenderTransactionsTable);
  document.getElementById('select-filter-type').addEventListener('change', filterAndRenderTransactionsTable);
  document.getElementById('select-sort-order').addEventListener('change', filterAndRenderTransactionsTable);
  
  // Recherche locataires, propriétaires, biens & comptabilité
  const searchTenantsInput = document.getElementById('input-search-tenants');
  if (searchTenantsInput) {
    searchTenantsInput.addEventListener('input', renderTenantsTable);
  }
  const searchOwnersInput = document.getElementById('input-search-owners');
  if (searchOwnersInput) {
    searchOwnersInput.addEventListener('input', renderOwnersTable);
  }
  const searchPropertiesInput = document.getElementById('input-search-properties');
  if (searchPropertiesInput) {
    searchPropertiesInput.addEventListener('input', renderPropertiesGrid);
  }
  const searchAccountingInput = document.getElementById('input-search-accounting');
  if (searchAccountingInput) {
    searchAccountingInput.addEventListener('input', renderAccounting);
  }

  // Réinitialisation des données de l'agence
  document.getElementById('btn-reset-data').addEventListener('click', () => {
    showCustomConfirm('Voulez-vous vraiment réinitialiser le cache local d\'Immovi ?', false, 'Réinitialisation').then(async confirmed => {
      if (confirmed) {
        localStorage.removeItem('immovi_state');
        state = { owners: [], properties: [], transactions: [] };
        await loadData();
        populateDropdowns();
        switchTab('dashboard');
        showToast('Données d\'agence rechargées avec succès.', 'warning');
      }
    });
  });

  // Export CSV
  document.getElementById('btn-export-csv').addEventListener('click', exportToCSV);

  // Sous-onglets comptabilité
  document.querySelectorAll('.accounting-sub-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.accounting-sub-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      document.querySelectorAll('.accounting-panel').forEach(panel => {
        panel.classList.remove('active');
        panel.style.display = 'none';
      });
      const subtab = btn.getAttribute('data-subtab');
      const activePanel = document.getElementById(`panel-accounting-${subtab}`);
      if (activePanel) {
        activePanel.classList.add('active');
        activePanel.style.display = 'block';
      }
    });
  });

  // Nouveau flux de sortie direct depuis la comptabilité Sorties
  const addExpenseBtn = document.getElementById('btn-accounting-add-expense');
  if (addExpenseBtn) {
    addExpenseBtn.addEventListener('click', () => {
      openTransactionModal();
      const radioExpense = document.getElementById('type-toggle-expense');
      if (radioExpense) {
        radioExpense.checked = true;
      }
    });
  }

  // --- Événements Personnel (Staff) ---
  const btnOpenStaff = document.getElementById('btn-open-staff-modal');
  if (btnOpenStaff) btnOpenStaff.addEventListener('click', openStaffModal);
  
  const btnCloseStaff = document.getElementById('btn-close-staff-modal');
  if (btnCloseStaff) btnCloseStaff.addEventListener('click', closeAllModals);
  
  const btnCancelStaff = document.getElementById('btn-cancel-staff');
  if (btnCancelStaff) btnCancelStaff.addEventListener('click', closeAllModals);
  
  const formStaff = document.getElementById('form-staff');
  if (formStaff) formStaff.addEventListener('submit', handleStaffSubmit);

  // --- Événements Paramètres (Settings) ---
  const formSettings = document.getElementById('form-settings-agency');
  if (formSettings) formSettings.addEventListener('submit', handleSettingsAgencySubmit);
  
  const btnSettingsUploadLogo = document.getElementById('btn-settings-upload-logo');
  if (btnSettingsUploadLogo) {
    btnSettingsUploadLogo.addEventListener('click', () => {
      document.getElementById('input-logo-upload').click();
    });
  }
  
  const btnSettingsResetLogo = document.getElementById('btn-settings-reset-logo');
  if (btnSettingsResetLogo) {
    btnSettingsResetLogo.addEventListener('click', resetLogo);
  }
  
  const btnSettingsExport = document.getElementById('btn-settings-export-json');
  if (btnSettingsExport) btnSettingsExport.addEventListener('click', exportAppSaveJSON);
  
  const btnSettingsImport = document.getElementById('btn-settings-import-json');
  if (btnSettingsImport) btnSettingsImport.addEventListener('click', handleImportJSONTrigger);
  
  const inputSettingsImportFile = document.getElementById('input-settings-import-file');
  if (inputSettingsImportFile) inputSettingsImportFile.addEventListener('change', handleImportJSONFile);
  
  const btnSettingsResetData = document.getElementById('btn-settings-reset-data');
  if (btnSettingsResetData) {
    btnSettingsResetData.addEventListener('click', () => {
      document.getElementById('btn-reset-data').click();
    });
  }

  // Fermeture en cliquant en dehors de la boîte modale
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAllModals();
    });
  });
}

// ==========================================================================
// Contrôleur de Tabulations
// ==========================================================================

// Helper pour vérifier si un onglet ou une sous-vue (ex: dossier propriétaire, quittance, etc.) est autorisé
function isTabAllowed(tabName, userPerms, isSuperAdmin) {
  if (isSuperAdmin) return true;
  if (!userPerms || userPerms.length === 0) return tabName === 'dashboard';
  
  const subViewParentMap = {
    'owner-details': 'owners',
    'tenant-dossier': 'tenants',
    'tenant-details': 'tenants',
    'property-details': 'properties',
    'transactions': 'accounting',
    'analytics': 'accounting',
    'sorties': 'accounting',
    'entrées': 'accounting',
    'statement': 'owners',
    'receipt': 'owners'
  };

  const parentCategory = subViewParentMap[tabName] || tabName;
  return userPerms.includes(parentCategory) || userPerms.includes(tabName);
}

function applyUserPermissions(user) {
  if (!user) return;
  state.currentUser = user;

  const isSuperAdmin = user.role === 'Administrateur' || (user.permissions && (user.permissions.includes('all') || user.permissions.includes('*')));
  let userPerms = user.permissions || [];
  if (isSuperAdmin) {
    userPerms = ['dashboard', 'owners', 'tenants', 'properties', 'accounting', 'staff', 'settings'];
  }

  // Filtrer l'affichage des boutons du menu latéral
  document.querySelectorAll('.sidebar-menu .menu-btn').forEach(btn => {
    const tab = btn.getAttribute('data-tab');
    if (tab) {
      if (isTabAllowed(tab, userPerms, isSuperAdmin)) {
        btn.style.display = 'flex';
      } else {
        btn.style.display = 'none';
      }
    }
  });

  // Si l'onglet actif est interdit, basculer sur le premier onglet autorisé
  const activeBtn = document.querySelector('.sidebar-menu .menu-btn.active');
  const activeTab = activeBtn ? activeBtn.getAttribute('data-tab') : 'dashboard';
  if (!isTabAllowed(activeTab, userPerms, isSuperAdmin)) {
    const firstAllowed = userPerms[0] || 'dashboard';
    switchTab(firstAllowed);
  }
}

function switchTab(tabName) {
  if (state.currentUser) {
    const user = state.currentUser;
    const isSuperAdmin = user.role === 'Administrateur' || (user.permissions && (user.permissions.includes('all') || user.permissions.includes('*')));
    const userPerms = isSuperAdmin ? ['dashboard', 'owners', 'tenants', 'properties', 'accounting', 'staff', 'support', 'settings'] : (user.permissions || ['dashboard']);
    
    if (!isTabAllowed(tabName, userPerms, isSuperAdmin)) {
      showToast("Accès restreint : Vous n'avez pas l'autorisation d'accéder à cette section.", "error");
      return;
    }
  }

  document.querySelectorAll('.menu-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  document.querySelectorAll('.tab-view').forEach(view => {
    if (view.id === `view-${tabName}`) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });

  if (tabName === 'dashboard') {
    renderDashboard();
  } else if (tabName === 'owners') {
    renderOwnersTable();
  } else if (tabName === 'properties') {
    renderPropertiesGrid();
  } else if (tabName === 'transactions') {
    filterAndRenderTransactionsTable();
  } else if (tabName === 'analytics') {
    renderAnalytics();
  } else if (tabName === 'tenants') {
    renderTenantsTable();
  } else if (tabName === 'accounting') {
    renderAccounting();
  } else if (tabName === 'staff') {
    renderStaffTable();
  } else if (tabName === 'support') {
    renderSupportTickets();
  } else if (tabName === 'settings') {
    renderSettingsView();
  }
  setTimeout(adjustWrappedText, 50);
}

// ==========================================================================
// Rendu : Tableau de Bord
// ==========================================================================

function renderDashboard() {
  calculateKPIs();
  renderRecentTransactionsList();
  renderDashboardOwnersPreview();
  renderDashboardPropertiesPreview();
  renderDashboardOverviewChart();
}

function calculateKPIs() {
  let totalCollectedRents = 0;
  let totalCommissions = 0;
  let activePropertiesCount = state.properties.length;
  let occupiedPropertiesCount = 0;

  // Calcul du volume et des commissions
  state.transactions.forEach(tx => {
    // Si c'est un loyer perçu (income)
    if (tx.type === 'income') {
      if (matchesDateFilter(tx.date, 'dashboard-filter-type', 'dashboard-filter-day', 'dashboard-filter-month', 'dashboard-filter-year')) {
        totalCollectedRents += tx.amount;
        
        // Trouver le bien associé pour récupérer le commissionRate du bailleur
        const prop = state.properties.find(p => p.id === tx.propertyId);
        if (prop) {
          const owner = state.owners.find(o => o.id === prop.ownerId);
          if (owner) {
            let rate = prop.commissionRate !== undefined && prop.commissionRate !== null && !isNaN(prop.commissionRate) ? prop.commissionRate : owner.commissionRate;
            totalCommissions += (tx.amount * rate) / 100;
          }
        }
      }
    }
  });

  state.properties.forEach(prop => {
    if (prop.status === 'Loué') {
      occupiedPropertiesCount++;
    }
  });

  // Taux d'occupation
  const occupancyRate = activePropertiesCount > 0 ? Math.round((occupiedPropertiesCount / activePropertiesCount) * 100) : 0;

  // Rendu dans le DOM
  document.getElementById('val-total-commissions').textContent = formatCurrency(totalCommissions);
  document.getElementById('val-total-rents').textContent = formatCurrency(totalCollectedRents);
  document.getElementById('val-total-properties').textContent = activePropertiesCount;
  document.getElementById('val-occupancy-rate').textContent = `${occupancyRate}% Taux d'occupation`;
}

function renderRecentTransactionsList() {
  const container = document.getElementById('list-recent-transactions');
  container.innerHTML = '';

  const recent = [...state.transactions]
    .filter(tx => matchesDateFilter(tx.date, 'dashboard-filter-type', 'dashboard-filter-day', 'dashboard-filter-month', 'dashboard-filter-year'))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = '<div class="empty-state">Aucun flux financier récent.</div>';
    return;
  }

  recent.forEach(tx => {
    const isIncome = tx.type === 'income';
    const amountClass = isIncome ? 'income' : 'expense';
    const symbol = isIncome ? '+' : '-';
    
    // Trouver le bien
    const prop = state.properties.find(p => p.id === tx.propertyId);
    const propName = prop ? prop.name : 'Bien inconnu';
    const formattedDate = formatDateString(tx.date);

    container.innerHTML += `
      <div class="recent-item">
        <div class="recent-meta">
          <div class="recent-category-badge category-rent">
            IM
          </div>
          <div class="recent-title-wrap">
            <span class="recent-desc">${tx.description}</span>
            <span class="recent-date">${formattedDate} | ${propName}</span>
          </div>
        </div>
        <span class="recent-amount ${amountClass}">${symbol}${formatCurrency(tx.amount)}</span>
      </div>
    `;
  });
}

function renderDashboardOwnersPreview() {
  const container = document.getElementById('list-dashboard-owners');
  container.innerHTML = '';

  if (state.owners.length === 0) {
    container.innerHTML = '<div class="empty-state">Aucun propriétaire enregistré.</div>';
    return;
  }

  state.owners.slice(0, 4).forEach(owner => {
    // Calculer le nombre de biens
    const ownerPropertiesCount = state.properties.filter(p => p.ownerId === owner.id).length;
    const totalRentValue = state.properties
      .filter(p => p.ownerId === owner.id && p.status === 'Loué')
      .reduce((sum, p) => sum + p.rent, 0);

    container.innerHTML += `
      <div class="recent-item" style="padding: 0.6rem 0.85rem;">
        <div style="display: flex; flex-direction: column;">
          <span style="font-weight: 600; font-size: 0.9rem;">
            <a class="owner-click-link" onclick="openOwnerDossier('${owner.id}')">${owner.name}</a>
          </span>
          <span style="font-size: 0.72rem; color: var(--color-text-muted);">${ownerPropertiesCount} biens sous mandat</span>
        </div>
        <span style="font-size: 0.85rem; font-weight: 500; color: var(--color-green);">${formatCurrency(totalRentValue)}/mois</span>
      </div>
    `;
  });
}

function renderDashboardPropertiesPreview() {
  const container = document.getElementById('list-dashboard-properties');
  container.innerHTML = '';

  if (state.properties.length === 0) {
    container.innerHTML = '<div class="empty-state">Aucun bien enregistré.</div>';
    return;
  }

  state.properties.slice(0, 3).forEach(prop => {
    let statusClass = 'badge-purple';
    if (prop.status === 'Loué') statusClass = 'badge-green';
    if (prop.status === 'Maintenance') statusClass = 'badge-rose';

    container.innerHTML += `
      <div class="recent-item" style="padding: 0.6rem 0.85rem;">
        <div style="display: flex; flex-direction: column;">
          <span style="font-weight: 600; font-size: 0.9rem;">${prop.name}</span>
          <span style="font-size: 0.72rem; color: var(--color-text-muted);">${prop.address}</span>
        </div>
        <span class="badge ${statusClass}">${prop.status}</span>
      </div>
    `;
  });
}

function renderDashboardOverviewChart() {
  const ctx = document.getElementById('chart-dashboard-overview').getContext('2d');
  
  if (charts.dashboardOverview) {
    charts.dashboardOverview.destroy();
  }

  // Ordonner chronologiquement les transactions
  const sortedTx = [...state.transactions]
    .filter(tx => matchesDateFilter(tx.date, 'dashboard-filter-type', 'dashboard-filter-day', 'dashboard-filter-month', 'dashboard-filter-year'))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  let runningCommissions = 0;
  const labels = [];
  const commissionsData = [];
  
  sortedTx.forEach(tx => {
    if (tx.type === 'income') {
      const prop = state.properties.find(p => p.id === tx.propertyId);
      if (prop) {
        const owner = state.owners.find(o => o.id === prop.ownerId);
        if (owner) {
          runningCommissions += (tx.amount * owner.commissionRate) / 100;
        }
      }
    }
    labels.push(formatDateString(tx.date));
    commissionsData.push(runningCommissions);
  });

  if (sortedTx.length === 0) {
    labels.push('Aujourd\'hui');
    commissionsData.push(0);
  }

  charts.dashboardOverview = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Commissions Agence (FCFA)',
        data: commissionsData,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        borderWidth: 3,
        pointBackgroundColor: '#10b981',
        pointBorderColor: 'rgba(255, 255, 255, 0.2)',
        pointHoverRadius: 6,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111622',
          titleFont: { family: 'Outfit', size: 13 },
          bodyFont: { family: 'Outfit', size: 14, weight: 'bold' },
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return `Honoraire agence cumulé : ${formatCurrency(context.raw)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { family: 'Outfit', size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af', font: { family: 'Outfit', size: 10 } }
        }
      }
    }
  });
}

// ==========================================================================
// Rendu : Onglet Propriétaires (Clics et Fiches détaillées)
// ==========================================================================

function renderOwnersTable() {
  const tbody = document.getElementById('body-owners-table');
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchInput = document.getElementById('input-search-owners');
  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filteredOwners = state.owners.filter(owner => {
    if (!searchTerm) return true;
    const nameMatch = (owner.name || '').toLowerCase().includes(searchTerm);
    const phoneMatch = (owner.phone || '').toLowerCase().includes(searchTerm);
    const emailMatch = (owner.email || '').toLowerCase().includes(searchTerm);
    const addressMatch = (owner.address || '').toLowerCase().includes(searchTerm);
    return nameMatch || phoneMatch || emailMatch || addressMatch;
  });

  if (filteredOwners.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Aucun bailleur trouvé.</td></tr>';
    return;
  }

  filteredOwners.forEach(owner => {
    const ownerPropertiesCount = state.properties.filter(p => p.ownerId === owner.id).length;
    const propertiesLocation = state.properties.filter(p => p.ownerId === owner.id && p.transaction_type === 'Location');
      const totalRentValue = propertiesLocation.reduce((sum, p) => sum + p.rent, 0);

      const propertiesVente = state.properties.filter(p => p.ownerId === owner.id && p.transaction_type === 'Vente');
      const totalSaleValue = propertiesVente.reduce((sum, p) => sum + p.rent, 0);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <a class="owner-click-link" style="font-size: 0.95rem;" onclick="openOwnerDossier('${owner.id}')">${owner.name}</a>
      </td>
      <td>${owner.phone}</td>
      <td>${owner.email}</td>
      <td class="text-center" style="font-weight: 600;">${ownerPropertiesCount}</td>
      <td class="text-center" style="font-weight: 600; color: var(--color-green);">${formatCurrency(totalRentValue)}</td>
        <td class="text-center" style="font-weight: 600; color: var(--color-primary);">${formatCurrency(totalSaleValue)}</td>
        <td class="text-center no-print">
        <div style="display: flex; justify-content: center; gap: 0.5rem;">
          <button class="btn-icon-only info" onclick="openEditOwnerModal('${owner.id}')" title="Modifier">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
            <button class="btn-icon-only danger" onclick="deleteOwner('${owner.id}')" title="Supprimer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Helper pour simuler la résolution automatique des locataires selon le bien occupé
function getTenantForProperty(propertyId) {
    const realTenant = state.tenants.find(t => t.propertyId === propertyId || t.property_id === propertyId);
    if (realTenant) {
        return {
          id: realTenant.id,
          name: realTenant.name,
          phone: realTenant.phone || 'Non renseigne',
          address: realTenant.address || 'Non renseignee',
          leaseStart: realTenant.entry_date || realTenant.leaseStart || '2026-03-15',
          caution: realTenant.caution_amount || realTenant.caution || 0
        };
      }

    const prop = state.properties.find(p => p.id === propertyId);
    if (prop && prop.tenantName && prop.leaseStart) {
    return {
      name: prop.tenantName,
      phone: prop.tenantPhone || 'Non renseigné',
      address: prop.tenantAddress || 'Non renseignée',
      leaseStart: prop.leaseStart,
      caution: prop.caution || (prop.rent * 2)
    };
  }
  const tenants = {
    'prop-1': { name: 'Bakary Diop', phone: '+221 70 123 45 67', address: 'Dakar, Grand Yoff', leaseStart: '2026-01-01', caution: 150000 },
    'prop-2': { name: 'Aissatou Keita', phone: '+221 76 999 88 77', address: 'Dakar, Almadies', leaseStart: '2026-02-01', caution: 200000 },
    'prop-3': { name: 'Omar Sy', phone: '+221 77 444 55 66', address: 'Dakar, Plateau', leaseStart: '2026-03-01', caution: 250000 },
    'prop-5': { name: 'Mr Soumaila', phone: '+221 77 101 20 30', address: 'Bamako, Golf Immeuble I Apt 5', leaseStart: '2026-03-15', caution: 50000 },
    'prop-7': { name: 'Mr Mohamed Mouktar Salem', phone: '+221 70 808 90 90', address: 'Bamako, Golf Immeuble I Apt 7', leaseStart: '2026-03-15', caution: 250000 },
    'prop-8': { name: 'Mr Diarra', phone: '+221 76 222 33 44', address: 'Bamako, Golf Immeuble I Magasin 8', leaseStart: '2026-03-15', caution: 200000 }
  };
  const mockTenant = tenants[propertyId] || { name: 'Locataire Inconnu', phone: 'Non renseigné', address: 'Non renseignée', leaseStart: '2026-03-15', caution: 0 };
  if (prop) {
    if (!prop.tenantName) prop.tenantName = mockTenant.name;
    if (!prop.tenantPhone) prop.tenantPhone = mockTenant.phone;
    if (!prop.tenantAddress) prop.tenantAddress = mockTenant.address;
    if (!prop.leaseStart) prop.leaseStart = mockTenant.leaseStart;
    if (!prop.caution) prop.caution = mockTenant.caution;
  }
  return mockTenant;
}

// Helper pour simuler les décalages de date
function getPastDateString(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// Helper pour la date du jour au format Bamako le : DD mmm-YY
function getTodayFrenchDateString() {
  const d = new Date();
  const months = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  return `${d.getDate()} ${months[d.getMonth()]}-${d.getFullYear().toString().substring(2)}`;
}

// Style du statut select en fonction de sa valeur
function styleStatusSelect(selectElement) {
  const val = selectElement.value;
  selectElement.style.border = 'none';
  selectElement.style.fontWeight = '600';
  selectElement.style.borderRadius = '6px';
  selectElement.style.padding = '0.25rem 0.4rem';
  selectElement.style.fontSize = '0.8rem';
  
  if (val === 'En avance') {
    selectElement.style.background = '#10b981'; // Green
    selectElement.style.color = 'white';
  } else if (val === 'À jour') {
    selectElement.style.background = '#fef3c7'; // Yellow/Orange
    selectElement.style.color = '#d97706';
  } else if (val === 'En retard') {
    selectElement.style.background = '#f43f5e'; // Red
    selectElement.style.color = 'white';
  }
}

// Ajouter une ligne au reçu de retrait de loyer
function addReceiptRow(propertyId = null, paidAmount = null) {
  const tbody = document.getElementById('body-receipt-table');
  const tr = document.createElement('tr');
  tr.className = 'receipt-row';
  
  const activeOwner = state.owners.find(o => o.id === state.activeOwnerId);
  if (!activeOwner) return;
  
  const ownerProperties = state.properties.filter(p => p.ownerId === activeOwner.id);
  
  // Créer les options du select de locataires
  let selectOptionsHtml = `<option value="" disabled ${!propertyId ? 'selected' : ''}>Choisir un bien/locataire</option>`;
  ownerProperties.forEach(p => {
    const tenant = getTenantForProperty(p.id);
    selectOptionsHtml += `<option value="${p.id}" ${propertyId === p.id ? 'selected' : ''}>${tenant.name} (${p.name})</option>`;
  });
  
  tr.innerHTML = `
    <td>
      <select class="form-select receipt-tenant-select" style="width: 100%; border: 1px solid var(--glass-border); background: transparent; padding: 0.35rem 0.5rem; color: var(--color-text-primary);">
        ${selectOptionsHtml}
      </select>
    </td>
    <td>
      <input type="text" class="form-input receipt-rent-input text-right" style="width: 100%; border: none; background: transparent; padding: 0.35rem 0.5rem; color: var(--color-text-muted);" readonly value="0 FCFA">
    </td>
    <td>
      <input type="text" class="form-input receipt-month-input text-center" style="width: 100%; border: 1px solid var(--glass-border); background: transparent; padding: 0.35rem 0.5rem; color: var(--color-text-primary);" value="${getCurrentMonthString()}">
    </td>
    <td>
      <input type="number" class="form-input receipt-paid-input text-right" style="width: 100%; border: 1px solid var(--glass-border); background: transparent; padding: 0.35rem 0.5rem; color: var(--color-text-primary);" min="0" value="${paidAmount !== null ? paidAmount : 0}">
    </td>
    <td>
      <input type="text" class="form-input receipt-reliquat-input text-right" style="width: 100%; border: none; background: transparent; padding: 0.35rem 0.5rem; color: var(--color-text-muted);" readonly value="0 FCFA">
    </td>
    <td class="text-center" style="vertical-align: middle;">
      <select class="form-select receipt-status-select" style="width: 100%;">
        <option value="En avance">En avance</option>
        <option value="À jour" selected>À jour</option>
        <option value="En retard">En retard</option>
      </select>
    </td>
    <td class="text-center no-print" style="vertical-align: middle;">
      <button type="button" class="btn-icon-only danger btn-delete-receipt-row">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </td>
  `;
  
  tbody.appendChild(tr);
  
  const tenantSelect = tr.querySelector('.receipt-tenant-select');
  const rentInput = tr.querySelector('.receipt-rent-input');
  const paidInput = tr.querySelector('.receipt-paid-input');
  const statusSelect = tr.querySelector('.receipt-status-select');
  const deleteBtn = tr.querySelector('.btn-delete-receipt-row');
  
  tenantSelect.addEventListener('change', () => {
    const selectedPropId = tenantSelect.value;
    const prop = state.properties.find(p => p.id === selectedPropId);
    if (prop) {
      rentInput.value = formatCurrency(prop.rent);
      rentInput.setAttribute('data-value', prop.rent);
      updateRowReliquatsAndStatus(tr);
      recalculateReceiptSummary();
    }
  });
  
  paidInput.addEventListener('input', () => {
    updateRowReliquatsAndStatus(tr);
    recalculateReceiptSummary();
  });

  statusSelect.addEventListener('change', () => {
    styleStatusSelect(statusSelect);
  });
  
  deleteBtn.addEventListener('click', () => {
    tr.remove();
    recalculateReceiptSummary();
  });
  
  if (propertyId) {
    const prop = state.properties.find(p => p.id === propertyId);
    if (prop) {
      rentInput.value = formatCurrency(prop.rent);
      rentInput.setAttribute('data-value', prop.rent);
      updateRowReliquatsAndStatus(tr);
    }
  }
  
  recalculateReceiptSummary();
}

// Mettre à jour les reliquats et le statut d'une ligne du reçu
function updateRowReliquatsAndStatus(row) {
  const rentInput = row.querySelector('.receipt-rent-input');
  const paidInput = row.querySelector('.receipt-paid-input');
  const reliquatInput = row.querySelector('.receipt-reliquat-input');
  const statusSelect = row.querySelector('.receipt-status-select');
  
  const rent = parseInt(rentInput.getAttribute('data-value')) || 0;
  const paid = parseInt(paidInput.value) || 0;
  
  const reliquat = Math.max(0, rent - paid);
  reliquatInput.value = formatCurrency(reliquat);
  reliquatInput.setAttribute('data-value', reliquat);
  
  const tenantSelect = row.querySelector('.receipt-tenant-select');
  const selectedPropId = tenantSelect.value;

  if (reliquat === 0) {
    if (selectedPropId === 'prop-5') {
      statusSelect.value = 'En avance';
    } else {
      statusSelect.value = 'À jour';
    }
  } else {
    // Si reliquat > 0
    if (selectedPropId === 'prop-7' && reliquat === 25000) {
      statusSelect.value = 'À jour';
    } else {
      statusSelect.value = 'En retard';
    }
  }
  styleStatusSelect(statusSelect);
}

// Calculer le résumé global du reçu
function recalculateReceiptSummary() {
  const rows = document.querySelectorAll('#body-receipt-table .receipt-row');
  
  let totalPaid = 0;
  let totalReliquats = 0;
  let fraisGerance = 0;
  
  const activeOwner = state.owners.find(o => o.id === state.activeOwnerId);
  const defaultCommissionRate = activeOwner ? activeOwner.commissionRate : 10;
  
  for (const row of rows) {
    const paidInput = row.querySelector('.receipt-paid-input');
    const reliquatInput = row.querySelector('.receipt-reliquat-input');
    const tenantSelect = row.querySelector('.receipt-tenant-select');
    
    const paid = parseInt(paidInput.value) || 0;
    const reliquat = parseInt(reliquatInput.getAttribute('data-value')) || 0;
    const selectedPropId = tenantSelect ? tenantSelect.value : null;
    
    let rowCommissionRate = defaultCommissionRate;
    if (selectedPropId) {
      const prop = state.properties.find(p => p.id === selectedPropId);
      if (prop && prop.commissionRate !== undefined && prop.commissionRate !== null && !isNaN(prop.commissionRate)) {
        rowCommissionRate = prop.commissionRate;
      }
    }
    
    totalPaid += paid;
    totalReliquats += reliquat;
    fraisGerance += (paid * rowCommissionRate) / 100;
  }
  
  const netReverser = totalPaid - fraisGerance;
  
  document.getElementById('receipt-val-total').textContent = formatCurrency(totalPaid);
  document.getElementById('receipt-val-frais').textContent = formatCurrency(fraisGerance);
  document.getElementById('receipt-val-reliquats').textContent = formatCurrency(totalReliquats);
  document.getElementById('receipt-val-net').textContent = formatCurrency(netReverser);
}

function openOwnerDossier(ownerId) {
  const owner = state.owners.find(o => o.id === ownerId);
  if (!owner) return;

  // Réinitialiser les sous-onglets (Informations actif par défaut)
  document.querySelectorAll('.owner-sub-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.owner-sub-btn[data-subtab="info"]').classList.add('active');
  document.querySelectorAll('.owner-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-owner-info').classList.add('active');

  // Stocker l'owner actif en mémoire
  state.activeOwnerId = owner.id;

  // Remplissage En-tête Dossier Bailleurs
  document.getElementById('owner-detail-name').textContent = owner.name;
  document.getElementById('owner-detail-contact').textContent = `${owner.phone} | ${owner.email} | Honoraires : ${owner.commissionRate}%`;
  document.getElementById('owner-detail-avatar').textContent = owner.name.split(' ').map(n => n[0]).join('').toUpperCase();

  const ownerProperties = state.properties.filter(p => p.ownerId === owner.id);
  const ownerPropIds = ownerProperties.map(p => p.id);

  // ================= TAB 1: INFORMATIONS =================
  document.getElementById('owner-info-properties').textContent = ownerProperties.length;

  const editCommissionInput = document.getElementById('input-edit-owner-commission');
  if (editCommissionInput) editCommissionInput.value = owner.commissionRate;

  const ownerIncomes = state.transactions.filter(t => t.type === 'income' && ownerPropIds.includes(t.propertyId));
  const sumCollected = ownerIncomes.reduce((sum, t) => sum + t.amount, 0);
  document.getElementById('owner-info-collected').textContent = formatCurrency(sumCollected);

  // ================= TAB 2: BIENS POSSÉDÉS =================
  const tbodyBiens = document.getElementById('body-owner-biens-table');
  tbodyBiens.innerHTML = '';
  if (ownerProperties.length === 0) {
    tbodyBiens.innerHTML = '<tr><td colspan="4" class="text-center">Aucun bien sous contrat.</td></tr>';
  } else {
    ownerProperties.forEach(p => {
      let badgeClass = 'badge-purple';
      if (p.status === 'Loué') badgeClass = 'badge-green';
      if (p.status === 'Maintenance') badgeClass = 'badge-rose';
      
      tbodyBiens.innerHTML += `
        <tr>
          <td style="font-weight: 500;">${p.name}</td>
          <td>${p.address}</td>
          <td class="text-right" style="font-weight: 600;">${formatCurrency(p.rent)}</td>
          <td class="text-center"><span class="badge ${badgeClass}">${p.status}</span></td>
        </tr>
      `;
    });
  }

  // ================= TAB 3: LOCATAIRES =================
  const tbodyLocataires = document.getElementById('body-owner-locataires-table');
  tbodyLocataires.innerHTML = '';
  const rentedProps = ownerProperties.filter(p => p.status === 'Loué');
  
  if (rentedProps.length === 0) {
    tbodyLocataires.innerHTML = '<tr><td colspan="4" class="text-center">Aucun locataire actif pour les biens de ce bailleur.</td></tr>';
  } else {
    rentedProps.forEach(p => {
      const tenant = getTenantForProperty(p.id);
      tbodyLocataires.innerHTML += `
        <tr>
          <td style="font-weight: 500;"><a class="owner-click-link" style="font-weight: 600;" onclick="openTenantDossier('${p.id}')">${tenant.name}</a></td>
          <td><span class="badge badge-purple">${p.name}</span></td>
          <td>${tenant.phone}</td>
          <td class="text-right" style="font-weight: 600; color: var(--color-green);">${formatCurrency(p.rent)}</td>
          <td class="text-center">
            <button class="btn-icon-only" onclick="deleteTenant('${p.id}')" title="Supprimer ce locataire">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-rose);">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </td>
        </tr>
      `;
    });
  }

  // ================= TAB 4: RETRAITS DE LOYERS (REÇU INTERACTIF) =================
  document.getElementById('receipt-owner-title-name').textContent = owner.name;
  
  let buildingDescText = "Bâtiments sous gérance";
  if (owner.id === 'owner-3') {
    buildingDescText = "Monsieur Abdoulaye Cisse, propriétaire d'un immeuble sis au GOLF (Immeuble I : appartements et magasin)";
  } else {
    const propNames = ownerProperties.map(p => p.name).join(' et ');
    buildingDescText = `${owner.name}, propriétaire de (${propNames})`;
  }
  document.getElementById('receipt-building-desc').textContent = buildingDescText;
  
  const estimatedRent = ownerProperties.filter(p => p.transaction_type === 'Location').reduce((sum, p) => sum + p.rent, 0);
  const estimatedRentEl = document.getElementById('receipt-estimated-rent');
  if (estimatedRentEl) estimatedRentEl.textContent = formatCurrency(estimatedRent);
  
  document.getElementById('receipt-date-input').value = getTodayFrenchDateString();

  const tbodyReceipt = document.getElementById('body-receipt-table');
  tbodyReceipt.innerHTML = '';
  
  ownerProperties.forEach(p => {
    if (p.status === 'Loué') {
      let initialPaid = p.rent;
      if (owner.id === 'owner-3') {
        if (p.id === 'prop-5') initialPaid = 25000;
        if (p.id === 'prop-7') initialPaid = 125000;
        if (p.id === 'prop-8') initialPaid = 100000;
      }
      addReceiptRow(p.id, initialPaid);
    }
  });

  if (ownerProperties.filter(p => p.status === 'Loué').length === 0) {
    addReceiptRow(null);
  }

  // ================= TAB 5: FONDS DISPONIBLES =================
  const recentIncomes = ownerIncomes.filter(t => {
    const daysDiff = (new Date() - new Date(t.date)) / (1000 * 60 * 60 * 24);
    return daysDiff <= 9;
  });

  const pendingBrut = recentIncomes.reduce((sum, t) => sum + t.amount, 0);
  const pendingCom = recentIncomes.reduce((sum, t) => {
    let rate = owner.commissionRate;
    const prop = state.properties.find(p => p.id === t.propertyId);
    if (prop && prop.commissionRate !== undefined && prop.commissionRate !== null && !isNaN(prop.commissionRate)) rate = prop.commissionRate;
    return sum + (t.amount * rate) / 100;
  }, 0);
  
  // Calculer la somme des retraits récents (type expense et datant de moins de 9 jours)
  const recentWithdrawals = state.transactions.filter(t => 
      t.type === 'expense' && 
      ownerPropIds.includes(t.propertyId) && 
    (new Date() - new Date(t.date)) / (1000 * 60 * 60 * 24) <= 9
  );
  const sumRecentWithdrawals = recentWithdrawals.reduce((sum, w) => sum + w.amount, 0);
  const pendingNet = Math.max(0, (pendingBrut - pendingCom) - sumRecentWithdrawals);

  document.getElementById('owner-fonds-brut').textContent = formatCurrency(pendingBrut);
  document.getElementById('owner-fonds-com').textContent = formatCurrency(pendingCom);
  document.getElementById('owner-fonds-net').textContent = formatCurrency(pendingNet);

  // Rendu de l'historique des retraits
  const tbodyWithdrawals = document.getElementById('body-owner-withdrawals-table');
  if (tbodyWithdrawals) {
    tbodyWithdrawals.innerHTML = '';
    const ownerWithdrawals = state.transactions.filter(t => 
        t.type === 'expense' && 
        ownerPropIds.includes(t.propertyId)
      );
    if (ownerWithdrawals.length === 0) {
      tbodyWithdrawals.innerHTML = '<tr><td colspan="5" class="text-center">Aucun retrait effectué.</td></tr>';
    } else {
      ownerWithdrawals.sort((a, b) => new Date(b.date) - new Date(a.date));
      ownerWithdrawals.forEach(w => {
        tbodyWithdrawals.innerHTML += `
          <tr>
            <td>${formatDateString(w.date)}</td>
            <td style="font-weight: 500;">${w.description}</td>
            <td class="text-right value-rose" style="font-weight: 700;">-${formatCurrency(w.amount)}</td>
            <td class="text-center"><span class="badge badge-green">Payé</span></td>
            <td class="text-center no-print">
              <button class="btn btn-icon text-rose" onclick="deleteWithdrawalTransaction('${w.id}')" title="Annuler le retrait">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </td>
          </tr>
        `;
      });
    }
  }

  document.getElementById('btn-request-withdrawal').onclick = () => {
    if (pendingNet === 0) {
      showToast('Aucun fonds disponible pour retrait immédiat.', 'error');
      return;
    }
    document.getElementById('withdrawal-available-balance').textContent = formatCurrency(pendingNet);
    const amountInput = document.getElementById('input-withdrawal-amount');
    amountInput.value = pendingNet;
    amountInput.max = pendingNet;
    document.getElementById('modal-withdrawal').classList.add('active');
  };

  document.getElementById('btn-owner-fonds-statement').onclick = () => {
    showToast('Génération du relevé financier en cours...', 'success');
    
    // Remplissage de la modale de relevé
    document.getElementById('statement-owner-name').textContent = owner.name;
    document.getElementById('statement-owner-contact').textContent = `Tél: ${owner.phone} | Email: ${owner.email} | Commission : ${owner.commissionRate}%`;
    document.getElementById('statement-current-date').textContent = `Bamako, le ${getTodayFrenchDateString()}`;
    
    function renderStatement() {
      // Calcul des totaux pour le relevé (filtrés)
      const allTxFiltered = state.transactions.filter(t => 
        ownerPropIds.includes(t.propertyId) &&
        matchesDateFilter(t.date, 'statement-filter-type', 'statement-filter-day', 'statement-filter-month', 'statement-filter-year')
      );
      
      const filteredIncomes = allTxFiltered.filter(t => t.type === 'income');
      const filteredWithdrawals = allTxFiltered.filter(t => t.type === 'expense');
      
      const sumGross = filteredIncomes.reduce((sum, t) => sum + t.amount, 0);
      const sumCom = filteredIncomes.reduce((sum, t) => {
        let rate = owner.commissionRate;
        const prop = state.properties.find(p => p.id === t.propertyId);
        if (prop && prop.commissionRate !== undefined && prop.commissionRate !== null && !isNaN(prop.commissionRate)) rate = prop.commissionRate;
        return sum + (t.amount * rate) / 100;
      }, 0);
      const sumWithdrawn = filteredWithdrawals.reduce((sum, w) => sum + w.amount, 0);
      const sumBalance = (sumGross - sumCom) - sumWithdrawn;
      
      document.getElementById('statement-val-gross').textContent = formatCurrency(sumGross);
      document.getElementById('statement-val-com').textContent = formatCurrency(sumCom);
      document.getElementById('statement-val-withdrawn').textContent = formatCurrency(sumWithdrawn);
      document.getElementById('statement-val-balance').textContent = formatCurrency(sumBalance);
      
      // Remplir le grand livre du relevé
      const tbodyStatement = document.getElementById('body-statement-ledger');
      if (tbodyStatement) {
        tbodyStatement.innerHTML = '';
        const sortedTx = [...allTxFiltered].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (sortedTx.length === 0) {
          tbodyStatement.innerHTML = '<tr><td colspan="5" class="text-center">Aucune transaction enregistrée.</td></tr>';
        } else {
          sortedTx.forEach(t => {
            const typeLabel = t.type === 'income' 
              ? '<span class="badge badge-green">Loyer perçu</span>' 
              : '<span class="badge badge-rose">Retrait</span>';
              
            const brutDisplay = t.type === 'income' 
              ? `<span class="value-green">+${formatCurrency(t.amount)}</span>` 
              : `-`;
              
            let rate = owner.commissionRate;
            const prop = state.properties.find(p => p.id === t.propertyId);
            if (prop && prop.commissionRate !== undefined && prop.commissionRate !== null && !isNaN(prop.commissionRate)) rate = prop.commissionRate;
              
            const netRepayeDisplay = t.type === 'income'
              ? `<span style="color: var(--color-text-primary);">+${formatCurrency(t.amount - (t.amount * rate / 100))}</span>`
              : `<span class="value-rose">-${formatCurrency(t.amount)}</span>`;
              
            tbodyStatement.innerHTML += `
              <tr>
                <td>${formatDateString(t.date)}</td>
                <td style="font-weight: 500;">${t.description}</td>
                <td>${typeLabel}</td>
                <td class="text-right" style="font-weight: 600;">${brutDisplay}</td>
                <td class="text-right" style="font-weight: 600;">${netRepayeDisplay}</td>
              </tr>
            `;
          });
        }
      }
    }

    setupDateFilterControls('statement-filter-type', 'statement-filter-day', 'statement-filter-month', 'statement-filter-year', renderStatement);
    document.getElementById('btn-clear-statement').onclick = () => {
      document.getElementById('statement-filter-type').value = 'all';
      document.getElementById('statement-filter-day').style.display = 'none';
      document.getElementById('statement-filter-month').style.display = 'none';
      document.getElementById('statement-filter-year').style.display = 'none';
      renderStatement();
    };

    renderStatement();
    
    document.getElementById('modal-statement').classList.add('active');
  };

  switchTab('owner-details');
}


// ==========================================================================
// Rendu : Onglet Biens Immobiliers
// ==========================================================================

function renderPropertiesGrid() {
  const container = document.getElementById('grid-detailed-properties');
  if (!container) return;
  container.innerHTML = '';

  const searchInput = document.getElementById('input-search-properties');
  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filteredProperties = state.properties.filter(prop => {
    if (!searchTerm) return true;
    const propNameMatch = (prop.name || '').toLowerCase().includes(searchTerm);
    const addressMatch = (prop.address || '').toLowerCase().includes(searchTerm);
    const statusMatch = (prop.status || '').toLowerCase().includes(searchTerm);
    const typeMatch = (prop.transaction_type || '').toLowerCase().includes(searchTerm);

    const owner = state.owners.find(o => o.id === prop.ownerId);
    const ownerNameMatch = owner ? (owner.name || '').toLowerCase().includes(searchTerm) : false;

    const tenant = getTenantForProperty(prop.id);
    const tenantNameMatch = tenant ? (tenant.name || '').toLowerCase().includes(searchTerm) : false;

    return propNameMatch || addressMatch || statusMatch || typeMatch || ownerNameMatch || tenantNameMatch;
  });

  if (filteredProperties.length === 0) {
    container.innerHTML = '<div class="empty-state">Aucun bien immobilier correspondant.</div>';
    return;
  }

  filteredProperties.forEach(prop => {
    // Récupérer le propriétaire
    const owner = state.owners.find(o => o.id === prop.ownerId);
    const ownerName = owner ? owner.name : 'Inconnu';

    let statusColor = 'bar-purple';
    let alertText = '';
    
    const isVente = prop.transaction_type === 'Vente' || prop.transaction_type === 'vente' || ['Vendu', 'Disponible à la vente', 'Sous compromis'].includes(prop.status);
    if (isVente) {
        if (prop.status === 'Vendu') {
          statusColor = 'bar-purple';
          alertText = '<span class="value-purple" style="font-size: 0.75rem; font-weight: 600;">Vendu</span>';
        } else {
          statusColor = 'bar-blue';
          alertText = '<span class="value-blue" style="font-size: 0.75rem; font-weight: 600;">En vente</span>';
        }
      } else {
        if (prop.status === 'Loué') {
          statusColor = 'bar-green';
          alertText = '<span class="value-green" style="font-size: 0.75rem; font-weight: 600;">Occupé (Loué)</span>';
        } else if (prop.status === 'Libre') {
          statusColor = 'bar-orange';
          alertText = '<span class="value-rose" style="font-size: 0.75rem; font-weight: 600;">Vacant</span>';
        } else if (prop.status === 'Maintenance') {
          statusColor = 'bar-rose';
          alertText = '<span class="value-rose" style="font-size: 0.75rem; font-weight: 600;">En Travaux</span>';
        }
      }
  
      const card = document.createElement('div');
    card.className = 'goal-card';
    card.style.margin = '0';
    card.innerHTML = `
      <div class="card-actions-top">
        <button class="btn-icon-only" onclick="openEditPropertyModal('${prop.id}')" title="Modifier" style="color: var(--color-primary-hover);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn-icon-only" onclick="deleteProperty('${prop.id}')" title="Supprimer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>

      <div class="goal-card-meta">
        <div class="recent-category-badge category-rent">
          IM
        </div>
        <div class="goal-details-wrap">
          <h5 style="font-size: 0.95rem; font-weight: 600;">${prop.name}</h5>
          <span class="goal-deadline-badge">${prop.address}</span>
        </div>
      </div>

      <div class="progress-track" style="margin-top: 0.25rem;">
        <div class="progress-bar ${statusColor}" style="width: 100%"></div>
      </div>

      <div class="goal-card-footer">
        <span style="font-size: 0.8rem; color: var(--color-text-muted);">
          Propriétaire : <strong><a class="owner-click-link" onclick="openOwnerDossier('${prop.ownerId}')">${ownerName}</a></strong>
        </span>
        <div style="text-align: right;">
          <span style="font-size: 0.9rem; font-weight: 700; display: block;">${formatCurrency(prop.rent)}</span>
          ${alertText}
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

// ==========================================================================
// Rendu : Onglet Transactions
// ==========================================================================

function filterAndRenderTransactionsTable() {
  const searchTerm = document.getElementById('input-search-transactions').value.toLowerCase();
  const filterType = document.getElementById('select-filter-type').value;
  const sortOrder = document.getElementById('select-sort-order').value;

  const tbody = document.getElementById('body-transactions-table');
  const emptyState = document.getElementById('empty-transactions-state');
  tbody.innerHTML = '';

  let filtered = state.transactions.filter(tx => {
    const prop = state.properties.find(p => p.id === tx.propertyId);
    const propName = prop ? prop.name.toLowerCase() : '';
    
    let ownerName = '';
    if (prop) {
      const owner = state.owners.find(o => o.id === prop.ownerId);
      ownerName = owner ? owner.name.toLowerCase() : '';
    }

    const matchesSearch = tx.description.toLowerCase().includes(searchTerm) || 
                          propName.includes(searchTerm) ||
                          ownerName.includes(searchTerm);
                          
    const matchesType = filterType === 'all' || tx.type === filterType;

    return matchesSearch && matchesType;
  });

  // Tris
  filtered.sort((a, b) => {
    if (sortOrder === 'date-desc') return new Date(b.date) - new Date(a.date);
    if (sortOrder === 'date-asc') return new Date(a.date) - new Date(b.date);
    if (sortOrder === 'amount-desc') return b.amount - a.amount;
    if (sortOrder === 'amount-asc') return a.amount - b.amount;
    return 0;
  });

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach(tx => {
    const isIncome = tx.type === 'income';
    const amountClass = isIncome ? 'value-green' : 'value-rose';
    const typeBadge = isIncome ? '<span class="badge badge-green">Revenu (Commission)</span>' : '<span class="badge badge-rose">Dépense</span>';
    const sign = isIncome ? '+' : '-';

    const prop = state.properties.find(p => p.id === tx.propertyId);
    const propName = prop ? prop.name : (tx.propertyId ? 'Inconnu' : 'Aucun (Agence)');
    
    let ownerName = tx.propertyId ? 'Inconnu' : 'Agence';
    let ownerId = '';
    let commissionRate = 10;
    if (prop) {
      const owner = state.owners.find(o => o.id === prop.ownerId);
      if (owner) {
        ownerName = owner.name;
        ownerId = owner.id;
        commissionRate = owner.commissionRate;
      }
    }

    const amountToShow = isIncome ? (tx.amount * commissionRate) / 100 : tx.amount;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDateString(tx.date)}</td>
      <td style="font-weight: 500;">${tx.description}</td>
      <td><a class="owner-click-link" onclick="openOwnerDossier('${ownerId}')">${ownerName}</a></td>
      <td><span class="badge badge-purple">${propName}</span></td>
      <td>${typeBadge}</td>
      <td class="text-right ${amountClass}" style="font-weight: 600;">${sign}${formatCurrency(amountToShow)}</td>
      <td class="text-center no-print" style="display: flex; gap: 0.5rem; justify-content: center;">
        ${isIncome && tx.propertyId ? `
        <button class="btn-icon-only primary" onclick="generateQuittancePDF('${tx.id}', true)" title="Télécharger la Quittance PDF">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <polyline points="9 15 12 18 15 15"></polyline>
          </svg>
        </button>
        ` : ''}
        <button class="btn-icon-only danger" onclick="deleteTransaction('${tx.id}')" title="Supprimer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================================================
// Rendu : Onglet Analyses
// ==========================================================================

function renderAnalytics() {
  // 1. Taux d'occupation (Doughnut Chart)
  let loue = 0, libre = 0, maintenance = 0;
  state.properties.forEach(p => {
    if (p.status === 'Loué') loue++;
    else if (p.status === 'Libre') libre++;
    else if (p.status === 'Maintenance') maintenance++;
  });

  renderDoughnutChart(
    'chart-analytics-expenses',
    'analyticsExpenses',
    ['Loué', 'Vacant', 'En Maintenance'],
    [loue, libre, maintenance],
    ['#10b981', '#f59e0b', '#f43f5e']
  );

  // 2. Répartition par propriétaires (Doughnut Chart)
  const ownersNames = [];
  const ownersCounts = [];
  state.owners.forEach(owner => {
    const count = state.properties.filter(p => p.ownerId === owner.id).length;
    if (count > 0) {
      ownersNames.push(owner.name);
      ownersCounts.push(count);
    }
  });

  renderDoughnutChart(
    'chart-analytics-income',
    'analyticsIncome',
    ownersNames,
    ownersCounts,
    ['#8b5cf6', '#6366f1', '#10b981', '#ec4899', '#f59e0b']
  );

  // 3. Commissions vs Dépenses Opérationnelles (Trends bar chart)
  renderTrendsBarChart();
}

function renderDoughnutChart(canvasId, chartKey, labels, data, colors) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  
  if (charts[chartKey]) {
    charts[chartKey].destroy();
  }

  const sum = data.reduce((a, b) => a + b, 0);

  if (sum === 0) {
    ctx.clearRect(0, 0, 200, 200);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText('Aucune donnée enregistrée.', 100, 100);
    return;
  }

  charts[chartKey] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 0,
        hoverOffset: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#f3f4f6',
            font: { family: 'Outfit', size: 11 },
            padding: 15
          }
        },
        tooltip: {
          backgroundColor: '#111622',
          bodyFont: { family: 'Outfit', size: 13 },
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1
        }
      },
      cutout: '68%'
    }
  });
}

function renderTrendsBarChart() {
  const ctx = document.getElementById('chart-analytics-trends').getContext('2d');
  
  if (charts.analyticsTrends) {
    charts.analyticsTrends.destroy();
  }

  const lastMonths = [];
  const monthLabels = [];
  
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    lastMonths.push({
      month: d.getMonth(),
      year: d.getFullYear()
    });
    monthLabels.push(d.toLocaleString('fr-FR', { month: 'short' }) + ' ' + d.getFullYear().toString().substring(2));
  }

  const commissionsDataset = new Array(6).fill(0);
  const costsDataset = new Array(6).fill(0);

  state.transactions.forEach(tx => {
    const txDate = new Date(tx.date);
    const txMonth = txDate.getMonth();
    const txYear = txDate.getFullYear();

    lastMonths.forEach((target, index) => {
      if (txMonth === target.month && txYear === target.year) {
        if (tx.type === 'income') {
          // Calculer la part de commission agency
          const prop = state.properties.find(p => p.id === tx.propertyId);
          if (prop) {
            const owner = state.owners.find(o => o.id === prop.ownerId);
            if (owner) {
              let rate = prop.commissionRate !== undefined && prop.commissionRate !== null && !isNaN(prop.commissionRate) ? prop.commissionRate : owner.commissionRate;
              commissionsDataset[index] += (tx.amount * rate) / 100;
            }
          }
        } else {
          // C'est un coût de maintenance d'agence
          costsDataset[index] += tx.amount;
        }
      }
    });
  });

  charts.analyticsTrends = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: monthLabels,
      datasets: [
        {
          label: 'Commissions Agence',
          data: commissionsDataset,
          backgroundColor: '#10b981',
          borderRadius: 8,
          borderWidth: 0,
          barThickness: 18
        },
        {
          label: 'Dépenses & Coûts',
          data: costsDataset,
          backgroundColor: '#f43f5e',
          borderRadius: 8,
          borderWidth: 0,
          barThickness: 18
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#f3f4f6', font: { family: 'Outfit', size: 12 } }
        },
        tooltip: {
          backgroundColor: '#111622',
          bodyFont: { family: 'Outfit', size: 13 },
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { family: 'Outfit', size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af', font: { family: 'Outfit', size: 10 } }
        }
      }
    }
  });
}

// ==========================================================================
// Utilitaires de Modales
// ==========================================================================

function openTransactionModal() {
  const modal = document.getElementById('modal-transaction');
  document.getElementById('input-tx-id').value = '';
  document.getElementById('input-tx-description').value = '';
  document.getElementById('input-tx-amount').value = '';
  document.getElementById('input-tx-date').value = getTodayDateString();
  
  document.getElementById('type-toggle-income').checked = true;
  modal.classList.add('active');
}

function openOwnerModal() {
  const modal = document.getElementById('modal-owner');
  document.getElementById('input-owner-name').value = '';
  document.getElementById('input-owner-phone').value = '';
  document.getElementById('input-owner-email').value = '';
  document.getElementById('input-owner-address').value = '';
  document.getElementById('input-owner-commission').value = '10';
  
  // Rétablir les champs de bien facultatifs
  document.getElementById('input-owner-prop-name').value = '';
  document.getElementById('input-owner-prop-address').value = '';
  document.getElementById('select-owner-prop-type').value = 'Appartement';
  document.getElementById('input-owner-prop-caution').value = '';
  document.getElementById('input-owner-prop-rent').value = '';
  document.getElementById('select-owner-prop-status').value = 'Libre';
  
  modal.classList.add('active');
}

function openPropertyModal() {
  const modal = document.getElementById('modal-property');
  document.getElementById('input-property-id').value = '';
  document.getElementById('input-property-name').value = '';
  document.getElementById('input-property-address').value = '';
  document.getElementById('select-property-type').value = 'Appartement';
  document.getElementById('input-property-caution').value = '';
  document.getElementById('input-property-rent').value = '';
  document.getElementById('input-property-commission').value = '';
  document.getElementById('select-property-status').value = 'Libre';
  
  // Réinitialiser les champs locataire
  const tenantContainer = document.getElementById('tenant-fields-container');
  if (tenantContainer) tenantContainer.style.display = 'none';
  const tenantNameInput = document.getElementById('input-property-tenant-name');
  const tenantPhoneInput = document.getElementById('input-property-tenant-phone');
  if (tenantNameInput) tenantNameInput.value = '';
  if (tenantPhoneInput) tenantPhoneInput.value = '';

  modal.classList.add('active');
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.classList.remove('active');
  });
}

// ==========================================================================
// Soumissions de Données & Formulaires
// ==========================================================================

async function handleTransactionSubmit(e) {
  e.preventDefault();
  
  const motifElement = document.getElementById('select-tx-motif');
  const descriptionInput = document.getElementById('input-tx-description').value.trim();
  
  let finalMotif = motifElement ? motifElement.value : '';
  if (finalMotif === 'Autre') {
    const motifAutreInput = document.getElementById('input-tx-motif-autre');
    if (motifAutreInput && motifAutreInput.value.trim()) {
      finalMotif = motifAutreInput.value.trim();
    }
  }
  
  const description = finalMotif ? `${finalMotif} - ${descriptionInput}` : descriptionInput;
  
  const amount = parseInt(document.getElementById('input-tx-amount').value);
  const type = document.querySelector('input[name="tx-type"]:checked').value;
  const propertyId = document.getElementById('select-tx-property').value;
  const date = document.getElementById('input-tx-date').value;

  if (!description || isNaN(amount) || amount <= 0 || !date) {
    showToast('Formulaire invalide.', 'error');
    return;
  }

  try {
    const newTx = {
      id: 'tx-' + Date.now(),
      property_id: propertyId || null,
      description,
      amount,
      type,
      date,
      motif: finalMotif || null
    };

    const createdTx = await API.createTransaction(newTx);
    
    closeAllModals();
    document.getElementById('form-transaction').reset();
    showToast('Flux financier enregistré.', 'success');
    
    await loadData();
    filterAndRenderTransactionsTable();
    renderAccounting();
    renderDashboard();

    if (type === 'income' && propertyId) {
      setTimeout(async () => {
        if (confirm("Loyer encaissé avec succès. Voulez-vous télécharger la quittance PDF ?")) {
          // Utilise l'ID du flux renvoyé par l'API s'il existe, sinon l'ID local
          const finalTxId = createdTx && createdTx.id ? createdTx.id : newTx.id;
          generateQuittancePDF(finalTxId, true);
        }
      }, 500);
    }
  } catch (err) {
    showToast(err.message || 'Erreur lors de la transaction.', 'error');
  }
}

async function handleOwnerSubmit(e) {
  e.preventDefault();
  
  const name = document.getElementById('input-owner-name').value.trim();
  const phone = document.getElementById('input-owner-phone').value.trim();
  const email = document.getElementById('input-owner-email').value.trim();
  const address = document.getElementById('input-owner-address').value.trim();
  const commissionRate = parseInt(document.getElementById('input-owner-commission').value);

  if (!name || !phone || !email || isNaN(commissionRate)) {
    showToast('Veuillez remplir correctement la fiche propriétaire.', 'error');
    return;
  }

  const editId = document.getElementById('input-owner-id').value;
  let existingNotes = "";
  if (editId) {
    const existingOwner = state.owners.find(o => o.id === editId);
    if (existingOwner) {
      try {
        const parsed = JSON.parse(existingOwner.notes);
        existingNotes = parsed.notes || "";
      } catch (e) {
        existingNotes = existingOwner.notes || "";
      }
    }
  }

  const newOwner = {
    id: editId || ('own-' + Date.now()),
    type: "Particulier",
    name,
    phone,
    email,
    address,
    notes: JSON.stringify({ commissionRate: commissionRate, notes: existingNotes })
  };

  try {
    let createdOwner;
    if (editId) {
      createdOwner = await API.updateOwner(editId, newOwner);
      document.getElementById('input-owner-id').value = '';
    } else {
      createdOwner = await API.createOwner(newOwner);
    }

    // Vérifier et ajouter le bien immobilier initial s'il a été rempli
    const propName = document.getElementById('input-owner-prop-name').value.trim();
    const propAddress = document.getElementById('input-owner-prop-address').value.trim();
    const propType = document.getElementById('select-owner-prop-type').value;
    const propTransactionType = document.querySelector('input[name="owner_prop_transaction"]:checked').value;
    const propCaution = parseInt(document.getElementById('input-owner-prop-caution').value, 10) || 0;
    const propRent = parseInt(document.getElementById('input-owner-prop-rent').value, 10) || 0;
    const propPrice = parseInt(document.getElementById('input-owner-prop-price').value, 10) || 0;
    const propStatus = document.getElementById('select-owner-prop-status').value;
    const propSaleStatus = document.getElementById('select-owner-prop-sale-status').value;

    if (propName) {
      const newProp = {
        id: 'prop-' + Date.now(),
        name: propName,
        address: propAddress || 'Non spécifiée',
        type: propType,
        transaction_type: propTransactionType,
        caution_amount: propCaution,
        owner_id: createdOwner.id,
        rent_amount: propRent,
        price: propTransactionType === 'Location' ? propRent : propPrice,
        commission_rate: createdOwner.commissionRate,
        status: propTransactionType === 'Vente' ? propSaleStatus : propStatus,
        surface: 0,
        units: 1
      };
      await API.createProperty(newProp);
    }

    await loadData();
    populateDropdowns();
    closeAllModals();
    renderOwnersTable();
    
    let msg = `Bailleur ${name} enregistré avec succès.`;
    if (propName) {
      msg += ` Bien "${propName}" également ajouté.`;
    }
    showToast(msg, 'success');
  } catch (err) {
    showToast(err.message || 'Erreur lors de la création', 'error');
  }
}

async function handlePropertySubmit(e) {
  e.preventDefault();
  
  const name = document.getElementById('input-property-name').value.trim();
  const address = document.getElementById('input-property-address').value.trim();
  const ownerId = document.getElementById('select-property-owner').value;
  const type = document.getElementById('select-property-type').value;
  const transactionType = document.querySelector('input[name="property_transaction"]:checked').value;
  const caution = parseInt(document.getElementById('input-property-caution').value) || 0;
  const rent = parseInt(document.getElementById('input-property-rent').value) || 0;
  const price = parseInt(document.getElementById('input-property-price').value) || 0;
  const commissionVal = document.getElementById('input-property-commission').value;
  const commissionRate = commissionVal !== '' ? parseFloat(commissionVal) : null;
  const status = document.getElementById('select-property-status').value;
  const saleStatus = document.getElementById('select-property-sale-status').value;

  let tenantName = '';
  let tenantPhone = '';
  if (transactionType === 'Location' && status === 'Loué') {
    tenantName = document.getElementById('input-property-tenant-name').value.trim();
    tenantPhone = document.getElementById('input-property-tenant-phone').value.trim();
  }

  if (!name || !address || !ownerId || (transactionType === 'Location' && (!rent || rent <= 0)) || (transactionType === 'Vente' && (!price || price <= 0))) {
    showToast('Fiche du bien immobilier incomplète (loyer ou prix manquant/invalide).', 'error');
    return;
  }

  const editId = document.getElementById('input-property-id').value;

  const newProp = {
    id: editId || ('prop-' + Date.now()),
    name,
    address: address || 'Non spécifiée',
    type,
    transaction_type: transactionType,
    owner_id: ownerId,
    caution_amount: caution,
    rent_amount: rent,
    price: transactionType === 'Location' ? rent : price,
    commission_rate: isNaN(commissionRate) ? null : commissionRate,
    status: transactionType === 'Vente' ? saleStatus : status,
    surface: 0,
    units: 1,
    tenant_name: tenantName,
    tenant_phone: tenantPhone
  };

  try {
    if (editId) {
      await API.updateProperty(editId, newProp);
      document.getElementById('input-property-id').value = '';
    } else {
      await API.createProperty(newProp);
    }
      
      if (transactionType === 'Vente' && saleStatus === 'Vendu') {
        const existingSaleTx = state.transactions.find(tx => 
          tx.propertyId === newProp.id && 
          tx.type === 'income' && 
          tx.description.includes('Vente')
        );
        
        if (!existingSaleTx) {
          const saleTx = {
            id: 'tx-' + Date.now(),
            date: new Date().toISOString().split('T')[0],
            type: 'income',
            amount: price,
            description: 'Vente du bien: ' + name,
            motif: 'income-other',
            property_id: newProp.id
          };
          await API.createTransaction(saleTx);
        }
      }
    await loadData();
    populateDropdowns();
    closeAllModals();
    renderPropertiesGrid();
    showToast(`Bien "${name}" ajouté au catalogue de gestion.`, 'success');
  } catch (error) {
    console.error(error);
    showToast('Erreur lors de la création du bien.', 'error');
  }
}

// ==========================================================================

// ==========================================================================
// Edition (Bailleurs, Biens, Locataires)
// ==========================================================================

function openEditOwnerModal(id) {
  const owner = state.owners.find(o => o.id === id);
  if (!owner) return;
  document.getElementById('input-owner-id').value = owner.id;
  document.getElementById('input-owner-name').value = owner.name || '';
  document.getElementById('input-owner-phone').value = owner.phone || '';
  document.getElementById('input-owner-email').value = owner.email || '';
  document.getElementById('input-owner-address').value = owner.address || '';
  document.getElementById('input-owner-commission').value = owner.commissionRate || '';
  
  // Masquer l'ajout rapide de bien
  const quickProp = document.getElementById('owner-quick-property');
  if(quickProp) quickProp.style.display = 'none';
  
  document.getElementById('modal-owner').classList.add('active');
}

function openEditPropertyModal(id) {
  const prop = state.properties.find(p => p.id === id);
  if (!prop) return;
  document.getElementById('input-property-id').value = prop.id;
  document.getElementById('input-property-name').value = prop.name || '';
  document.getElementById('input-property-address').value = prop.address || '';
  document.getElementById('select-property-owner').value = prop.ownerId || '';
  document.getElementById('select-property-type').value = prop.type || '';
  
  const radioLocation = document.querySelector('input[name="property_transaction"][value="Location"]');
  const radioVente = document.querySelector('input[name="property_transaction"][value="Vente"]');
  const isVente = prop.transaction_type === "Vente" || prop.transaction_type === "vente" || ['Vendu', 'Disponible à la vente', 'Sous compromis'].includes(prop.status);
  
  if (isVente) {
    radioVente.checked = true;
    document.getElementById('property-location-fields').style.display = 'none';
    document.getElementById('property-vente-fields').style.display = 'block';
    document.getElementById('input-property-price').value = prop.price || '';
    if (document.getElementById('select-property-sale-status')) {
      document.getElementById('select-property-sale-status').value = prop.status || 'Disponible à la vente';
    }
  } else {
    radioLocation.checked = true;
    document.getElementById('property-location-fields').style.display = 'block';
    document.getElementById('property-vente-fields').style.display = 'none';
    document.getElementById('input-property-caution').value = prop.caution_amount || '';
    document.getElementById('input-property-rent').value = prop.rent_amount || '';
    document.getElementById('select-property-status').value = prop.status || 'Libre';
  }
  
  document.getElementById('input-property-commission').value = prop.commissionRate || '';
  document.getElementById('modal-property').classList.add('active');
}

function openEditTenantModal(id) {
  const tenant = state.tenants.find(t => t.id === id);
  if (!tenant) return;
  
  const elId = document.getElementById('input-tenant-id');
  if(elId) elId.value = tenant.id;
  
  const elProp = document.getElementById('select-tenant-property');
  if(elProp) {
    const propExists = Array.from(elProp.options).some(opt => opt.value === tenant.propertyId);
    if (!propExists && tenant.propertyId) {
      const prop = state.properties.find(p => p.id === tenant.propertyId);
      if (prop) {
        const option = document.createElement('option');
        option.value = prop.id;
        option.textContent = `${prop.name} - ${prop.rent_amount || prop.price} FCFA / mois`;
        elProp.appendChild(option);
      }
    }
    elProp.value = tenant.propertyId || '';
  }
  
  const elEmail = document.getElementById('input-tenant-email');
  if(elEmail) elEmail.value = tenant.email || '';
  
  const elCni = document.getElementById('input-tenant-cni');
  if(elCni) elCni.value = tenant.cni || '';
  
  const elName = document.getElementById('input-tenant-name');
  if(elName) elName.value = tenant.name || '';
  
  const elPhone = document.getElementById('input-tenant-phone');
  if(elPhone) elPhone.value = tenant.phone || '';
  
  const elAddress = document.getElementById('input-tenant-address');
  if(elAddress) elAddress.value = tenant.address || '';
  
  const elRent = document.getElementById('input-tenant-rent');
  if(elRent) elRent.value = tenant.rent || '';
  
  const elCaution = document.getElementById('input-tenant-caution');
  if(elCaution) elCaution.value = tenant.caution || '';
  
  const elLeaseStart = document.getElementById('input-tenant-lease-start');
  if(elLeaseStart) elLeaseStart.value = tenant.entry_date || tenant.leaseStart || '';
  
  document.getElementById('modal-tenant').classList.add('active');
}

// Exposer globalement
window.openEditOwnerModal = openEditOwnerModal;
window.openEditPropertyModal = openEditPropertyModal;
window.openEditTenantModal = openEditTenantModal;
// Suppressions
// ==========================================================================

function deleteTransaction(id) {
  showCustomConfirm('Voulez-vous supprimer ce flux financier ?').then(async confirmed => {
    if (confirmed) {
      try {
        await API.deleteTransaction(id);
        await loadData();
        filterAndRenderTransactionsTable();
        renderAccounting();
        renderDashboard();
        showToast('Mouvement supprimé.', 'warning');
      } catch(e) {
        showToast(e.message, 'error');
      }
    }
  });
}

function deleteTenant(propertyId) {
  showCustomConfirm('Voulez-vous supprimer ce locataire ? Le bien associé deviendra vacant.').then(async confirmed => {
    if (confirmed) {
      const prop = state.properties.find(p => p.id === propertyId);
      if (prop) {
        try {
          const tenant = state.tenants.find(t => t.propertyId === propertyId);
          if (tenant) {
            await API.deleteTenant(tenant.id);
          }
          await API.updateProperty(propertyId, {
            ...prop,
            status: 'Libre',
            tenant_name: null,
            tenant_phone: null
          });
          
          await loadData();
          renderTenantsTable();
          renderPropertiesGrid();
          showToast('Locataire supprimé avec succès.', 'warning');
          
          if (document.getElementById('modal-owner').classList.contains('active')) {
            openOwnerDossier(prop.ownerId);
          }
        } catch(e) {
          showToast(e.message, 'error');
        }
      }
    }
  });
}

function deleteOwner(id) {
  const owner = state.owners.find(o => o.id === id);
  if (!owner) return;

  const hasProperties = state.properties.some(p => p.ownerId === id);
  if (hasProperties) {
    showCustomConfirm(`Impossible de supprimer le bailleur "${owner.name}" car des biens immobiliers lui sont encore associés.`, true, 'Action Impossible');
    return;
  }

  showCustomConfirm(`Supprimer définitivement la fiche de "${owner.name}" ?`).then(async confirmed => {
    if (confirmed) {
      try {
        await API.deleteOwner(id);
        await loadData();
        populateDropdowns();
        renderOwnersTable();
        showToast('Propriétaire supprimé.', 'warning');
      } catch(e) {
        showToast(e.message, 'error');
      }
    }
  });
}

function deleteProperty(id) {
  const prop = state.properties.find(p => p.id === id);
  if (!prop) return;

  showCustomConfirm(`Retirer le bien "${prop.name}" du mandat de gestion ?`).then(async confirmed => {
    if (confirmed) {
      try {
        await API.deleteProperty(id);
        await loadData();
        populateDropdowns();
        renderPropertiesGrid();
        showToast('Bien immobilier retiré du catalogue.', 'warning');
      } catch(e) {
        showToast(e.message, 'error');
      }
    }
  });
}

// ==========================================================================
// Formateurs de Dates et Currency
// ==========================================================================

function formatCurrency(num) {
  const currencySymbol = (state.agencySettings && state.agencySettings.currency) ? state.agencySettings.currency : 'FCFA';
  return Math.round(num).toLocaleString('fr-FR') + ' ' + currencySymbol;
}

function formatDateString(dateStr) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', options);
}

function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="8"/>
    </svg>
  `;
  if (type === 'success') {
    icon = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    `;
  } else if (type === 'error') {
    icon = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    `;
  }

  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 4000);
}

function showCustomConfirm(message, isAlert = false, title = "Confirmation Requise") {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-confirm-dialog');
    document.getElementById('confirm-dialog-message').innerText = message;
    
    const titleEl = document.getElementById('confirm-dialog-title');
    if (titleEl) titleEl.innerText = title;

    const btnOk = document.getElementById('btn-confirm-ok');
    const btnCancel = document.getElementById('btn-confirm-cancel');
    const btnClose = document.getElementById('btn-close-confirm-modal');

    if (isAlert) {
      btnCancel.style.display = 'none';
      btnOk.innerText = 'OK';
    } else {
      btnCancel.style.display = 'block';
      btnOk.innerText = 'Oui, Confirmer';
    }

    modal.classList.add('active');

    const cleanUp = (result) => {
      modal.classList.remove('active');
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
      btnClose.removeEventListener('click', onCancel);
      resolve(result);
    };

    const onOk = () => cleanUp(true);
    const onCancel = () => cleanUp(false);

    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
    btnClose.addEventListener('click', onCancel);
  });
}

function exportToCSV() {
  if (state.transactions.length === 0) {
    showToast('Aucune transaction à exporter.', 'error');
    return;
  }

  let csvContent = 'Date,Libelle,Bien,Bailleur,Type,Montant\n';
  
  state.transactions.forEach(tx => {
    const prop = state.properties.find(p => p.id === tx.propertyId);
    const propName = prop ? prop.name : 'Inconnu';
    
    let ownerName = 'Inconnu';
    if (prop) {
      const owner = state.owners.find(o => o.id === prop.ownerId);
      ownerName = owner ? owner.name : 'Inconnu';
    }

    const row = [
      tx.date,
      `"${tx.description.replace(/"/g, '""')}"`,
      `"${propName}"`,
      `"${ownerName}"`,
      tx.type,
      tx.amount
    ].join(',');
    csvContent += row + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'immovi_transactions.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Journal des flux de l\'agence exporté avec succès.', 'success');
}

// ==========================================================================
// Gestion du Logo PNG d'Entreprise
// ==========================================================================

function loadLogo() {
  const customLogo = localStorage.getItem('immovi_custom_logo');
  const container = document.getElementById('receipt-logo-container');
  const resetBtn = document.getElementById('btn-reset-logo');
  const brandText = document.getElementById('receipt-brand-text');
  if (!container) return;
  
  if (customLogo) {
    container.innerHTML = `<img src="${customLogo}" style="height: 55px; max-width: 180px; object-fit: contain; display: block;">`;
    container.style.width = 'auto';
    container.style.height = 'auto';
    container.style.background = 'transparent';
    container.style.boxShadow = 'none';
    container.style.borderRadius = '0';
    if (brandText) brandText.style.display = 'none';
    if (resetBtn) resetBtn.style.display = 'inline-flex';
  } else {
    // Restaurer le logo SVG par défaut
    container.innerHTML = `
      <svg id="receipt-default-logo-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    `;
    container.style.width = '44px';
    container.style.height = '44px';
    container.style.background = 'var(--color-primary)';
    container.style.boxShadow = '0 4px 12px var(--color-primary-glow)';
    container.style.borderRadius = '12px';
    if (brandText) brandText.style.display = 'block';
    if (resetBtn) resetBtn.style.display = 'none';
  }
}

function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  if (file.type !== 'image/png') {
    showToast('Veuillez sélectionner un fichier image PNG.', 'error');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(evt) {
    localStorage.setItem('immovi_custom_logo', evt.target.result);
    loadLogo();
    showToast('Le logo PNG a été enregistré avec succès.', 'success');
  };
  reader.readAsDataURL(file);
}

function resetLogo() {
  localStorage.removeItem('immovi_custom_logo');
  loadLogo();
  showToast('Logo réinitialisé avec succès.', 'success');
}

// ==========================================================================
// Rendu : Onglet Locataires
// ==========================================================================

function renderTenantsTable() {
  const searchInput = document.getElementById('input-search-tenants');
  const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
  const tbody = document.getElementById('body-tenants-table');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  // Filtrer les biens occupés
  const occupiedProps = state.properties.filter(p => p.status === 'Loué');
  let tenantRowsCount = 0;
  
  occupiedProps.forEach(prop => {
    const tenant = getTenantForProperty(prop.id);
    const owner = state.owners.find(o => o.id === prop.ownerId);
    const ownerName = owner ? owner.name : 'Inconnu';
    
    // Filtres
    const matchesSearch = tenant.name.toLowerCase().includes(searchTerm) ||
                          prop.name.toLowerCase().includes(searchTerm) ||
                          ownerName.toLowerCase().includes(searchTerm);
                          
    if (matchesSearch) {
      tenantRowsCount++;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><a class="owner-click-link" style="font-weight: 600;" onclick="openTenantDossier('${prop.id}')">${tenant.name}</a></td>
        <td>${tenant.phone}</td>
        <td>
          <span class="badge badge-purple">${prop.name}</span>
          <span style="font-size: 0.75rem; color: var(--color-text-muted); display: block; margin-top: 0.25rem;">${prop.address}</span>
        </td>
        <td><a class="owner-click-link" onclick="openOwnerDossier('${prop.ownerId}')">${ownerName}</a></td>
        <td class="text-right" style="font-weight: 700; color: var(--color-green);">${formatCurrency(prop.rent)}</td>
        <td class="text-center no-print">
          <div style="display: flex; justify-content: center; align-items: center; gap: 0.5rem;">
          ${tenant.id ? `<button class="btn-icon-only info" onclick="openEditTenantModal('${tenant.id}')" title="Modifier ce locataire">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>` : ''}
            <button class="btn-icon-only" onclick="deleteTenant('${prop.id}')" title="Supprimer ce locataire">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-rose);">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    }
  });
  
  if (tenantRowsCount === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">Aucun locataire trouvé.</td></tr>`;
  }
}

// Helper pour vérifier le filtre par date (Par jour, Par mois, Par année)
function matchesDateFilter(txDateStr, filterTypeId, dayId, monthId, yearId) {
  const filterEl = document.getElementById(filterTypeId);
  const filterType = filterEl ? filterEl.value : 'all';
  if (filterType === 'all') return true;
  if (!txDateStr) return false;
  
  const txDate = new Date(txDateStr);
  if (filterType === 'day') {
    const dayVal = document.getElementById(dayId) ? document.getElementById(dayId).value : '';
    return dayVal ? txDateStr === dayVal : true;
  } else if (filterType === 'month') {
    const monthVal = document.getElementById(monthId) ? document.getElementById(monthId).value : '';
    if (monthVal) {
      const [y, m] = monthVal.split('-');
      return txDate.getFullYear() === parseInt(y) && (txDate.getMonth() + 1) === parseInt(m);
    }
    return true;
  } else if (filterType === 'year') {
    const yearVal = document.getElementById(yearId) ? document.getElementById(yearId).value : '';
    if (yearVal) {
      return txDate.getFullYear() === parseInt(yearVal);
    }
    return true;
  }
  return true;
}

// ==========================================================================
// Rendu : Onglet Comptabilité
// ==========================================================================

function renderAccounting() {
  const searchInput = document.getElementById('input-search-accounting');
  const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
  const tbodyEntrees = document.getElementById('body-accounting-entrées-table');
  const tbodySorties = document.getElementById('body-accounting-sorties-table');
  if (!tbodyEntrees || !tbodySorties) return;
  
  tbodyEntrees.innerHTML = '';
  tbodySorties.innerHTML = '';
  
  let grossInflows = 0;
  let grossOutflows = 0;
  let agencyCommissions = 0;
  
  // Trier les transactions par date décroissante
  const sortedTx = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  let matchingEntreesCount = 0;
  let matchingSortiesCount = 0;
  
  sortedTx.forEach(tx => {
    let commission = 0;
    let netOwner = 0;
    
    const prop = state.properties.find(p => p.id === tx.propertyId);
    let ownerName = 'Inconnu';
    let ownerId = '';
    let propName = 'Inconnu';
    if (prop) {
      propName = prop.name;
      const owner = state.owners.find(o => o.id === prop.ownerId);
      if (owner) {
        ownerName = owner.name;
        ownerId = owner.id;
        let rate = prop.commissionRate !== undefined && prop.commissionRate !== null && !isNaN(prop.commissionRate) ? prop.commissionRate : owner.commissionRate;
        commission = (tx.amount * rate) / 100;
      }
    }
    
    if (tx.type === 'income') {
      const matchesPeriod = matchesDateFilter(tx.date, 'entrees-filter-type', 'entrees-filter-day', 'entrees-filter-month', 'entrees-filter-year');
      if (matchesPeriod) {
        grossInflows += tx.amount;
        agencyCommissions += commission;
        netOwner = tx.amount - commission;
      }
      
      // Filtres
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm) ||
                            ownerName.toLowerCase().includes(searchTerm);
      if (matchesSearch && matchesPeriod) {
        matchingEntreesCount++;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${formatDateString(tx.date)}</td>
          <td style="font-weight: 500;">${tx.description}</td>
          <td><a class="owner-click-link" onclick="openOwnerDossier('${ownerId}')">${ownerName}</a></td>
          <td><span class="badge badge-purple">${propName}</span></td>
          <td class="text-right value-green" style="font-weight: 600;">+${formatCurrency(commission)}</td>
          <td class="text-center no-print">
            <button class="btn-icon-only primary" onclick="generateQuittancePDF('${tx.id}', true)" title="Télécharger la Quittance PDF">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <polyline points="9 15 12 18 15 15"></polyline>
              </svg>
            </button>
          </td>
        `;
        tbodyEntrees.appendChild(tr);
      }
    } else {
      const matchesPeriod = matchesDateFilter(tx.date, 'sorties-filter-type', 'sorties-filter-day', 'sorties-filter-month', 'sorties-filter-year');
      const isOwnerExpense = !!tx.propertyId;
      
      if (!isOwnerExpense && matchesPeriod) {
        grossOutflows += tx.amount;
      }
      
      // Filtres
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm) ||
                            ownerName.toLowerCase().includes(searchTerm);
      if (matchesSearch && matchesPeriod) {
        matchingSortiesCount++;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${formatDateString(tx.date)}</td>
          <td style="font-weight: 500;">${tx.description}</td>
          <td><span class="badge badge-purple">${tx.propertyId ? propName : 'Aucun (Agence)'}</span></td>
          <td class="text-right value-rose" style="font-weight: 700;">-${formatCurrency(tx.amount)}</td>
          <td class="text-center"><span class="badge badge-green">Validé</span></td>
        `;
        tbodySorties.appendChild(tr);
      }
    }
  });
  
  if (matchingEntreesCount === 0) {
    tbodyEntrees.innerHTML = `<tr><td colspan="5" class="text-center">Aucune recette trouvée.</td></tr>`;
  }
  if (matchingSortiesCount === 0) {
    tbodySorties.innerHTML = `<tr><td colspan="5" class="text-center">Aucune dépense ou retrait trouvé.</td></tr>`;
  }
  
  // Mettre à jour les compteurs
  document.getElementById('accounting-total-inflows').textContent = formatCurrency(grossInflows);
  document.getElementById('accounting-net-agency').textContent = formatCurrency(agencyCommissions);
  document.getElementById('accounting-total-outflows').textContent = formatCurrency(grossOutflows);
  
  const balanceEl = document.getElementById('accounting-balance');
  if (balanceEl) {
    // Solde = Commissions de l'agence - Dépenses (Si les dépenses incluent les reversements bailleurs, 
    // le solde réel de l'agence dépendra de si on compte les reversements comme des dépenses agence ou non.
    // Mais mathématiquement, on affiche la différence entre ce qui est affiché dans Entrées et Sorties).
    const balance = agencyCommissions - grossOutflows;
    balanceEl.textContent = formatCurrency(balance);
    if (balance < 0) {
      balanceEl.className = 'kpi-value value-rose';
      balanceEl.style.color = 'var(--color-rose)';
    } else {
      balanceEl.className = 'kpi-value value-blue';
      balanceEl.style.color = '#3b82f6';
    }
  }
}

// Enregistrer les flux du reçu interactif
async function handleSaveReceipt() {
  const rows = document.querySelectorAll('#body-receipt-table .receipt-row');
  if (rows.length === 0) {
    showToast('Aucun flux à enregistrer dans le reçu.', 'error');
    return;
  }
  
  let savedCount = 0;
  let duplicatedCount = 0;
  let totalCommissionsAdded = 0;
  
  for (const row of rows) {
    const tenantSelect = row.querySelector('.receipt-tenant-select');
    const propertyId = tenantSelect.value;
    const paidInput = row.querySelector('.receipt-paid-input');
    const paidAmount = parseInt(paidInput.value) || 0;
    const monthInput = row.querySelector('.receipt-month-input');
    const month = monthInput.value.trim();
    
    if (propertyId && paidAmount > 0 && month) {
      // Vérifier si un encaissement pour ce bien, ce mois et ce type existe déjà
      const exists = state.transactions.some(tx => 
        tx.propertyId === propertyId && 
        tx.type === 'income' &&
        tx.description.includes(month)
      );
      
      if (exists) {
        duplicatedCount++;
        return;
      }
      
      const prop = state.properties.find(p => p.id === propertyId);
      if (prop) {
        const owner = state.owners.find(o => o.id === prop.ownerId);
        const commissionRate = owner ? owner.commissionRate : 10;
        const commission = (paidAmount * commissionRate) / 100;
        
        const newTx = {
          id: 'tx-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          description: `Loyer ${month} - ${prop.name} (Reçu)`,
          amount: paidAmount,
          type: 'income',
          property_id: propertyId,
          date: getTodayDateString()
        };
        
        await API.createTransaction(newTx);
        totalCommissionsAdded += commission;
        savedCount++;
      }
    }
  }
  
  if (savedCount > 0) {
    await loadData();
    calculateKPIs(); // Mettre à jour les compteurs du dashboard
    
    let msg = `Enregistré avec succès : ${savedCount} flux de loyers.`;
    if (totalCommissionsAdded > 0) {
      msg += ` Commissions agence : +${formatCurrency(totalCommissionsAdded)}.`;
    }
    if (duplicatedCount > 0) {
      msg += ` (${duplicatedCount} doublons ignorés).`;
    }
    
    showToast(msg, 'success');
    
    // Mettre à jour l'onglet des détails pour recalculer les fonds disponibles
    if (state.activeOwnerId) {
      openOwnerDossier(state.activeOwnerId);
    }
  } else {
    if (duplicatedCount > 0) {
      showToast(`Aucun flux enregistré (${duplicatedCount} doublons déjà présents pour ce mois).`, 'warning');
    } else {
      showToast('Aucun flux valide (montant > 0) à enregistrer.', 'error');
    }
  }
}

function handleClearReceiptTable() {
  const tbody = document.getElementById('body-receipt-table');
  if (tbody) {
    tbody.innerHTML = '';
    recalculateReceiptSummary();
    showToast("Le reçu a été entièrement vidé.", "success");
  }
}

async function handleWithdrawalSubmit(e) {
  e.preventDefault();
  const amount = parseInt(document.getElementById('input-withdrawal-amount').value, 10);
  if (!amount || amount <= 0) {
    showToast('Veuillez entrer un montant valide.', 'error');
    return;
  }
  
  const owner = state.owners.find(o => o.id === state.activeOwnerId);
  if (!owner) return;
  
  // Re-calculate balance
  const ownerProperties = state.properties.filter(p => p.ownerId === owner.id);
  const ownerPropIds = ownerProperties.map(p => p.id);
  const ownerIncomes = state.transactions.filter(t => t.type === 'income' && ownerPropIds.includes(t.propertyId));
  const recentIncomes = ownerIncomes.filter(t => {
    const daysDiff = (new Date() - new Date(t.date)) / (1000 * 60 * 60 * 24);
    return daysDiff <= 9;
  });
  const pendingBrut = recentIncomes.reduce((sum, t) => sum + t.amount, 0);
  const pendingCom = (pendingBrut * owner.commissionRate) / 100;
  const recentWithdrawals = state.transactions.filter(t => 
      t.type === 'expense' && 
      ownerPropIds.includes(t.propertyId) && 
    (new Date() - new Date(t.date)) / (1000 * 60 * 60 * 24) <= 9
  );
  const sumRecentWithdrawals = recentWithdrawals.reduce((sum, w) => sum + w.amount, 0);
  const pendingNet = Math.max(0, (pendingBrut - pendingCom) - sumRecentWithdrawals);

  if (amount > pendingNet) {
    showToast(`Montant supérieur au solde disponible (${formatCurrency(pendingNet)}).`, 'error');
    return;
  }

  const newWithdrawal = {
    id: 'tx-withdrawal-' + Date.now(),
    description: `Retrait de fonds : ${owner.name}`,
    amount: amount,
    type: 'expense',
    property_id: ownerProperties[0].id,
    date: getTodayDateString()
  };

  await API.createTransaction(newWithdrawal);
  await loadData();
  
  document.getElementById('modal-withdrawal').classList.remove('active');
  showToast(`Le retrait de ${formatCurrency(amount)} a été enregistré avec succès.`, 'success');
  openOwnerDossier(owner.id);
}

function deleteWithdrawalTransaction(txId) {
  showCustomConfirm("Voulez-vous supprimer ce retrait ? Cela annulera le retrait et remettra les fonds dans le solde disponible.").then(async confirmed => {
    if (confirmed) {
      try {
        await API.deleteTransaction(txId);
        await loadData();
        renderAccounting();
        renderDashboard();
        if (state.activeOwnerId) {
          openOwnerDossier(state.activeOwnerId);
        }
        showToast("Retrait annulé et fonds réapprovisionnés.", "warning");
      } catch(e) {
        showToast(e.message, 'error');
      }
    }
  });
}

function getCurrentMonthString() {
  const date = new Date();
  const months = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  const monthName = months[date.getMonth()];
  const yearShort = date.getFullYear().toString().slice(-2);
  return `${monthName}-${yearShort}`;
}

function generateMonthsRange(startDateStr) {
  const start = new Date(startDateStr);
  const months = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  const result = [];
  
  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  
  for (let i = 0; i < 12; i++) {
    const monthName = months[current.getMonth()];
    const yearShort = current.getFullYear().toString().slice(-2);
    result.push({
      name: `${monthName}-${yearShort}`,
      monthIndex: current.getMonth(),
      year: current.getFullYear()
    });
    current.setMonth(current.getMonth() + 1);
  }
  return result;
}

function openTenantDossier(propertyId) {
  const prop = state.properties.find(p => p.id === propertyId);
  if (!prop) return;
  
  const tenant = getTenantForProperty(propertyId);
  const owner = state.owners.find(o => o.id === prop.ownerId);
  const ownerName = owner ? owner.name : 'Inconnu';
  
  // Remplissage de la fiche signalétique
  document.getElementById('dossier-tenant-name').textContent = tenant.name;
  document.getElementById('dossier-tenant-phone').textContent = tenant.phone;
  document.getElementById('dossier-tenant-property').textContent = prop.name;
  document.getElementById('dossier-tenant-owner').textContent = ownerName;
  document.getElementById('dossier-tenant-lease-start').textContent = formatDateString(tenant.leaseStart);
  document.getElementById('dossier-tenant-caution').textContent = formatCurrency(tenant.caution);
  document.getElementById('dossier-tenant-rent').textContent = formatCurrency(prop.rent);
  document.getElementById('dossier-tenant-address').textContent = tenant.address;
  
  // Générer le tableau de suivi des loyers mensuels
  const monthsRange = generateMonthsRange(tenant.leaseStart);
  const tbody = document.getElementById('body-tenant-payments-table');
  if (tbody) {
    tbody.innerHTML = '';
    
    let cumulativePaid = 0;
    let cumulativeDue = 0;
    
    monthsRange.forEach((m) => {
      // Trouver les paiements pour ce bien ce mois-ci
      const monthPayments = state.transactions.filter(t => 
        t.propertyId === prop.id &&
        t.type === 'income' &&
        (t.description.toLowerCase().includes(m.name.toLowerCase()) || 
         t.description.toLowerCase().includes(m.name.replace('-', ' ').toLowerCase()))
      );
      
      const paidThisMonth = monthPayments.reduce((sum, t) => sum + t.amount, 0);
      cumulativeDue += prop.rent;
      cumulativePaid += paidThisMonth;
      
      const solde = cumulativePaid - cumulativeDue;
      const reliquat = Math.max(0, cumulativeDue - cumulativePaid);
      
      const avanceMonths = solde > 0 ? Math.floor(solde / prop.rent) : 0;
      const retardMonths = solde < 0 ? Math.ceil(Math.abs(solde) / prop.rent) : 0;
      
      const soldeDisplay = solde === 0 
        ? '- FCFA' 
        : (solde > 0 ? `+${formatCurrency(solde)}` : `-${formatCurrency(Math.abs(solde))}`);
        
      const reliquatDisplay = reliquat === 0 ? '- FCFA' : formatCurrency(reliquat);
      const paidDisplay = paidThisMonth === 0 ? '- FCFA' : formatCurrency(paidThisMonth);
      const totalPaidDisplay = cumulativePaid === 0 ? '- FCFA' : formatCurrency(cumulativePaid);
      
      const statusBadge = reliquat <= 0 
        ? '<span class="badge badge-green" style="display: inline-block; padding: 0.25rem 0.6rem;">À jour</span>' 
        : '<span class="badge badge-rose" style="display: inline-block; padding: 0.25rem 0.6rem;">Pas à jour</span>';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600; color: var(--color-text-primary); vertical-align: middle;">${m.name}</td>
        <td class="text-right" style="color: var(--color-text-muted); vertical-align: middle;">${formatCurrency(prop.rent)}</td>
        <td class="text-right ${paidThisMonth > 0 ? 'value-green' : ''}" style="font-weight: 600; vertical-align: middle;">
          <input type="number" class="form-input tenant-paid-month-input text-right" style="width: 130px; background: transparent; border: 1px solid var(--glass-border); padding: 0.25rem 0.5rem; color: var(--color-text-primary); font-weight: 700; display: inline-block;" data-month="${m.name}" value="${paidThisMonth}">
        </td>
        <td class="text-right" style="color: var(--color-text-muted); vertical-align: middle;">${totalPaidDisplay}</td>
        <td class="text-right" style="color: ${solde > 0 ? 'var(--color-green)' : (solde < 0 ? 'var(--color-rose)' : 'white')}; vertical-align: middle;">${soldeDisplay}</td>
        <td class="text-right ${reliquat > 0 ? 'value-rose' : ''}" style="font-weight: 600; vertical-align: middle;">${reliquatDisplay}</td>
        <td class="text-center" style="vertical-align: middle;">${avanceMonths}</td>
        <td class="text-center" style="color: ${retardMonths > 0 ? 'var(--color-rose)' : 'white'}; vertical-align: middle;">${retardMonths}</td>
        <td class="text-center" style="vertical-align: middle;">${statusBadge}</td>
      `;
      tbody.appendChild(tr);
    });

    // Attacher les écouteurs d'événements pour la modification des loyers mensuels
    const paidInputs = tbody.querySelectorAll('.tenant-paid-month-input');
    paidInputs.forEach(input => {
      input.addEventListener('change', async (e) => {
        const monthName = input.getAttribute('data-month');
        const newAmount = parseInt(input.value, 10) || 0;
        
        // Trouver la transaction correspondante
        let tx = state.transactions.find(t => 
          t.propertyId === prop.id &&
          t.type === 'income' &&
          (t.description.toLowerCase().includes(monthName.toLowerCase()) || 
           t.description.toLowerCase().includes(monthName.replace('-', ' ').toLowerCase()))
        );
        
        if (tx) {
          if (newAmount === 0) {
            // Supprimer la transaction si le montant est mis à 0
            await API.deleteTransaction(tx.id);
            showToast(`Transaction de loyer pour ${monthName} supprimée.`, 'warning');
          } else {
            tx.amount = newAmount;
            await API.updateTransaction(tx.id, tx);
            showToast(`Transaction de loyer pour ${monthName} mise à jour : ${formatCurrency(newAmount)}`, 'success');
          }
        } else if (newAmount > 0) {
          // Créer une nouvelle transaction si elle n'existait pas
          const newTx = {
            id: 'tx-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            description: `Loyer ${monthName} - ${prop.name}`,
            amount: newAmount,
            type: 'income',
            property_id: prop.id,
            date: getTodayDateString()
          };
          await API.createTransaction(newTx);
          showToast(`Loyer pour ${monthName} enregistré : ${formatCurrency(newAmount)}`, 'success');
        }
        
        await loadData();
        calculateKPIs();
        openTenantDossier(prop.id); // Re-rendre tout le dossier pour recalculer les cumuls
      });
    });
    
    // Mettre à jour le montant total payé
    document.getElementById('tenant-dossier-total-paid').textContent = formatCurrency(cumulativePaid);
  }
  
  switchTab('tenant-dossier');
}

function openTenantModal() {
  const elId = document.getElementById('input-tenant-id');
  if(elId) elId.value = '';
  const form = document.getElementById('form-tenant');
  if (form) form.reset();
  
  const leaseStartInput = document.getElementById('input-tenant-lease-start');
  if (leaseStartInput) {
    leaseStartInput.value = getTodayDateString();
  }
  
  const select = document.getElementById('select-tenant-property');
  if (select) {
    select.innerHTML = '<option value="" disabled selected>Choisir un bien...</option>';
    const availableProps = state.properties.filter(p => p.status === 'Disponible' || p.status === 'Libre');
    if (availableProps.length === 0) {
      select.innerHTML = '<option value="" disabled>Aucun bien disponible (Tous loués/travaux)</option>';
      document.getElementById('input-tenant-rent').value = '0 FCFA';
      document.getElementById('input-tenant-caution').value = 0;
    } else {
      availableProps.forEach(p => {
        const owner = state.owners.find(o => o.id === p.ownerId);
        const ownerName = owner ? owner.name : 'Inconnu';
        select.innerHTML += `<option value="${p.id}">${p.name} (Bailleur: ${ownerName} | Loyer: ${formatCurrency(p.rent)})</option>`;
      });
    }
  }
  
  document.getElementById('modal-tenant').classList.add('active');
}

async function handleTenantSubmit(e) {
    e.preventDefault();
    const editId = document.getElementById('input-tenant-id') ? document.getElementById('input-tenant-id').value : '';
    const propId = document.getElementById('select-tenant-property').value;
    const name = document.getElementById('input-tenant-name').value.trim();
    const phone = document.getElementById('input-tenant-phone').value.trim();
    const email = document.getElementById('input-tenant-email') ? document.getElementById('input-tenant-email').value.trim() : '';
    const cni = document.getElementById('input-tenant-cni') ? document.getElementById('input-tenant-cni').value.trim() : '';
    const leaseStart = document.getElementById('input-tenant-entry') ? document.getElementById('input-tenant-entry').value : document.getElementById('input-tenant-lease-start').value;
    const address = document.getElementById('input-tenant-address') ? document.getElementById('input-tenant-address').value.trim() : '';
    const caution = parseInt(document.getElementById('input-tenant-caution').value, 10) || 0;

    if (!propId || !name || !phone) {
      showToast('Veuillez remplir les informations obligatoires.', 'error');
      return;
    }

    const prop = state.properties.find(p => p.id === propId);
    if (!prop) {
      showToast('Bien introuvable.', 'error');
      return;
    }

    try {
      const newTenant = {
          id: editId || ('ten-' + Date.now()),
          property_id: propId,
          name,
          phone,
          email: email,
          cni: cni,
          address: address || 'Non specifiee',
          entry_date: leaseStart || new Date().toISOString().split('T')[0],
          rent_amount: prop.rent_amount || prop.price || 0,
          caution_amount: caution,
          status: 'Actif'
      };
  
      if (editId) {
          await API.updateTenant(editId, newTenant);
          if(document.getElementById('input-tenant-id')) document.getElementById('input-tenant-id').value = '';
      } else {
          await API.createTenant(newTenant);
      }
  
      await API.updateProperty(propId, {
        ...prop,
        status: 'Loué',
        tenant_name: name,
        tenant_phone: phone
      });
  
      document.getElementById('modal-tenant').classList.remove('active');
      showToast(`Le locataire ${name} a ete enregistre avec succes pour le bien ${prop.name}.`, 'success');
      
      await loadData();
      renderTenantsTable();
      renderPropertiesGrid();
    } catch (err) {
      showToast(err.message || 'Erreur lors de l\'enregistrement du locataire.', 'error');
    }
}

// Démarrage de l'application
window.addEventListener('DOMContentLoaded', () => {
  async function startApp() {
    const token = getAuthToken();
    if (!token) {
      window.location.href = 'login.html';
      return;
    }
    
    let currentUser = null;
    try {
      currentUser = await API.getCurrentUser();
    } catch (err) {
      if (err.message === 'Session expirée' || (err.message && err.message.includes('Session'))) {
        removeAuthToken();
        localStorage.removeItem('immovi_local_user');
        window.location.href = 'login.html';
        return;
      }
      
      const localUserRaw = localStorage.getItem('immovi_local_user');
      if (localUserRaw) {
        currentUser = JSON.parse(localUserRaw);
      } else {
        removeAuthToken();
        window.location.href = 'login.html';
        return;
      }
    }
    
    try {
      await loadData();
      
      // Set real authenticated user with role and permissions intact
      if (currentUser) {
        state.currentUser = currentUser;
        // Look up member in state.staff for exact permissions/role set by admin
        const existingStaff = state.staff.find(s => s.email && currentUser.email && s.email.toLowerCase() === currentUser.email.toLowerCase());
        if (existingStaff) {
          currentUser.role = existingStaff.role || currentUser.role || 'Agent Premium';
          currentUser.permissions = existingStaff.permissions || currentUser.permissions || ['dashboard'];
          const idx = state.staff.findIndex(s => s.email && currentUser.email && s.email.toLowerCase() === currentUser.email.toLowerCase());
          state.staff[idx] = { ...existingStaff, ...currentUser };
        } else {
          currentUser.role = currentUser.role || 'Administrateur';
          currentUser.permissions = currentUser.permissions || ['all'];
          state.staff.unshift(currentUser);
        }
      }
      
      // Apply permission-based menu filtering
      applyUserPermissions(currentUser);
      
      // Update sidebar profile display
      const avatarEl = document.getElementById('sidebar-user-avatar');
      const nameEl = document.getElementById('sidebar-user-name');
      const roleEl = document.getElementById('sidebar-user-role');
      if (avatarEl && currentUser.name) avatarEl.textContent = currentUser.name.substring(0, 2).toUpperCase();
      if (nameEl && currentUser.name) nameEl.textContent = currentUser.name;
      if (roleEl) roleEl.textContent = currentUser.role || 'Administrateur';
      
      // Setup logout button
      const btnLogout = document.getElementById('btn-logout');
      if (btnLogout) {
        btnLogout.addEventListener('click', () => {
          removeAuthToken();
          localStorage.removeItem('immovi_local_user');
          window.location.href = 'login.html';
        });
      }

      initSettingsSubTabs();
      setupSubscriptionModal();
      initApp();
    } catch (err) {
      console.error("Erreur de session:", err);
      removeAuthToken();
      window.location.href = 'login.html';
    }
  }
  startApp();
});

// --- Gestionnaire de Résiliation & Affichage d'Abonnement ---
function setupSubscriptionModal() {
  const btnOpenCancel = document.getElementById('btn-open-cancel-sub');
  const modalCancel = document.getElementById('modal-cancel-subscription');
  const btnCloseCancel = document.getElementById('btn-close-cancel-sub');
  const btnKeepSub = document.getElementById('btn-keep-sub');
  const btnConfirmCancel = document.getElementById('btn-confirm-cancel-sub');

  const badge = document.getElementById('sub-card-badge');
  const planEl = document.getElementById('sub-card-plan');
  const trialEl = document.getElementById('sub-card-trial');
  const dateEl = document.getElementById('sub-card-next-date');

  const currentUser = state.currentUser;
  const isSuperAdmin = currentUser && (currentUser.role === 'Administrateur' || currentUser.email === 'admin@immovi.ml');

  if (isSuperAdmin) {
    if (badge) {
      badge.textContent = 'Compte Fondateur — Illimité à vie';
      badge.style.background = 'rgba(16, 185, 129, 0.15)';
      badge.style.color = '#34d399';
      badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    }
    if (planEl) planEl.textContent = 'Super Admin / Fondateur (Gratuit à vie)';
    if (trialEl) trialEl.textContent = 'Accès complet illimité';
    if (dateEl) dateEl.textContent = 'Aucune échéance (Accès permanent)';
    if (btnOpenCancel) btnOpenCancel.style.display = 'none';
  } else {
    if (badge) {
      badge.textContent = 'Plan Premium — Actif';
      badge.style.background = 'rgba(139, 92, 246, 0.2)';
      badge.style.color = '#a78bfa';
      badge.style.borderColor = 'rgba(139, 92, 246, 0.4)';
    }
    if (planEl) planEl.textContent = 'Premium (1 000 FCFA / mois)';
    if (trialEl) trialEl.textContent = 'Aucun (Paiement immédiat)';
    if (dateEl) dateEl.textContent = "Aujourd'hui";
    if (btnOpenCancel) btnOpenCancel.style.display = 'flex';
  }

  if (btnOpenCancel && modalCancel) {
    btnOpenCancel.addEventListener('click', () => {
      modalCancel.classList.add('active');
    });
  }

  const closeModal = () => {
    if (modalCancel) modalCancel.classList.remove('active');
  };

  if (btnCloseCancel) btnCloseCancel.addEventListener('click', closeModal);
  if (btnKeepSub) btnKeepSub.addEventListener('click', closeModal);

  if (btnConfirmCancel) {
    btnConfirmCancel.addEventListener('click', () => {
      closeModal();
      
      if (badge) {
        badge.textContent = 'Résiliation programmée';
        badge.style.background = 'rgba(244, 63, 94, 0.15)';
        badge.style.color = 'var(--color-rose-hover)';
        badge.style.borderColor = 'rgba(244, 63, 94, 0.3)';
      }
      if (planEl) {
        planEl.textContent = 'Starter (Gratuit dès le 22/08/2026)';
      }
      if (btnOpenCancel) {
        btnOpenCancel.style.display = 'none';
      }

      showToast("Résiliation enregistrée. Votre compte repassera au Plan Starter (Gratuit) à la fin de votre période d'essai.", "info");
    });
  }
}

// --- Rendu & Actions pour la page Paramètres (Settings) ---
function renderSettingsView() {
  if (state.agencySettings) {
    const s = state.agencySettings;
    const inputName = document.getElementById('input-settings-name');
    const inputAddress = document.getElementById('input-settings-address');
    const inputPhone = document.getElementById('input-settings-phone');
    const inputEmail = document.getElementById('input-settings-email');
    const inputCurrency = document.getElementById('input-settings-currency');
    const inputCommission = document.getElementById('input-settings-commission');
    const inputNif = document.getElementById('input-settings-nif');
    const inputSlogan = document.getElementById('input-settings-slogan');

    if (inputName) inputName.value = s.name || '';
    if (inputAddress) inputAddress.value = s.address || '';
    if (inputPhone) inputPhone.value = s.phone || '';
    if (inputEmail) inputEmail.value = s.email || '';
    if (inputCurrency) inputCurrency.value = s.currency || 'FCFA';
    if (inputCommission) inputCommission.value = s.commissionRate || 10;
    if (inputNif) inputNif.value = s.nif || '';
    if (inputSlogan) inputSlogan.value = s.slogan || '';
  }

  // Actualiser la carte d'abonnement selon l'utilisateur connecté
  setupSubscriptionModal();
}

// --- Système de Thème & Mode d'affichage (Clair / Sombre) ---
function setThemeOption(theme) {
  if (theme === 'light') {
    document.documentElement.classList.add('theme-light');
    localStorage.setItem('immovi_theme', 'light');
  } else {
    document.documentElement.classList.remove('theme-light');
    localStorage.setItem('immovi_theme', 'dark');
  }
  updateThemeCardUI(theme);
}
window.setThemeOption = setThemeOption;

function updateThemeCardUI(theme) {
  const cardLight = document.getElementById('theme-card-light');
  const cardDark = document.getElementById('theme-card-dark');

  if (cardLight && cardDark) {
    if (theme === 'light') {
      cardLight.classList.add('active-theme');
      cardDark.classList.remove('active-theme');
    } else {
      cardDark.classList.add('active-theme');
      cardLight.classList.remove('active-theme');
    }
  }
}

function initThemeSystem() {
  const savedTheme = localStorage.getItem('immovi_theme') || 'dark';
  if (savedTheme === 'light') {
    document.documentElement.classList.add('theme-light');
  } else {
    document.documentElement.classList.remove('theme-light');
  }
  updateThemeCardUI(savedTheme);
}

function initSettingsSubTabs() {
  initThemeSystem();
  document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-settings-target');
      
      document.querySelectorAll('.settings-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.style.borderBottomColor = 'transparent';
        b.style.color = 'var(--color-text-muted)';
      });

      btn.classList.add('active');
      btn.style.borderBottomColor = 'var(--color-primary)';
      btn.style.color = 'var(--color-text-primary)';

      document.querySelectorAll('.settings-tab-content').forEach(content => {
        if (content.id === targetId) {
          content.style.display = 'block';
          content.classList.add('active');
        } else {
          content.style.display = 'none';
          content.classList.remove('active');
        }
      });
    });
  });
}

// --- Rendu & Actions pour la page Personnel (Staff) ---
function renderStaffTable() {
  const tbody = document.getElementById('body-staff-table');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!state.staff || state.staff.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Aucun membre du personnel enregistré.</td></tr>';
    return;
  }

  state.staff.forEach(member => {
    let roleClass = 'badge-purple';
    if (member.role === 'Administrateur') roleClass = 'badge-admin';
    else if (member.role === 'Agent Premium') roleClass = 'badge-agent';
    else if (member.role === 'Comptable') roleClass = 'badge-comptable';
    else if (member.role === 'Assistant') roleClass = 'badge-assistant';

    let statusClass = member.status === 'Actif' ? 'badge-actif' : 'badge-inactif';
    
    // Toggle action text
    const toggleTitle = member.status === 'Actif' ? 'Désactiver' : 'Activer';
    const toggleIcon = member.status === 'Actif' 
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>` // Lock
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`; // Unlock

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 600; color: var(--color-text-primary);">${member.name}</td>
      <td><span class="badge ${roleClass}">${member.role}</span></td>
      <td>${member.phone}</td>
      <td>${member.email}</td>
      <td class="text-center"><span class="badge ${statusClass}">${member.status}</span></td>
      <td class="text-center no-print">
        <div style="display: flex; justify-content: center; gap: 0.5rem;">
          <button class="btn-icon-only" onclick="toggleStaffStatus('${member.id}')" title="${toggleTitle}">
            ${toggleIcon}
          </button>
          <button class="btn-icon-only" onclick="openEditStaffModal('${member.id}')" title="Modifier">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-icon-only danger" onclick="deleteStaff('${member.id}')" title="Supprimer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openStaffModal() {
  const form = document.getElementById('form-staff');
  if (form) form.reset();
  document.getElementById('modal-staff-title').textContent = 'Nouveau Collaborateur';
  document.getElementById('input-staff-id').value = '';
  document.getElementById('input-staff-password').value = '';
  document.querySelectorAll('.staff-permission-cb').forEach(cb => {
    if (cb.value === 'dashboard') cb.checked = true;
    else cb.checked = false;
  });
  document.getElementById('modal-staff').classList.add('active');
}

function openEditStaffModal(id) {
  const member = state.staff.find(m => m.id === id);
  if (!member) return;

  document.getElementById('modal-staff-title').textContent = 'Modifier le Collaborateur';
  document.getElementById('input-staff-id').value = member.id;
  document.getElementById('input-staff-name').value = member.name;
  document.getElementById('input-staff-phone').value = member.phone;
  document.getElementById('input-staff-email').value = member.email;
  document.getElementById('select-staff-role').value = member.role;
  document.getElementById('select-staff-status').value = member.status;
  document.getElementById('input-staff-password').value = ''; // leave empty unless typing a new one

  const userPerms = member.permissions || [];
  document.querySelectorAll('.staff-permission-cb').forEach(cb => {
    cb.checked = userPerms.includes(cb.value);
  });

  document.getElementById('modal-staff').classList.add('active');
}

async function handleStaffSubmit(e) {
  e.preventDefault();
  
  const idInput = document.getElementById('input-staff-id').value;
  const name = document.getElementById('input-staff-name').value.trim();
  const phone = document.getElementById('input-staff-phone').value.trim();
  const email = document.getElementById('input-staff-email').value.trim();
  const role = document.getElementById('select-staff-role').value;
  const status = document.getElementById('select-staff-status').value;
  const pwdInput = document.getElementById('input-staff-password').value;

  const permissions = Array.from(document.querySelectorAll('.staff-permission-cb:checked')).map(cb => cb.value);

  if (!name || !phone || !email) {
    showToast('Veuillez remplir tous les champs obligatoires.', 'error');
    return;
  }

  if (idInput) {
    // Modification
    const updatePayload = {
      name, phone, email, role, status, permissions
    };
    if (pwdInput) updatePayload.password = pwdInput;
      
    try {
      if (typeof API !== 'undefined' && API.updateUser) {
        await API.updateUser(idInput, updatePayload);
      }
    } catch (err) {
      showToast(err.message || 'Erreur lors de la mise à jour.', 'error');
      return;
    }
    showToast(`Collaborateur ${name} mis à jour.`, 'success');
  } else {
    // Création
    if (!pwdInput) {
      showToast('Un mot de passe est obligatoire pour la création.', 'error');
      return;
    }

    try {
      if (typeof API !== 'undefined' && API.createStaffUser) {
        await API.createStaffUser(name, email, pwdInput, role, permissions);
      }
    } catch (err) {
      showToast(err.message || 'Erreur lors de la création.', 'error');
      return;
    }
    showToast(`Compte de ${name} créé. Il/Elle peut désormais se connecter !`, 'success');
  }
  closeAllModals();
  await loadData();
  renderStaffTable();
}

function toggleStaffStatus(id) {
  const member = state.staff.find(m => m.id === id);
  if (member) {
    member.status = member.status === 'Actif' ? 'Inactif' : 'Actif';
    
    try {
      if (typeof API !== 'undefined' && API.updateUser) {
        API.updateUser(member.id, { status: member.status }).catch(err => console.warn(err));
      }
    } catch(e) {}
    renderStaffTable();
    showToast(`Statut de ${member.name} mis à jour : ${member.status}`, 'success');
  }
}

function deleteStaff(id) {
  const member = state.staff.find(m => m.id === id);
  if (!member) return;

  showCustomConfirm(`Voulez-vous vraiment retirer ${member.name} de l'équipe ?`).then(confirmed => {
    if (confirmed) {
      try {
        if (typeof API !== 'undefined' && API.deleteUser) {
          API.deleteUser(id);
        }
      } catch (e) {}
      
      state.staff = state.staff.filter(m => m.id !== id);
      renderStaffTable();
      showToast(`Collaborateur ${member.name} retiré.`, 'warning');
    }
  });
}

// --- Rendu & Actions pour la page Paramètres (Settings) ---
function renderSettingsView() {
  const settings = state.agencySettings || {};
  
  const nameInput = document.getElementById('input-settings-name');
  const addressInput = document.getElementById('input-settings-address');
  const phoneInput = document.getElementById('input-settings-phone');
  const emailInput = document.getElementById('input-settings-email');
  const currencyInput = document.getElementById('input-settings-currency');
  const commissionInput = document.getElementById('input-settings-commission');
  const nifInput = document.getElementById('input-settings-nif');
  const sloganInput = document.getElementById('input-settings-slogan');
    

  if (nameInput) nameInput.value = settings.name || '';
  if (addressInput) addressInput.value = settings.address || '';
  if (phoneInput) phoneInput.value = settings.phone || '';
  if (emailInput) emailInput.value = settings.email || '';
  if (currencyInput) currencyInput.value = settings.currency || 'FCFA';
  if (commissionInput) commissionInput.value = settings.commissionRate || 10;
  if (nifInput) nifInput.value = settings.nif || '';
  if (sloganInput) sloganInput.value = settings.slogan || '';
    
}

async function handleSettingsAgencySubmit(e) {
  e.preventDefault();
  
  const name = document.getElementById('input-settings-name').value.trim();
  const address = document.getElementById('input-settings-address').value.trim();
  const phone = document.getElementById('input-settings-phone').value.trim();
  const email = document.getElementById('input-settings-email').value.trim();
  const currency = document.getElementById('input-settings-currency').value.trim();
  const commissionRate = parseInt(document.getElementById('input-settings-commission').value) || 10;
  const nif = document.getElementById('input-settings-nif') ? document.getElementById('input-settings-nif').value.trim() : '';
  const slogan = document.getElementById('input-settings-slogan') ? document.getElementById('input-settings-slogan').value.trim() : '';

  state.agencySettings = {
    ...state.agencySettings,
    name,
    address,
    phone,
    email,
    currency,
    commissionRate,
    nif,
    slogan
  };
  try {
    await API.updateSettings({
      name: state.agencySettings.name,
      address: state.agencySettings.address,
      phone: state.agencySettings.phone,
      email: state.agencySettings.email,
      currency: state.agencySettings.currency,
      commission_rate: state.agencySettings.commissionRate,
      nif: state.agencySettings.nif,
      slogan: state.agencySettings.slogan,
      logo_base64: state.agencySettings.logoBase64 || null
    });
  } catch (err) {
    console.error("Erreur sauvegarde API settings:", err);
  }
  renderGlobalPrintHeader();
  showToast("Paramètres de l'agence enregistrés avec succès.", 'success');
}

function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(evt) {
    state.agencySettings = state.agencySettings || {};
    state.agencySettings.logoBase64 = evt.target.result;
    try {
      await API.updateSettings({
        name: state.agencySettings.name || 'Immovi S.A.R.L',
        address: state.agencySettings.address || '',
        phone: state.agencySettings.phone || '',
        email: state.agencySettings.email || '',
        currency: state.agencySettings.currency || 'FCFA',
        commission_rate: state.agencySettings.commissionRate || 10,
        nif: state.agencySettings.nif || '',
        slogan: state.agencySettings.slogan || '',
        logo_base64: state.agencySettings.logoBase64
      });
    } catch (err) {}
    renderGlobalPrintHeader();
    showToast('Le logo a été mis à jour.', 'success');
  };
  reader.readAsDataURL(file);
}

async function resetLogo() {
  if (state.agencySettings) {
    delete state.agencySettings.logoBase64;
    try {
      await API.updateSettings({
        name: state.agencySettings.name || 'Immovi S.A.R.L',
        address: state.agencySettings.address || '',
        phone: state.agencySettings.phone || '',
        email: state.agencySettings.email || '',
        currency: state.agencySettings.currency || 'FCFA',
        commission_rate: state.agencySettings.commissionRate || 10,
        nif: state.agencySettings.nif || '',
        slogan: state.agencySettings.slogan || '',
        logo_base64: null
      });
    } catch (err) {}
    renderGlobalPrintHeader();
    showToast('Le logo par défaut a été restauré.', 'success');
  }
}

function renderGlobalPrintHeader() {
  const settings = state.agencySettings || {};
  const globalHeaderContainer = document.getElementById('global-print-header');
  const dynamicReceiptHeader = document.getElementById('dynamic-receipt-header');
  
  // Mettre à jour le grand titre de l'en-tête selon le nom de l'agence configuré
  const greetingTitle = document.getElementById('greeting-title');
  if (greetingTitle) {
    const rawName = (settings.name && settings.name.trim()) ? settings.name.trim() : 'Immovi S.A.R.L';
    const displayTitle = rawName.toLowerCase().includes('gestion')
      ? rawName
      : `Gestion d'Agence ${rawName}`;
    greetingTitle.textContent = displayTitle;
  }
  
  const logoHtml = settings.logoBase64
    ? `<img src="${settings.logoBase64}" alt="Logo Agence" style="max-height: 50px; border-radius: 8px;">`
    : `<div style="background: var(--color-primary) !important; color: var(--color-text-primary) !important; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-primary) !important;">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
       </div>`;

  const htmlContent = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--color-text-primary); padding-bottom: 1.25rem; margin-bottom: 1.5rem;">
      <div style="font-size: 0.95rem; line-height: 1.5; color: var(--color-text-primary);">
        <h4 style="font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 1.35rem; margin: 0 0 0.4rem 0;">${settings.name || 'IMMOVI S.A.R.L'}</h4>
        <p style="margin: 0; font-weight: 600;">${settings.slogan || 'Agence Immobilière & Syndic de Copropriété'}</p>
        <p style="margin: 0;">${settings.address || 'Rue du Golf, Immeuble Horizon, Bamako, Mali'}</p>
        <p style="margin: 0;">Tél : ${settings.phone || '+223 20 22 44 66'} | E-mail : ${settings.email || 'contact@immovi.ml'}</p>
        ${settings.nif ? `<p style="margin: 0; font-weight: 600; font-size: 0.85rem;">Numéro d'identification fiscale : ${settings.nif}</p>` : ''}
      </div>
      <div style="text-align: right;">
        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem;">
          ${logoHtml}
        </div>
      </div>
    </div>
  `;

  if (globalHeaderContainer) globalHeaderContainer.innerHTML = htmlContent;
  
  if (dynamicReceiptHeader) {
    const whiteContent = htmlContent;
    dynamicReceiptHeader.innerHTML = whiteContent;
  }

  const dynamicStatementHeader = document.getElementById('dynamic-statement-header');
  if (dynamicStatementHeader) {
    dynamicStatementHeader.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--glass-border); padding-bottom: 1.25rem; margin-bottom: 1.5rem;">
        <div>
          <h4 style="font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 1.25rem; color: var(--color-text-primary); margin: 0 0 0.3rem 0;">${settings.name || 'IMMOVI S.A.R.L'}</h4>
          <p style="margin: 0; font-size: 0.8rem; color: var(--color-text-muted);">${settings.slogan || 'Gestion de Portefeuille de Copropriété'}</p>
          <p style="margin: 0; font-size: 0.8rem; color: var(--color-text-muted);">${settings.address || 'Rue du Golf, Bamako, Mali'}</p>
          <p style="margin: 0; font-size: 0.8rem; color: var(--color-text-muted);">Tél : ${settings.phone || '+223 20 22 44 66'} | E-mail : ${settings.email || 'contact@immovi.ml'}</p>
          ${settings.nif ? `<p style="margin: 0; font-size: 0.8rem; color: var(--color-text-muted);">Numéro d'identification fiscale : ${settings.nif}</p>` : ''}
        </div>
        <div style="text-align: right;">
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem; margin-bottom: 0.25rem;">
            ${logoHtml}
          </div>
          <h4 style="font-weight: 700; font-size: 1rem; color: var(--color-primary-hover); margin: 0;">RELEVÉ DE COMPTE BAILLEUR</h4>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.8rem; color: var(--color-text-muted);" id="statement-current-date">${getTodayFrenchDateString()}</p>
        </div>
      </div>
    `;
  }
}

// Exporter les données de l'application au format JSON
function exportAppSaveJSON() {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `immovi_backup_${new Date().toISOString().split('T')[0]}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast('Sauvegarde exportée avec succès.', 'success');
}

// Importer les données de l'application depuis un fichier JSON
function handleImportJSONTrigger() {
  document.getElementById('input-settings-import-file').click();
}

function handleImportJSONFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const importedState = JSON.parse(evt.target.result);
      if (importedState.owners && importedState.properties && importedState.transactions) {
        state = {
          owners: importedState.owners || [],
          properties: importedState.properties || [],
          transactions: importedState.transactions || [],
          staff: importedState.staff || [],
          agencySettings: importedState.agencySettings || {}
        };
        populateDropdowns();
        renderGlobalPrintHeader();
        switchTab('dashboard');
        showToast('Sauvegarde restaurée avec succès. L\'application a été mise à jour.', 'success');
      } else {
        showToast('Fichier invalide : structure Immovi manquante.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de la lecture du fichier JSON.', 'error');
    }
  };
  reader.readAsText(file);
}

// Exposer globalement
window.openOwnerDossier = openOwnerDossier;
window.deleteOwner = deleteOwner;
window.deleteProperty = deleteProperty;
window.deleteTransaction = deleteTransaction;
window.deleteWithdrawalTransaction = deleteWithdrawalTransaction;
window.openTenantDossier = openTenantDossier;
window.toggleStaffStatus = toggleStaffStatus;
window.openEditStaffModal = openEditStaffModal;
window.deleteStaff = deleteStaff;

// ==========================================================================
// Settings Tabs and Theme Management
// ==========================================================================



window.setThemeOption = function(theme) {
  state.agencySettings = state.agencySettings || {};
  state.agencySettings.theme = theme;
  localStorage.setItem('immovi_theme', theme);
  applyThemeUI();
};

function applyThemeUI() {
  const storedTheme = localStorage.getItem('immovi_theme');
  const theme = storedTheme || (state.agencySettings && state.agencySettings.theme ? state.agencySettings.theme : 'dark');
  
  if (theme === 'light') {
    document.documentElement.classList.add('theme-light');
    const cl = document.getElementById('theme-card-light');
    const cd = document.getElementById('theme-card-dark');
    if (cl) cl.style.borderColor = 'var(--color-primary)';
    if (cd) cd.style.borderColor = 'transparent';
  } else {
    document.documentElement.classList.remove('theme-light');
    const cl = document.getElementById('theme-card-light');
    const cd = document.getElementById('theme-card-dark');
    if (cl) cl.style.borderColor = 'transparent';
    if (cd) cd.style.borderColor = 'var(--color-primary)';
  }
}

// ==========================================================================
// Détection et Réduction Automatique des Textes avec Retour à la Ligne (12px)
// ==========================================================================

function adjustWrappedText() {
  const selectors = '.kpi-value, .kpi-label, .card-title, .subtitle, h1, h2, h3, h4, h5, .recent-desc, .recent-amount, .badge, .data-table td, .data-table th, .form-label, .page-title h1, .page-title p, .stat-card, [data-wrap-check]';
  const elements = document.querySelectorAll(selectors);
  
  elements.forEach(el => {
    if (el.children.length > 0 && !el.classList.contains('kpi-value') && !el.classList.contains('card-title') && !el.classList.contains('badge')) {
      return;
    }
    
    el.classList.remove('wrapped-text');
    el.removeAttribute('data-wrapped');
    
    const computedStyle = window.getComputedStyle(el);
    let lineHeight = parseFloat(computedStyle.lineHeight);
    const fontSize = parseFloat(computedStyle.fontSize);
    
    if (isNaN(lineHeight) || lineHeight <= 0) {
      lineHeight = fontSize * 1.25;
    }
    
    const rectHeight = el.getBoundingClientRect().height;
    if (rectHeight > lineHeight * 1.35 && fontSize > 12) {
      el.classList.add('wrapped-text');
      el.setAttribute('data-wrapped', 'true');
    }
  });
}

window.addEventListener('resize', () => requestAnimationFrame(adjustWrappedText));
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(adjustWrappedText, 300);
});

// ==========================================================================
// Génération de Quittances PDF (jsPDF)
// ==========================================================================

async function generateQuittancePDF(transactionId, autoDownload = true) {
  const tx = state.transactions.find(t => t.id === transactionId);
  if (!tx || tx.type !== 'income' || !tx.propertyId) return null;

  const prop = state.properties.find(p => p.id === tx.propertyId);
  if (!prop) return null;

  const tenant = getTenantForProperty(prop.id);
  if (!tenant) return null;

  const owner = state.owners.find(o => o.id === prop.owner_id);

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(30, 58, 138); // Primary color
    doc.text("QUITTANCE DE LOYER", pageWidth / 2, 20, { align: 'center' });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Réf : QTT-${tx.id.substring(3).toUpperCase()}`, pageWidth / 2, 28, { align: 'center' });

    // Logo
    if (state.agencySettings && state.agencySettings.logoBase64) {
      try {
        // Positioned at top left (x=20, y=10)
        doc.addImage(state.agencySettings.logoBase64, 20, 10, 30, 15);
      } catch (err) {
        console.error("Erreur ajout logo au PDF", err);
      }
    }

    // Ligne de séparation
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(20, 35, pageWidth - 20, 35);

    // Bloc Agence / Propriétaire (Gauche)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("Émetteur :", 20, 45);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    
    const agencyName = (state.agencySettings && state.agencySettings.name) ? state.agencySettings.name : "Agence Immovia";
    doc.text(agencyName, 20, 52);
    
    let yPosEmetteur = 58;
    if (state.agencySettings) {
      if (state.agencySettings.address) { doc.text(state.agencySettings.address, 20, yPosEmetteur); yPosEmetteur += 6; }
      if (state.agencySettings.phone) { doc.text(`Tél : ${state.agencySettings.phone}`, 20, yPosEmetteur); yPosEmetteur += 6; }
      if (state.agencySettings.email) { doc.text(`Email : ${state.agencySettings.email}`, 20, yPosEmetteur); yPosEmetteur += 6; }
    } else {
      doc.text("Gestion Immobilière Professionnelle", 20, yPosEmetteur);
      yPosEmetteur += 6;
    }

    if (owner) {
      doc.text(`Pour le compte de : ${owner.name}`, 20, yPosEmetteur);
      yPosEmetteur += 6;
    }

    // Bloc Locataire (Droite)
    const locataireX = pageWidth / 2 + 30;
    doc.setFont("helvetica", "bold");
    doc.text("Locataire :", locataireX, 45);
    
    doc.setFont("helvetica", "normal");
    doc.text(tenant.name || "Locataire Inconnu", locataireX, 52);
    if (tenant.phone) doc.text(`Tél : ${tenant.phone}`, locataireX, 58);
    if (tenant.email) doc.text(`Email : ${tenant.email}`, locataireX, 64);

    // Ligne de séparation
    const lineY = Math.max(yPosEmetteur, 64) + 8;
    doc.line(20, lineY, pageWidth - 20, lineY);

    // Détails de la quittance
    const detailsY = lineY + 15;
    doc.setFontSize(12);
    doc.text(`Reçu de Monsieur / Madame : `, 20, detailsY);
    doc.setFont("helvetica", "bold");
    doc.text(`${tenant.name}`, 80, detailsY);
    
    const safeCurrencyAmount = formatCurrency(tx.amount).replace(/[\u202f\u00a0]/g, ' ');

    doc.setFont("helvetica", "normal");
    doc.text(`La somme de : `, 20, detailsY + 10);
    doc.setFont("helvetica", "bold");
    doc.text(safeCurrencyAmount, 55, detailsY + 10);

    doc.setFont("helvetica", "normal");
    doc.text(`Pour le paiement du loyer concernant le bien :`, 20, detailsY + 20);
    doc.setFont("helvetica", "bold");
    doc.text(`${prop.name} - ${prop.address}`, 20, detailsY + 28);

    doc.setFont("helvetica", "normal");
    doc.text(`Date du paiement : `, 20, detailsY + 40);
    doc.setFont("helvetica", "bold");
    doc.text(`${formatDateString(tx.date)}`, 60, detailsY + 40);

    // Tableau des détails (AutoTable)
    const rowDescription = tx.description ? `Loyer - ${tx.description}` : 'Loyer et charges (selon bail)';
    
    doc.autoTable({
      startY: detailsY + 55,
      head: [['Désignation', 'Période / Date', 'Montant Payé']],
      body: [
        [rowDescription, formatDateString(tx.date), safeCurrencyAmount]
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138], textColor: 255 },
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: {
        0: { cellWidth: 80 },
        2: { halign: 'right', fontStyle: 'bold' }
      }
    });

    const finalY = doc.lastAutoTable.finalY || 180;

    // Mention légale et Signature
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Cette quittance annule tous les reçus qui auraient pu être donnés pour acompte sur le présent terme.", 20, finalY + 15);
    doc.text("Elle doit être conservée pendant une durée de 3 ans.", 20, finalY + 20);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Le Gestionnaire", pageWidth - 50, finalY + 35, { align: 'center' });
    
    // Cachet / Signature (Simulation)
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(1);
    doc.rect(pageWidth - 80, finalY + 45, 60, 25);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(30, 58, 138);
    doc.text("Validé électroniquement", pageWidth - 50, finalY + 60, { align: 'center' });

    // Sauvegarde du fichier
    if (autoDownload) {
      const fileName = `Quittance_Loyer_${tenant.name.replace(/\s+/g, '_')}_${tx.date}.pdf`;
      doc.save(fileName);
      showToast('Quittance PDF générée avec succès.', 'success');
    }
    
    return doc;
  } catch (error) {
    console.error("Erreur lors de la génération PDF:", error);
    showToast("Erreur lors de la création de la quittance.", "error");
    return null;
  }
}


// ==========================================================================
// Rendu : Support Technique
// ==========================================================================

async function renderSupportTickets() {
  const tbody = document.getElementById('tbody-support');
  const emptyState = document.getElementById('empty-support');
  const table = document.getElementById('table-support') ? document.getElementById('table-support').parentElement : null;
  
  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/tickets/', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.ok) {
      const tickets = await res.json();
      
      if (!tickets || tickets.length === 0) {
        if(emptyState) emptyState.style.display = 'block';
        if(table) table.style.display = 'none';
        return;
      }
      
      if(emptyState) emptyState.style.display = 'none';
      if(table) table.style.display = 'table';
      
      if(tbody) {
        tbody.innerHTML = '';
        const sortedTickets = tickets.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        sortedTickets.forEach(ticket => {
          let priorityColor = 'var(--color-text-muted)';
          if (ticket.priority === 'Normale') priorityColor = 'var(--color-blue)';
          if (ticket.priority === 'Haute') priorityColor = 'var(--color-amber)';
          if (ticket.priority === 'Urgente') priorityColor = 'var(--color-rose)';
          
          let statusBadge = '<span class="status-badge bg-green text-green">Ouvert</span>';
          if (ticket.status === 'Fermé') {
            statusBadge = '<span class="status-badge" style="background: rgba(107, 114, 128, 0.1); color: #6b7280;">Fermé</span>';
          } else if (ticket.status === 'En cours') {
            statusBadge = '<span class="status-badge bg-blue text-blue">En cours</span>';
          }
          
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>#${ticket.id}</td>
            <td><strong>${ticket.subject}</strong></td>
            <td>${ticket.category}</td>
            <td><span style="color: ${priorityColor}; font-weight: 500;">${ticket.priority}</span></td>
            <td>${statusBadge}</td>
            <td>${new Date(ticket.date).toLocaleDateString('fr-FR')}</td>
            <td>
              <div class="action-buttons">
                <button class="btn-icon text-rose" title="Fermer le ticket" onclick="closeSupportTicket('${ticket.id}')" ${ticket.status === 'Fermé' ? 'disabled style="opacity: 0.5;"' : ''}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
    }
  } catch (e) {
    console.error("Erreur chargement tickets:", e);
  }
}

async function closeSupportTicket(id) {
  if (confirm("Êtes-vous sûr de vouloir fermer ce ticket ?")) {
    // For now we don't have a close API, but we could add one if needed.
    // We just show a toast for now since backend route doesn't exist yet for closing.
    showToast("La fermeture des tickets sera bientôt disponible", "info");
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const modalTicket = document.getElementById('modal-ticket');
  const btnAddTicket = document.getElementById('btn-add-ticket');
  const btnEmptyAddTicket = document.getElementById('btn-empty-add-ticket');
  const btnCloseTicket = document.getElementById('btn-close-ticket');
  const btnCancelTicket = document.getElementById('btn-cancel-ticket');
  const formTicket = document.getElementById('form-ticket');
  const searchSupport = document.getElementById('search-support');
  
  if (btnAddTicket) btnAddTicket.addEventListener('click', () => modalTicket.classList.add('active'));
  if (btnEmptyAddTicket) btnEmptyAddTicket.addEventListener('click', () => modalTicket.classList.add('active'));
  if (btnCloseTicket) btnCloseTicket.addEventListener('click', () => modalTicket.classList.remove('active'));
  if (btnCancelTicket) btnCancelTicket.addEventListener('click', () => modalTicket.classList.remove('active'));
  
  if (formTicket) {
    formTicket.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newTicket = {
        subject: document.getElementById('ticket-subject').value,
        category: document.getElementById('ticket-category').value,
        priority: document.getElementById('ticket-priority').value,
        message: document.getElementById('ticket-message').value
      };
      
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/tickets/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(newTicket)
        });
        
        if (res.ok) {
          formTicket.reset();
          modalTicket.classList.remove('active');
          if (typeof loadSupportTickets === 'function') {
            loadSupportTickets(); // Reload tickets if function exists
          }
          showToast("Votre ticket a été envoyé au support", "success");
        } else {
          const data = await res.json();
          showToast(data.detail || "Erreur lors de l'envoi du ticket", "error");
        }
      } catch (error) {
        showToast("Erreur de connexion", "error");
      }
    });
  }
  
  if (searchSupport) {
    searchSupport.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const rows = document.querySelectorAll('#tbody-support tr');
      rows.forEach(row => {
        if (row.textContent.toLowerCase().includes(term)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    });
  }
});
