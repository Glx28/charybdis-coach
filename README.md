# Charybdis Coach

Browser-based interactive keyboard layout coach for the Charybdis split keyboard. Visualizes all keys from the current layout CSV, detects dynamic layer roles from the actual bindings, tracks live layer state, and provides per-app workflow guides.

Part of the [Charybdis Keyboard System](https://github.com/Glx28/charybdis-tools#readme) — see the parent README for full setup and how data flows between repos.

## Quick Start

```powershell
# Option 1: Via the tools launcher (also starts beacon for live layer tracking)
powershell -ExecutionPolicy Bypass -File ..\charybdis-tools\powershell\start_charybdis_coach.ps1

# Option 2: Direct (no live layer sync)
cd charybdis-coach
python -m http.server 8765
# Open http://127.0.0.1:8765/
```

## Fresh Setup

See [charybdis-tools bootstrap](https://github.com/Glx28/charybdis-tools) for one-command setup of all repos.

## What's Here

```
index.html          # Single-page app entry
app.js              # Main app — layer tracking, key inspector, practice modes, workflow guide
styles.css          # Styling

data/               # Synced from the active layout export
  keybindings_explained.csv     # All key positions/layers exported from the current layout
  layout_spec.json              # Physical key positions and layer descriptions
  charybdis_apps.json           # App shortcut definitions
  windows_norwegian_host.json   # Scancode-to-glyph mapping for Norwegian Windows

workflows/          # Per-app shortcut guides (JSON)
  browser.json, vscode.json, excel.json, teams.json, outlook.json,
  explorer.json, discord.json, slack.json, mfiles.json, ...
```

## Features

- Interactive keyboard visualization with every layer found in `data/keybindings_explained.csv`
- Dynamic layer detection from current bindings: base, mouse, scroll, navigation, window, system, app/workflow, code, game, travel, or utility
- Live layer display when beacon listener is running (reads `../charybdis-tools/runtime/charybdis_state.json`)
- Key inspector — click any key to see its binding, purpose, and shortcuts
- Per-app workflow guides that resolve shortcuts against the current layout instead of trusting stale layer-position hints
- Missing workflow markers for app-local keys, pointer-modified actions, multi-step chords, and shortcuts not present in the current CSV
- Practice and fullscreen Learn modes for mapped workflow shortcuts
- No build step — pure static HTML + vanilla JS

## Dynamic Layer Rules

The optimizer can assign any workflow to any layer. The coach does not assume fixed meanings such as "L2 is mouse" or "L5 is code." It profiles each layer from the live CSV using binding behavior, shortcut metadata, app names, categories, and usage notes.

Layer names shown in the UI are therefore descriptions of the current exported layout, not permanent firmware contracts. Layer access instructions in Learn mode are also discovered from current momentary/toggle/to-layer bindings.

Layer 7 may contain mirrored/frozen structural bindings by design. The coach displays them, but workflow quality should be judged from the mutable layout and real usage data.

## Workflow Coverage

Workflow JSON files can contain four kinds of entries:

- Direct keyboard shortcuts that should resolve to a key in `data/keybindings_explained.csv`.
- Multi-step app chords such as VS Code `Ctrl+K Ctrl+S`, which the coach labels as sequences.
- Pointer-modified actions such as `Ctrl+Click`, which the coach labels as pointer actions.
- Application-local keymaps such as Vimium `gg`, `/`, or `yy`, which only work when that app/keymap mode is active.

Entries that cannot be resolved are still shown in the workflow guide instead of being hidden. That makes gaps visible without pretending that every workflow action must be a single keyboard binding.

## Keeping Data in Sync

After applying or exporting a new layout, refresh `data/keybindings_explained.csv`, `data/layout_spec.json`, and workflow metadata from the active layout export. If using the optimizer sync script:

```powershell
cd ..\charybdis-optimizer
powershell -ExecutionPolicy Bypass -File sync_repos.ps1 -CommitMessage "layout update" -Push
```

This copies the latest keybindings CSV and metadata from zmk-config into `data/`.

## Sibling Repos

| Repo | Purpose |
|------|---------|
| [charybdis-zmk-config](https://github.com/Glx28/zmk-config-charybdis-beacons) | ZMK firmware config, layout CSV (source of truth) |
| [charybdis-coach](https://github.com/Glx28/charybdis-coach) (this repo) | Interactive keyboard layout coach |
| [charybdis-optimizer](https://github.com/Glx28/charybdis-optimizer) | Analysis pipeline + evolutionary optimizer |
| [charybdis-tools](https://github.com/Glx28/charybdis-tools) | Windows AHK helpers, beacon, usage logging, bootstrap |
