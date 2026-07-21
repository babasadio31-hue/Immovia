import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace condition in recentWithdrawals (openOwnerDossier)
old1 = """const recentWithdrawals = state.transactions.filter(t => 
      t.type === 'expense' && 
      ownerPropIds.includes(t.propertyId) && 
      (t.description.includes('Reversement') || t.description.includes('Retrait')) &&
      (new Date() - new Date(t.date)) / (1000 * 60 * 60 * 24) <= 9
    );"""
new1 = """const recentWithdrawals = state.transactions.filter(t => 
      t.type === 'expense' && 
      ownerPropIds.includes(t.propertyId) && 
      (new Date() - new Date(t.date)) / (1000 * 60 * 60 * 24) <= 9
    );"""
content = content.replace(old1, new1)

# Replace condition in ownerWithdrawals (openOwnerDossier - list)
old2 = """const ownerWithdrawals = state.transactions.filter(t => 
        t.type === 'expense' && 
        ownerPropIds.includes(t.propertyId) && 
        (t.description.includes('Reversement') || t.description.includes('Retrait'))
      );"""
new2 = """const ownerWithdrawals = state.transactions.filter(t => 
        t.type === 'expense' && 
        ownerPropIds.includes(t.propertyId)
      );"""
content = content.replace(old2, new2)

# Replace condition in ownerWithdrawals (openOwnerStatement)
old3 = """const ownerWithdrawals = state.transactions.filter(t => 
        t.type === 'expense' && 
        ownerPropIds.includes(t.propertyId) && 
        (t.description.includes('Reversement') || t.description.includes('Retrait'))
      );"""
new3 = """const ownerWithdrawals = state.transactions.filter(t => 
        t.type === 'expense' && 
        ownerPropIds.includes(t.propertyId)
      );"""
content = content.replace(old3, new3)

# Replace condition in renderAccounting
old4 = """      } else {
        const isOwnerWithdrawal = (tx.description.includes('Reversement') || tx.description.includes('Retrait'));
        
        if (!isOwnerWithdrawal) {
          grossOutflows += tx.amount;
        }"""
new4 = """      } else {
        const isOwnerExpense = !!tx.propertyId;
        
        if (!isOwnerExpense) {
          grossOutflows += tx.amount;
        }"""
content = content.replace(old4, new4)

# Replace condition in handleWithdrawalSubmit
old5 = """const recentWithdrawals = state.transactions.filter(t => 
      t.type === 'expense' && 
      ownerPropIds.includes(t.propertyId) && 
      (t.description.includes('Reversement') || t.description.includes('Retrait')) &&
      (new Date() - new Date(t.date)) / (1000 * 60 * 60 * 24) <= 9
    );"""
new5 = """const recentWithdrawals = state.transactions.filter(t => 
      t.type === 'expense' && 
      ownerPropIds.includes(t.propertyId) && 
      (new Date() - new Date(t.date)) / (1000 * 60 * 60 * 24) <= 9
    );"""
content = content.replace(old5, new5)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied")
