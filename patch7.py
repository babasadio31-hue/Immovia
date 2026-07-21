import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update renderPropertiesGrid
pattern1 = r"(let statusColor = 'bar-purple';\s*let alertText = '';\s*)if \(prop\.status === 'LouǸ'\) \{(.*?)\}(.*?)\s*const card = document\.createElement\('div'\);"
replace1 = r"""\1if (prop.transaction_type === 'Vente') {
        if (prop.status === 'Vendu') {
          statusColor = 'bar-purple';
          alertText = '<span class="value-purple" style="font-size: 0.75rem; font-weight: 600;">Vendu</span>';
        } else {
          statusColor = 'bar-blue';
          alertText = '<span class="value-blue" style="font-size: 0.75rem; font-weight: 600;">En vente</span>';
        }
      } else {
        if (prop.status === 'Loué' || prop.status === 'LouǸ') {
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
      
      const card = document.createElement('div');"""

content = re.sub(pattern1, replace1, content, flags=re.DOTALL)

# 2. Update handlePropertySubmit
pattern2 = r"(try \{\s*if \(editId\) \{\s*await API\.updateProperty\(editId, newProp\);\s*document\.getElementById\('input-property-id'\)\.value = '';\s*\} else \{\s*await API\.createProperty\(newProp\);\s*\})(.*?await loadData\(\);)"
replace2 = r"""\1
      
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
            propertyId: newProp.id,
            tenantId: null
          };
          await API.createTransaction(saleTx);
        }
      }\2"""

content = re.sub(pattern2, replace2, content, flags=re.DOTALL)


with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied for Vente features")
