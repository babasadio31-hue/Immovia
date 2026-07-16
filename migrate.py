import re

with open('d:\\AppImmo\\app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remplacer loadData
content = re.sub(
    r"function loadData\(\) \{.*?\n\}",
    """async function loadData() {
  try {
    const [apiOwners, apiProperties, apiTenants, apiTransactions] = await Promise.all([
      API.getOwners(),
      API.getProperties(),
      API.getTenants(),
      API.getTransactions()
    ]);
    state.owners = apiOwners || [];
    state.properties = apiProperties || [];
    state.transactions = apiTransactions || [];
    state.tenants = apiTenants || [];
    
    const savedState = localStorage.getItem('auraimmo_state');
    if (savedState) {
        const local = JSON.parse(savedState);
        state.staff = local.staff || [];
        state.agencySettings = local.agencySettings || {};
    } else {
        state.staff = [];
        state.agencySettings = {};
    }
  } catch (e) {
    console.error("Erreur API:", e);
  }
}""",
    content,
    flags=re.DOTALL
)

# 2. Remplacer saveData
content = re.sub(
    r"function saveData\(\) \{\n  localStorage\.setItem\('auraimmo_state', JSON\.stringify\(state\)\);\n\}",
    "function saveData() { /* API persistance used instead */ }",
    content
)

# 3. Remplacer initApp call
content = content.replace("initApp();", """async function startApp() {
  const token = getAuthToken();
  if (!token) {
    window.location.href = 'login.html';
    return;
  }
  await loadData();
  // Call the original initApp logic synchronously now that data is loaded
  initApp();
}
startApp();""")

# 4. Save Owner
content = content.replace(
    "state.owners.push(newOwner);\n    showToast('Bailleur ajouté avec succès', 'success');",
    "API.createOwner(newOwner).then(res => { state.owners.push(res); showToast('Bailleur ajouté avec succès', 'success'); renderOwners(); }).catch(e => showToast(e.message, 'error'));"
)
content = content.replace(
    "Object.assign(owner, newOwner);\n    showToast('Bailleur mis à jour avec succès', 'success');",
    "API.updateOwner(editingOwnerId, newOwner).then(res => { Object.assign(owner, res); showToast('Bailleur mis à jour avec succès', 'success'); renderOwners(); populateDropdowns(); }).catch(e => showToast(e.message, 'error'));"
)

# 5. Delete Owner
content = content.replace(
    "state.owners = state.owners.filter(o => o.id !== id);\n    saveData();\n    renderOwners();",
    "API.deleteOwner(id).then(() => { state.owners = state.owners.filter(o => o.id !== id); renderOwners(); }).catch(e => showToast(e.message, 'error'));"
)

# 6. Save Property
content = content.replace(
    "state.properties.push(newProp);\n    showToast('Bien ajouté avec succès', 'success');",
    "API.createProperty(newProp).then(res => { state.properties.push(res); showToast('Bien ajouté avec succès', 'success'); renderProperties(); }).catch(e => showToast(e.message, 'error'));"
)
content = content.replace(
    "Object.assign(prop, newProp);\n    showToast('Bien mis à jour avec succès', 'success');",
    "API.updateProperty(editingPropertyId, newProp).then(res => { Object.assign(prop, res); showToast('Bien mis à jour avec succès', 'success'); renderProperties(); }).catch(e => showToast(e.message, 'error'));"
)

# 7. Delete Property
content = content.replace(
    "state.properties = state.properties.filter(p => p.id !== id);\n    saveData();\n    renderProperties();",
    "API.deleteProperty(id).then(() => { state.properties = state.properties.filter(p => p.id !== id); renderProperties(); }).catch(e => showToast(e.message, 'error'));"
)

# 8. Save Tenant
content = content.replace(
    "state.tenants.push(newTenant);\n    showToast('Locataire ajouté avec succès', 'success');",
    "API.createTenant(newTenant).then(res => { state.tenants.push(res); showToast('Locataire ajouté avec succès', 'success'); renderTenants(); }).catch(e => showToast(e.message, 'error'));"
)
content = content.replace(
    "Object.assign(tenant, newTenant);\n    showToast('Locataire mis à jour avec succès', 'success');",
    "API.updateTenant(editingTenantId, newTenant).then(res => { Object.assign(tenant, res); showToast('Locataire mis à jour avec succès', 'success'); renderTenants(); }).catch(e => showToast(e.message, 'error'));"
)

# 9. Save Transaction
content = content.replace(
    "state.transactions.push(newTx);\n    showToast('Transaction enregistrée avec succès', 'success');",
    "API.createTransaction(newTx).then(res => { state.transactions.push(res); showToast('Transaction enregistrée avec succès', 'success'); renderTransactions(); }).catch(e => showToast(e.message, 'error'));"
)
content = content.replace(
    "Object.assign(tx, newTx);\n    showToast('Transaction mise à jour avec succès', 'success');",
    "API.updateTransaction(editingTransactionId, newTx).then(res => { Object.assign(tx, res); showToast('Transaction mise à jour avec succès', 'success'); renderTransactions(); }).catch(e => showToast(e.message, 'error'));"
)

# 10. Delete Transaction
content = content.replace(
    "state.transactions = state.transactions.filter(t => t.id !== id);\n    saveData();\n    renderTransactions();",
    "API.deleteTransaction(id).then(() => { state.transactions = state.transactions.filter(t => t.id !== id); renderTransactions(); }).catch(e => showToast(e.message, 'error'));"
)

# Remove the internal saveData calls that are no longer strictly needed but keeping them as empty is fine too.
# The previous string replacements added API calls asynchronously, but they left the `saveData();` call right after the `if/else`.
# Actually, since saveData is empty, it's fine. 

# Replace initApp() call to loadData() with nothing since startApp() does it.
content = content.replace("function initApp() {\n  loadData();", "function initApp() {")

# Remove mock data injection
content = content.replace("""if (state.owners.length === 0 || state.properties.length === 0) {
    loadMockData();
    saveData();
  }""", "")

with open('d:\\AppImmo\\app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Migration de app.js terminée avec succès !")
