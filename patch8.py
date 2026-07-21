import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r"(let statusColor = 'bar-purple';\s*let alertText = '';\s*)if \(prop\.status === 'Loué'\) \{(.*?)\}(.*?)\s*const card = document\.createElement\('div'\);"
replace = r"""\1if (prop.transaction_type === 'Vente') {
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
  
      const card = document.createElement('div');"""

content = re.sub(pattern, replace, content, flags=re.DOTALL)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("UI Vente patch applied")
