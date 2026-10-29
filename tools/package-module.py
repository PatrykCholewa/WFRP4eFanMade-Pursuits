#!/usr/bin/env python3
"""Validate and package the single integrated Foundry module."""
import json
from pathlib import Path
import subprocess
from zipfile import ZIP_DEFLATED, ZipFile
root = Path(__file__).resolve().parents[1]
m = json.loads((root / 'module.json').read_text())
assert m['id'] == 'wfrp4e-fan-tools'
for name in m['esmodules'] + m['styles']:
    assert (root / name).is_file(), name
for pack in m['packs']:
    assert (root / pack['path'] / 'CURRENT').is_file(), pack['path']
for script in (root / 'scripts').rglob('*.js'):
    subprocess.run(['node', '--check', str(script)], check=True)
out = root / 'dist'; out.mkdir(exist_ok=True)
archive = out / f"{m['id']}-v{m['version']}.zip"
paths = [root/'module.json', root/'LICENSE', root/'README.md']
for folder in ['scripts', 'styles', 'assets', 'packs', 'docs']:
    paths += [p for p in (root/folder).rglob('*') if p.is_file() and p.name != 'LOCK']
with ZipFile(archive, 'w', ZIP_DEFLATED) as z:
    for p in sorted(paths): z.write(p, str(Path(m['id']) / p.relative_to(root)))
with ZipFile(archive) as z:
    assert z.testzip() is None
    assert f"{m['id']}/module.json" in z.namelist()
print(archive)
