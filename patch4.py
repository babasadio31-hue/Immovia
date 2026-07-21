import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. recentWithdrawals
# Old: const recentWithdrawals = state.transactions.filter(t => \n      t.type === 'expense' && \n      ownerPropIds.includes(t.propertyId) && \n      (t.description.includes('Reversement') || t.description.includes('Retrait')) &&
pattern1 = r"const recentWithdrawals = state\.transactions\.filter\(t =>\s*t\.type === 'expense' &&\s*ownerPropIds\.includes\(t\.propertyId\) &&\s*\(t\.description\.includes\('Reversement'\) \|\| t\.description\.includes\('Retrait'\)\) &&"
replace1 = "const recentWithdrawals = state.transactions.filter(t => \n      t.type === 'expense' && \n      ownerPropIds.includes(t.propertyId) && "
content = re.sub(pattern1, replace1, content)

# 2. ownerWithdrawals (there are multiple, so we can use a more generic match)
pattern2 = r"const ownerWithdrawals = state\.transactions\.filter\(t =>\s*t\.type === 'expense' &&\s*ownerPropIds\.includes\(t\.propertyId\) &&\s*\(t\.description\.includes\('Reversement'\) \|\| t\.description\.includes\('Retrait'\)\)\s*\);"
replace2 = "const ownerWithdrawals = state.transactions.filter(t => \n        t.type === 'expense' && \n        ownerPropIds.includes(t.propertyId)\n      );"
content = re.sub(pattern2, replace2, content)

# 3. renderAccounting grossOutflows
pattern3 = r"\} else \{\s*const isOwnerWithdrawal = \(tx\.description\.includes\('Reversement'\) \|\| tx\.description\.includes\('Retrait'\)\);\s*if \(!isOwnerWithdrawal\) \{\s*grossOutflows \+= tx\.amount;\s*\}"
replace3 = "} else {\n        const isOwnerExpense = !!tx.propertyId;\n        \n        if (!isOwnerExpense) {\n          grossOutflows += tx.amount;\n        }"
content = re.sub(pattern3, replace3, content)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Regex patch applied")
