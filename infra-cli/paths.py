#!/usr/bin/env python3
"""
infra-cli/paths.py
Simple helper to store and autoscan projects_root and write environments/projects.auto.tfvars
"""
import json
from pathlib import Path
import os
import sys

CONFIG = Path("infra-cli/paths.json")
TFVARS = Path("environments/projects.auto.tfvars")


def load_config():
    if CONFIG.exists():
        return json.loads(CONFIG.read_text())
    return {}


def save_config(data):
    CONFIG.parent.mkdir(parents=True, exist_ok=True)
    CONFIG.write_text(json.dumps(data, indent=2))


def prompt_projects_root(default="../../projects"):
    cfg = load_config()
    current = cfg.get("projects_root", default)
    try:
        val = input(f"Projects root (relative to repo) [{current}]: ").strip()
    except KeyboardInterrupt:
        print()
        sys.exit(1)
    val = val or current
    cfg["projects_root"] = val
    save_config(cfg)
    TFVARS.parent.mkdir(parents=True, exist_ok=True)
    TFVARS.write_text(f'projects_root = "{val}"\n')
    print(f"Wrote {TFVARS} and infra-cli/paths.json")


def autoscan_and_fill(repo_root="."):
    cfg = load_config()
    candidates = []
    for root, dirs, files in os.walk(repo_root):
        # skip .git, .terraform, node_modules
        if any(part in (".git", ".terraform", "node_modules") for part in Path(root).parts):
            continue
        if Path(root).name.lower() == "projects":
            candidates.append(root)
    if candidates:
        print("Found projects directories:")
        for i, c in enumerate(candidates):
            print(f"{i+1}. {c}")
        choice = input(f"Pick 1-{len(candidates)} or press ENTER to take first: ").strip()
        idx = int(choice)-1 if choice else 0
        chosen = candidates[idx]
        cfg["projects_root"] = os.path.relpath(chosen, start=".")
        save_config(cfg)
        TFVARS.parent.mkdir(parents=True, exist_ok=True)
        TFVARS.write_text(f'projects_root = "{cfg["projects_root"]}"\n')
        print(f"Set projects_root to {cfg['projects_root']}")
    else:
        print("No 'projects' directories found automatically")


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--autoscan", action="store_true")
    p.add_argument("--set", type=str, help="set projects_root value")
    args = p.parse_args()
    if args.autoscan:
        autoscan_and_fill()
    elif args.set:
        cfg = load_config()
        cfg["projects_root"] = args.set
        save_config(cfg)
        TFVARS.parent.mkdir(parents=True, exist_ok=True)
        TFVARS.write_text(f'projects_root = "{args.set}"\n')
        print("Set projects_root")
    else:
        prompt_projects_root()
