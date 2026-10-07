"""Build a UTF-8 CSV index from the researched candidate sections."""
from pathlib import Path
import csv
import re

root = Path(__file__).resolve().parent
text = (root / 'research.md').read_text(encoding='utf-8')
sections = re.findall(r'^### (A\d{2})\. ([^\n]+)\n(.*?)(?=^### |^## |\Z)', text, re.M | re.S)
assert len(sections) == 24
assert [key for key, _, _ in sections] == [f'A{i:02d}' for i in range(1, 25)]
with (root / 'catalog.csv').open('w', encoding='utf-8-sig', newline='') as file:
    writer = csv.writer(file)
    writer.writerow(['id', 'effect', 'group', 'description', 'implementation_proposal', 'source_urls', 'status'])
    for key, title, body in sections:
        number = int(key[1:])
        group = '캐릭터·소품' if number <= 7 else '지속 효과·표면' if number <= 12 else '환경·공간' if number <= 18 else '색·카메라·UI'
        paragraphs = [p.strip() for p in body.strip().split('\n\n')]
        urls = re.findall(r'\]\((https?://[^)]+)\)', body)
        writer.writerow([key, title, group, paragraphs[0], '\n'.join(paragraphs[1:]), ' | '.join(urls), '조사 완료 / 구현·실행 검증 전'])
print(f'catalog.csv: {len(sections)} candidates; unique sequential IDs verified')
