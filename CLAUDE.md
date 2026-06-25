# Charybdis Coach — Interactive Keyboard Layout Browser

Browser-based single-page app for exploring and practicing the Charybdis split keyboard layout (616 keys, 11 layers).

## Run

```bash
cd ../charybdis-coach
python -m http.server 8765
# Open http://127.0.0.1:8765/
```

Or use the launcher: `../charybdis-tools/powershell/start_charybdis_coach.ps1`

## Structure

- `app.js` / `index.html` / `styles.css` — the entire app (single-page, no build step)
- `workflows/` — 18+ workflow JSON files (app-specific shortcut practice sequences)
- `data/` — layout data copied from `charybdis-zmk-config`:
  - `keybindings_explained.csv` — source of truth (616 keys)
  - `layout_spec.json` — physical key positions
  - `charybdis_apps.json` — app shortcut definitions
  - `windows_norwegian_host.json` — scancode-to-glyph mapping for Norwegian Windows

## Data Sync

Data files in `data/` are copies from `../charybdis-zmk-config/layout/` and `../charybdis-zmk-config/config/`. After layout changes, re-copy them.

## Live Layer State

When the AHK helper (`../charybdis-tools/`) is running, the coach fetches `../charybdis-tools/runtime/charybdis_state.json` for live layer display. This is a soft dependency — the app works without it.

## Beacon Integration

Status: PENDING. Host-side beacon detection is ready in the AHK helper; firmware macros not yet wired.

## Sibling Repos

All repos live in the same parent directory.
- `../charybdis-zmk-config` — ZMK firmware config, keymap, layout CSV, ZMK Studio scripts
- `../charybdis-optimizer` — Node.js pipeline + Python DEAP evolutionary layout optimizer
- `../charybdis-tools` — Windows AHK helper, trackball benchmarks, PowerShell scripts, runtime logs
