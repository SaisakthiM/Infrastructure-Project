#!/usr/bin/env python3
"""
infra-cli/tui_show_missing.py
Small TUI using rich to show missing paths in red.
"""
import json
from pathlib import Path
from rich.console import Console
from rich.table import Table

console = Console()

p = Path("infra-cli/missing_paths.json")
if not p.exists():
    console.print("No missing_paths.json found. Run infra-cli/check_paths.py first.", style="yellow")
    raise SystemExit(1)

data = json.loads(p.read_text())
missing = data.get("missing", [])

if not missing:
    console.print("No missing paths — all good!", style="green")
    raise SystemExit(0)

table = Table(show_header=True, header_style="bold red")
table.add_column("Reference")
table.add_column("Expected Path")
table.add_column("Source File")
for m in missing:
    table.add_row(f"[red]{m['ref']}[/red]", f"[red]{m['expected']}[/red]", f"[red]{m['file']}[/red]")

console.print(table)
