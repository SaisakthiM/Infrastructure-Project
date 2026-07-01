#!/usr/bin/env python3
"""
infra-cli/check_paths.py
Scans environments/*.tf* for references to ${path.module}/${var.projects_root}/... and reports missing targets.
"""
import re
import json
from pathlib import Path

REF_PATTERN = re.compile(r"\$\{path\.module\}/\$\{var\.projects_root\}/([^\)\"']+)")


def find_references(root="environments"):
    refs = []
    for p in Path(root).rglob("*.tf*"):
        try:
            content = p.read_text()
        except Exception:
            continue
        for m in REF_PATTERN.finditer(content):
            rel = m.group(1).strip()
            refs.append({"file": str(p), "ref": rel})
    return refs


def check_exists(refs, projects_root):
    missing = []
    present = []
    for r in refs:
        candidate = Path(projects_root) / r["ref"]
        if candidate.exists():
            present.append({"ref": r["ref"], "path": str(candidate), "file": r["file"]})
        else:
            missing.append({"ref": r["ref"], "expected": str(candidate), "file": r["file"]})
    return present, missing


if __name__ == "__main__":
    cfg = {}
    cfgp = Path("infra-cli/paths.json")
    if cfgp.exists():
        cfg = json.loads(cfgp.read_text())
    projects_root = cfg.get("projects_root", "../../projects")
    refs = find_references()
    present, missing = check_exists(refs, projects_root)
    report = {"present": present, "missing": missing}
    out = Path("infra-cli/missing_paths.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2))
    print(f"Found {len(present)} present and {len(missing)} missing references. Report written to {out}")
