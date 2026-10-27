#!/usr/bin/env python3
"""Package only the standalone audio module; leave the chase release alone."""
import json
from pathlib import Path
import subprocess
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
source = root / "modules" / "shared-timeline-audio"
manifest = json.loads((source / "module.json").read_text(encoding="utf-8"))
assert manifest["id"] == "shared-timeline-audio"
for relative in manifest["esmodules"] + manifest["styles"] + [manifest["readme"], manifest["license"]]:
    if not (source / relative).is_file():
        raise SystemExit(f"Missing module resource: {relative}")
for script in source.rglob("*.js"):
    subprocess.run(["node", "--check", str(script)], check=True)
destination = root / "dist"
destination.mkdir(exist_ok=True)
archive = destination / f"{manifest['id']}-v{manifest['version']}.zip"
with ZipFile(archive, "w", ZIP_DEFLATED) as package:
    for file in sorted(source.rglob("*")):
        if file.is_file() and not any(part in {"node_modules", "__pycache__"} for part in file.relative_to(source).parts):
            package.write(file, file.relative_to(source.parent))
with ZipFile(archive) as package:
    assert package.testzip() is None
    assert "shared-timeline-audio/module.json" in package.namelist()
    assert all(name.startswith("shared-timeline-audio/") for name in package.namelist())
print(f"Created {archive} ({archive.stat().st_size} bytes)")
