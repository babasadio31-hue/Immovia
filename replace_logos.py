import glob

for filepath in glob.glob('d:/AppImmo/*.html'):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace the text logo with image logo
    content = content.replace('<div class="logo-icon">A</div>', '<img src="assets/logo.png" alt="Immovi Logo" style="height: 40px;">')
    content = content.replace('<div class="logo-text">Immovi</div>', '')
    content = content.replace('<h1 class="logo-text" id="logo-title">Immovi</h1>', '<img src="assets/logo.png" alt="Immovi Logo" style="height: 60px; margin-bottom: 1rem;">')
    content = content.replace('<h2 style="font-family: \'Outfit\', sans-serif; font-size: 1.5rem; font-weight: 800; color: white;">Immovi</h2>', '<img src="assets/logo.png" alt="Immovi Logo" style="height: 40px;">')
    
    # Replace the footer/header white text logo
    content = content.replace('<div class="logo-icon" style="color: white; border-color: white;">A</div>', '<img src="assets/logo.png" alt="Immovi Logo" style="height: 40px;">')
    content = content.replace('<div class="logo-text" style="color: white;">Immovi</div>', '')
    
    # Also add the favicon if not present
    if '<link rel="icon"' not in content:
        content = content.replace('</head>', '  <link rel="icon" href="assets/favicon.png" type="image/png">\n</head>')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Replacement complete.")
