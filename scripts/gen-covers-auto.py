# -*- coding: utf-8 -*-
# Авто-обложки: для каждой статьи course/articles/*.md БЕЗ public/articles/img/cover-<slug>.svg
# строит фирменную SVG из frontmatter (title -> 2 строки, excerpt -> 2 подстроки, цвет по хэшу слага).
# Ручные обложки (gen-covers.py / -batch1.py) не трогает. Запуск: python scripts/gen-covers-auto.py
import os, re, hashlib

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(BASE, 'public', 'articles', 'img')
ART = os.path.join(BASE, 'course', 'articles')

PALETTE = ['#6E63E8', '#4C9BE8', '#28c840', '#E8A44C', '#E85DA6', '#4CE8B0', '#A44CE8', '#E8804C', '#4CB8E8', '#E8C84C', '#E85D7A', '#4CE88A']

SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 480" font-family="'Manrope','Segoe UI',Arial,sans-serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#211C2E"/><stop offset="1" stop-color="#171320"/></linearGradient>
    <radialGradient id="glow" cx="80%" cy="30%" r="58%"><stop offset="0" stop-color="{acc}" stop-opacity="0.30"/><stop offset="1" stop-color="{acc}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#bg)"/><rect width="1200" height="480" fill="url(#glow)"/>
  <g transform="translate(900,150)" fill="none" stroke="{acc}" stroke-width="9" stroke-linecap="round" opacity="0.9">
    <circle cx="90" cy="90" r="70" stroke-opacity="0.35"/>
    <circle cx="90" cy="90" r="44"/>
    <circle cx="90" cy="90" r="12" fill="{acc}" stroke="none"/>
    <line x1="90" y1="4" x2="90" y2="34"/><line x1="90" y1="146" x2="90" y2="176"/>
    <line x1="4" y1="90" x2="34" y2="90"/><line x1="146" y1="90" x2="176" y2="90"/>
  </g>
  <text x="70" y="150" font-size="13" font-weight="800" letter-spacing="3" fill="{acc}">{kicker} · SKILLMAKE</text>
  <text x="68" y="232" font-size="{fs}" font-weight="800" fill="#FBF8F2" font-family="'Playfair Display',Georgia,serif">{l1}</text>
  <text x="68" y="298" font-size="{fs}" font-weight="800" fill="{acc}" font-family="'Playfair Display',Georgia,serif">{l2}</text>
  <rect x="70" y="324" width="110" height="5" rx="2.5" fill="{acc}"/>
  <text x="70" y="372" font-size="21" fill="#c7c0db">{s1}</text>
  <text x="70" y="404" font-size="21" fill="#c7c0db">{s2}</text>
</svg>
'''

def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def two_lines(text, limit):
    """Режем текст на 2 строки по словам, каждая ~limit символов; хвост — многоточие."""
    words, lines, cur = text.split(), [], ''
    for w in words:
        if len(cur) + len(w) + 1 <= limit or not cur:
            cur = (cur + ' ' + w).strip()
        else:
            lines.append(cur)
            cur = w
            if len(lines) == 2:
                break
    if len(lines) < 2 and cur:
        lines.append(cur)
    if len(lines) == 2 and (cur not in lines and cur):
        lines[1] = lines[1].rstrip('.,:') + '…'
    while len(lines) < 2:
        lines.append('')
    return lines[0], lines[1]

made = 0
for f in sorted(os.listdir(ART)):
    if not f.endswith('.md') or re.match(r'^[А-ЯЁ]', f):
        continue
    slug = f[:-3]
    svg_path = os.path.join(IMG, 'cover-%s.svg' % slug)
    if os.path.exists(svg_path):
        continue
    raw = open(os.path.join(ART, f), encoding='utf-8').read()
    m = re.search(r'^---\s*(.*?)\s*---', raw, re.S)
    fm = dict()
    if m:
        for line in m.group(1).split('\n'):
            i = line.find(':')
            if i > 0:
                fm[line[:i].strip()] = line[i + 1:].strip()
    title = fm.get('title', slug)
    # короткая форма для обложки: до двоеточия/тире, если она осмысленная
    short = re.split(r'\s+[—–-]\s+|:\s+', title)[0].strip()
    if len(short) < 12:
        short = title
    l1, l2 = two_lines(short, 16)
    fs = 60 if max(len(l1), len(l2)) <= 15 else (48 if max(len(l1), len(l2)) <= 20 else 40)
    s1, s2 = two_lines(fm.get('excerpt', '')[:110], 36)
    tag = fm.get('tag', 'Объяснялка').upper()
    acc = PALETTE[int(hashlib.md5(slug.encode()).hexdigest(), 16) % len(PALETTE)]
    svg = SVG.format(acc=acc, kicker=esc(tag), fs=fs, l1=esc(l1), l2=esc(l2), s1=esc(s1), s2=esc(s2))
    with open(svg_path, 'w', encoding='utf-8') as out:
        out.write(svg)
    made += 1
    print('cover:', slug)
print('auto-covers:', made)
