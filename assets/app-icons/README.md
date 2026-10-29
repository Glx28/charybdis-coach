# Shortcut app icons

Small app identity badges shown on Coach keycaps. Assets copied from this Windows installation or first-party app assets; shortcut/action glyphs remain visible beneath them.

- Chrome, Edge, Excel, Explorer, Outlook, PowerPoint, PowerToys, PowerToys Run, VS Code, Word, Windows Terminal, Task Manager: extracted from the installed program executable/resource.
- Command Palette, Advanced Paste, New+: copied from installed PowerToys assets under `C:\Program Files\PowerToys`.
- Teams: copied from installed Microsoft Teams package (`TeamsForWorkNewStoreLogo.scale-200.png`).
- Discord: copied from installed Discord `app.ico`.
- Claude: copied from `https://claude.ai/favicon.ico`.
- M-Files: favicon copied from the official [M-Files developer site](https://developer.m-files.com/User-Experience/Logo/); source also provides the desktop logo.
- Windows and mouse marks: local SVGs used for OS and hardware identities.

`data/app_icon_manifest.json` stores aggregate shortcut/app counts from the local `shortcut_usage.jsonl` log. When the same chord is assigned to multiple apps, Coach picks the most-used assigned app icon for that chord. Browser-labelled shortcuts use the exact chord count when available and otherwise Edge, which had 351 logged browser shortcut events versus zero for Chrome. Icon choice does not affect shortcut behavior or optimizer scores.
