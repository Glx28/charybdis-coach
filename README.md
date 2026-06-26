# Charybdis Coach

Browser-based interactive keyboard layout coach for the Charybdis split keyboard. Visualizes all 616 keys across 11 layers, tracks live layer state, and provides per-app workflow guides.

Part of the [Charybdis Keyboard System](https://github.com/Glx28/charybdis-tools#readme) — see the parent README for full setup and how data flows between repos.

## Quick Start

```powershell
# Option 1: Via the tools launcher (recommended — also starts beacon for live layer tracking)
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

data/               # Synced from charybdis-zmk-config (via sync_repos.ps1)
  keybindings_explained.csv     # All 616 keys across 11 layers
  layout_spec.json              # Physical key positions and layer descriptions
  charybdis_apps.json           # App shortcut definitions
  windows_norwegian_host.json   # Scancode-to-glyph mapping for Norwegian Windows

workflows/          # Per-app shortcut guides (JSON)
  browser.json, vscode.json, excel.json, teams.json, outlook.json,
  explorer.json, discord.json, slack.json, mfiles.json, ...
```

## Features

- Interactive keyboard visualization with all 11 layers
- Live layer display when beacon listener is running (reads `../charybdis-tools/runtime/charybdis_state.json`)
- Key inspector — click any key to see its binding, purpose, and shortcuts
- Per-app workflow guides with step-by-step shortcut sequences
- Practice mode for learning new shortcuts
- No build step — pure static HTML + vanilla JS

## Keeping Data in Sync

After applying a new layout in ZMK Studio:

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
