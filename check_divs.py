with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()
depth = 0
for i, line in enumerate(lines):
    if 'id="settings-general"' in line:
        print(f'Found settings-general at {i+1}')
        depth = 1
        continue
    if depth > 0:
        depth += line.count('<div') - line.count('</div')
        if depth <= 0:
            print(f'settings-general CLOSED at {i+1}')
            break
