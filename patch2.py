import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace handleSaveReceipt
old_str1 = """    if (savedCount > 0) {
      await loadData();
      calculateKPIs(); // Mettre à jour les compteurs du dashboard"""
new_str1 = """    if (savedCount > 0) {
      await loadData();
      renderAccounting();
      renderDashboard(); // Mettre à jour les compteurs du dashboard"""
content = content.replace(old_str1, new_str1)

# Replace handleWithdrawalSubmit
old_str2 = """    await API.createTransaction(newWithdrawal);
    await loadData();
    
    document.getElementById('modal-withdrawal').classList.remove('active');"""
new_str2 = """    await API.createTransaction(newWithdrawal);
    await loadData();
    renderAccounting();
    renderDashboard();
    
    document.getElementById('modal-withdrawal').classList.remove('active');"""
content = content.replace(old_str2, new_str2)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied successfully.")
