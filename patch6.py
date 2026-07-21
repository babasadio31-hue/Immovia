import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r"document\.getElementById\('btn-clear-fonds'\)\.addEventListener\('click', \(\) => \{\s*showCustomConfirm\(.*?\}\);\s*\}\);"

new_fonds = """document.getElementById('btn-clear-fonds').addEventListener('click', () => {
      showCustomConfirm("Voulez-vous supprimer définitivement l'historique des retraits et dépenses de ce bailleur ? Cette action est irréversible.").then(async confirmed => {
        if (confirmed) {
          const ownerProperties = state.properties.filter(p => p.ownerId === state.activeOwnerId);
          const ownerPropIds = ownerProperties.map(p => p.id);
          const txToDelete = state.transactions.filter(tx => tx.type === 'expense' && ownerPropIds.includes(tx.propertyId));
          await Promise.all(txToDelete.map(tx => API.deleteTransaction(tx.id)));
          state.transactions = state.transactions.filter(tx => !(tx.type === 'expense' && ownerPropIds.includes(tx.propertyId)));
          saveData();
          renderAccounting();
          renderDashboard();
          openOwnerDossier(state.activeOwnerId); 
          showToast("L'historique des retraits du bailleur a été définitivement supprimé.", "success");
        }
      });
    });"""

content = re.sub(pattern, new_fonds, content, flags=re.DOTALL)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("regex sub done")
