# -*- coding: utf-8 -*-
"""order.md タスク3・4用の生成スクリプト。
 3) pokemon/{mega,attacker,defensive}.md を読み、`- 技` 箇条書きを `技 / 技` 形式に
    変換して data-owned.js の OWNED_MD_TEXT を再生成。
 4) pokemon/Box Data Dump.csv をポケソルテキストに変換して pokemon/box-pokesol.md へ出力。
"""
import csv, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POKE = os.path.join(ROOT, 'pokemon')
WEBAPP = os.path.join(ROOT, 'web-app')

FIELD_PREFIXES = ('テラスタイプ:', '特性:', '性格:')

def parse_md(path):
    """md を pokesol ブロック(dict)のリストに。moves は `/` 連結済み文字列。"""
    with open(path, encoding='utf-8-sig') as f:
        text = f.read().lstrip('﻿')
    blocks = re.split(r'\n[ \t]*\n+', text)
    out = []
    for raw in blocks:
        lines = [l.strip() for l in raw.strip().split('\n') if l.strip()]
        if not lines:
            continue
        head = lines[0]
        if head.startswith('#') or head.startswith('>'):
            continue
        # 個体先頭行は「名前」or「名前 @ アイテム」
        body, moves = [], []
        body.append(head)
        for ln in lines[1:]:
            if ln.startswith('- '):
                mv = ln[2:].strip()
                if mv and mv != '-':
                    moves.append(mv)
            elif ln == '-':
                continue
            elif ln.startswith(FIELD_PREFIXES) or re.match(r'^\d', ln):
                body.append(ln)
            else:
                # 箇条書きでない技行（例: メタモンの「へんしん」）
                if '/' in ln:
                    moves.extend(m.strip() for m in ln.split('/') if m.strip() and m.strip() != '-')
                else:
                    moves.append(ln)
        if moves:
            body.append(' / '.join(moves))
        out.append('\n'.join(body))
    return out


def gen_owned():
    parts = []
    for fn in ('mega.md', 'attacker.md', 'defensive.md'):
        parts.extend(parse_md(os.path.join(POKE, fn)))
    text = '\n\n'.join(parts)
    js = ('// data-owned.js — 所持個体（頻繁に編集するデータ）\n'
          '// pokemon/{mega,attacker,defensive}.md から自動生成（tools/gen_owned_and_box.py）\n'
          'window._PCR = window._PCR || {}\n'
          'window._PCR.OWNED_MD_TEXT = `\n' + text + '\n`\n')
    with open(os.path.join(WEBAPP, 'data-owned.js'), 'w', encoding='utf-8', newline='') as f:
        f.write(js)
    print(f'data-owned.js: {len(parts)} 個体')


def gen_box():
    src = os.path.join(POKE, 'Box Data Dump.csv')
    EV_IDX = [37, 38, 39, 40, 41, 42]   # EV_HP..EV_SPE（36=Level の次）
    ST_IDX = [13, 14, 15, 16, 17, 18]   # HP,ATK,DEF,SPA,SPD,SPE 実数値
    blocks = []
    n = 0
    with open(src, encoding='utf-8-sig', newline='') as f:
        reader = csv.reader(f)
        header = next(reader)
        for row in reader:
            if len(row) < 43:
                continue
            species = row[2].strip()
            if not species or species == '(なし)':
                continue
            nature = row[3].strip()
            ability = row[7].strip()
            item = row[12].strip()
            moves = [row[i].strip() for i in (8, 9, 10, 11)]
            moves = [m for m in moves if m and m != '(なし)']
            stats = []
            for st, ev in zip(ST_IDX, EV_IDX):
                val = row[st].strip()
                e = row[ev].strip()
                try:
                    ei = int(e)
                except ValueError:
                    ei = 0
                stats.append(f'{val}({ei})' if ei > 0 else f'{val}')
            head = f'{species} @ {item}' if (item and item != '(なし)') else species
            lines = [head]
            if ability and ability != '(なし)':
                lines.append(f'特性: {ability}')
            if nature and nature != '(なし)':
                lines.append(f'性格: {nature}')
            lines.append('-'.join(stats))
            if moves:
                lines.append(' / '.join(moves))
            blocks.append('\n'.join(lines))
            n += 1
    body = '\n\n'.join(blocks)
    md = ('# Box Data Dump → ポケソルテキスト\n\n'
          '> Box Data Dump.csv から自動変換（tools/gen_owned_and_box.py）\n'
          '> テラスタイプはCSVに無いため省略。努力値は従来式(0〜252)表記。\n\n'
          + body + '\n')
    with open(os.path.join(POKE, 'box-pokesol.md'), 'w', encoding='utf-8', newline='') as f:
        f.write(md)
    print(f'box-pokesol.md: {n} 個体')


if __name__ == '__main__':
    gen_owned()
    gen_box()
