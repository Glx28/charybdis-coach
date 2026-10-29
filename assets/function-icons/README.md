# Function icons

PowerToys module icons were copied from installed PowerToys 0.100.2.0, not recreated or substituted with a generic icon set:

- Module icons: `C:\Program Files\PowerToys\WinUI3Apps\Assets\Settings\Icons\`
- Command Palette logo: `C:\Program Files\PowerToys\WinUI3Apps\Assets\Settings\CmdPal\CmdPal.png`
- Advanced Paste logo: `C:\Program Files\PowerToys\WinUI3Apps\Assets\AdvancedPaste\AdvancedPaste.png`
- New+ logo: `C:\Program Files\PowerToys\WinUI3Apps\Assets\NewPlus\New_dark.ico`
- Snipping Tool logo: installed Windows app logo already copied under `app-icons/`.

`data/function_icon_manifest.json` maps purpose plus owning app to the matching resource. The PowerToys app badge remains visible separately. Function artwork is shown at about 20% of keycap area; app identity stays in the corner badge. Rows with no available dedicated tool icon keep their existing action glyph.
