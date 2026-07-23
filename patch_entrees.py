import re

with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Extract the print-sorties-active block
# We know it starts at line 1577 and ends around line 1639 before the Tenant Dossier
start_idx = css.find('/* Sorties Printing Configuration */')
end_idx = css.find('/* Tenant Dossier Printing Configuration */')

if start_idx != -1 and end_idx != -1:
    sorties_block = css[start_idx:end_idx]
    entrees_block = sorties_block.replace('print-sorties-active', 'print-entrees-active')
    entrees_block = entrees_block.replace('panel-accounting-entrées', 'TEMP_PANEL')
    entrees_block = entrees_block.replace('panel-accounting-sorties', 'panel-accounting-entrées')
    entrees_block = entrees_block.replace('TEMP_PANEL', 'panel-accounting-sorties')
    entrees_block = entrees_block.replace('Sorties Printing Configuration', 'Entrées Printing Configuration')
    
    new_css = css[:end_idx] + entrees_block + '\n' + css[end_idx:]
    with open('style.css', 'w', encoding='utf-8') as f:
        f.write(new_css)
    print("style.css updated!")

# Update app.js
with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

btn_js = """
  const btnPrintEntrees = document.getElementById('btn-print-entrees');
  if (btnPrintEntrees) {
    btnPrintEntrees.addEventListener('click', () => {
      document.body.classList.add('print-entrees-active');
      window.print();
      document.body.classList.remove('print-entrees-active');
    });
  }
"""
if 'btn-print-entrees' not in js:
    insert_pos = js.find("const btnPrintSorties = document.getElementById('btn-print-sorties');")
    if insert_pos != -1:
        new_js = js[:insert_pos] + btn_js + '\n  ' + js[insert_pos:]
        with open('app.js', 'w', encoding='utf-8') as f:
            f.write(new_js)
        print("app.js updated!")
