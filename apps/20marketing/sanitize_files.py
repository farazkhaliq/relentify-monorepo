import os
import re

files = [
    '/opt/relentify-com2/app/pages/Home.tsx',
    '/opt/relentify-com2/app/pages/Accounting.tsx',
    '/opt/relentify-com2/app/pages/CRM.tsx',
    '/opt/relentify-com2/app/pages/ESign.tsx',
    '/opt/relentify-com2/app/pages/Payroll.tsx',
    '/opt/relentify-com2/app/pages/Inventory.tsx',
    '/opt/relentify-com2/app/pages/Timesheets.tsx',
    '/opt/relentify-com2/app/pages/Blog.tsx',
    '/opt/relentify-com2/app/pages/Websites.tsx',
]

# Add alternatives/*.tsx
alternatives_dir = '/opt/relentify-com2/app/pages/alternatives'
for f in os.listdir(alternatives_dir):
    if f.endswith('.tsx'):
        files.append(os.path.join(alternatives_dir, f))

replacements = [
    # Rule 2: Special cases for black/5
    (r'\bbg-black/5\b', 'bg-[var(--theme-border)]'),
    (r'\bborder-black/5\b', 'border-[var(--theme-border)]'),
    
    # Rule 3, 4: Specific text opacities (60, 40)
    (r'\btext-black/60\b', 'text-[var(--theme-text-muted)]'),
    (r'\btext-black/40\b', 'text-[var(--theme-text-dim)]'),
    (r'\btext-white/60\b', 'text-[var(--theme-text-muted)]'),
    (r'\btext-white/40\b', 'text-[var(--theme-text-dim)]'),
    
    # Rule 5: Pure black
    (r'\bbg-black\b', 'bg-[var(--theme-dark)]'),
    (r'\btext-black\b', 'text-[var(--theme-text)]'),
    
    # Rule 6 & 7: Other black opacities and colors
    (r'\bbg-black/(\d+)\b', r'bg-[var(--theme-dark)]/\1'),
    (r'\bborder-black/(\d+)\b', r'border-[var(--theme-border)]/\1'),
    (r'\btext-black/(\d+)\b', r'text-[var(--theme-text)]/\1'),
    (r'\bvia-black/(\d+)\b', r'via-[var(--theme-dark)]/\1'),
    (r'\bfrom-black/(\d+)\b', r'from-[var(--theme-dark)]/\1'),
    (r'\bto-black/(\d+)\b', r'to-[var(--theme-dark)]/\1'),
    (r'\bborder-black\b', 'border-[var(--theme-dark)]'),

    # Rule 6 & 7: White opacities and colors
    (r'\bbg-white/(\d+)\b', r'bg-[var(--theme-card)]/\1'),
    (r'\bborder-white/(\d+)\b', r'border-[var(--theme-card)]/\1'),
    (r'\btext-white/(\d+)\b', r'text-[var(--theme-text)]/\1'),
    (r'\bborder-white\b', 'border-[var(--theme-card)]'),
    
    # Theme text-white for dark mode
    (r'\bdark:text-white\b', 'dark:text-[var(--theme-text)]'),
]

def process_file(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # All remaining bg-white -> bg-[var(--theme-card)]
    # We do this first so it doesn't match bg-white/XX later if we were not careful
    content = re.sub(r'\bbg-white\b', 'bg-[var(--theme-card)]', content)
    
    # Perform all other replacements
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)
    
    with open(file_path, 'w') as f:
        f.write(content)

for f in files:
    if os.path.exists(f):
        process_file(f)
