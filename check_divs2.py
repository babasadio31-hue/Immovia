with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()
depth = 0
for i, line in enumerate(lines):
    if 'id="settings-general"' in line:
        depth = 1
        print(f'{i+1:4}: {depth} {line.strip()}')
        continue
    if depth > 0:
        opens = line.count('<div')
        closes = line.count('</div')
        if opens > 0 or closes > 0:
            depth += opens - closes
            print(f'{i+1:4}: {depth} {line.strip()}')
        if depth <= 0:
            break
