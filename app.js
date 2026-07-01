(function () {
  let LAYERS = [];
  const X_LEFT = [0, 1, 2, 3, 4, 5];
  const X_RIGHT = [7, 8, 9, 10, 11, 12];
  const MAX_EVENTS = 12;
  const BEACON_STALE_MS = 12000;

  const els = {
    activeLayer: document.getElementById("activeLayer"),
    activeApp: document.getElementById("activeApp"),
    lastAction: document.getElementById("lastAction"),
    transport: document.getElementById("transport"),
    beaconBanner: document.getElementById("beaconBanner"),
    beaconBannerTitle: document.getElementById("beaconBannerTitle"),
    beaconBannerDetail: document.getElementById("beaconBannerDetail"),
    deviceLabel: document.getElementById("deviceLabel"),
    layerTabs: document.getElementById("layerTabs"),
    keyboardMap: document.getElementById("keyboardMap"),
    searchInput: document.getElementById("searchInput"),
    focusImportantButton: document.getElementById("focusImportantButton"),
    showAllButton: document.getElementById("showAllButton"),
    fullscreenButton: document.getElementById("fullscreenButton"),
    selectedIcon: document.getElementById("selectedIcon"),
    selectedTitle: document.getElementById("selectedTitle"),
    selectedSubtitle: document.getElementById("selectedSubtitle"),
    selectedBehavior: document.getElementById("selectedBehavior"),
    selectedOutput: document.getElementById("selectedOutput"),
    selectedModifiers: document.getElementById("selectedModifiers"),
    selectedPurpose: document.getElementById("selectedPurpose"),
    selectedNotes: document.getElementById("selectedNotes"),
    heldLayers: document.getElementById("heldLayers"),
    lockedLayer: document.getElementById("lockedLayer"),
    toggledLayers: document.getElementById("toggledLayers"),
    stateAge: document.getElementById("stateAge"),
    eventList: document.getElementById("eventList"),
    appList: document.getElementById("appList"),
    drillButton: document.getElementById("drillButton"),
    quizButton: document.getElementById("quizButton"),
    guidedButton: document.getElementById("guidedButton"),
    practiceStopButton: document.getElementById("practiceStopButton"),
    practiceResetButton: document.getElementById("practiceResetButton"),
    practicePrompt: document.getElementById("practicePrompt"),
    practiceScore: document.getElementById("practiceScore"),
    practiceMastery: document.getElementById("practiceMastery"),
    practiceAppSelect: document.getElementById("practiceAppSelect"),
    workflowAppSelect: document.getElementById("workflowAppSelect"),
    workflowSearch: document.getElementById("workflowSearch"),
    workflowContent: document.getElementById("workflowContent")
  };

  const state = {
    rows: [],
    rowsByLayer: new Map(),
    layerProfiles: new Map(),
    apps: [],
    layoutSpec: {},
    hostKeyboard: null,
    displayedLayer: "0",
    liveLayer: "0",
    pinnedLayer: null,
    lastLiveKeySignature: "",
    selectedKey: null,
    query: "",
    focusImportant: false,
    lastState: null,
    events: [],
    practice: { mode: null, target: null, guidedList: [], guidedIndex: 0, attempts: 0, correct: 0 },
    progress: {}
  };

  const LAYER_KIND_META = {
    base: { glyph: "⌨️ Aa", title: "Base typing", color: "#4cc9b0" },
    mouse: { glyph: "🖱️ Mou", title: "Mouse / pointer", color: "#b78cff" },
    scroll: { glyph: "📜 Scr", title: "Scroll / trackball scroll", color: "#c9e265" },
    nav: { glyph: "🧭 Nav", title: "Navigation", color: "#3dd6c6" },
    window: { glyph: "🪟 Win", title: "Windows / app control", color: "#6eb5ff" },
    system: { glyph: "🔧 Sys", title: "System / device", color: "#ff9f6e" },
    code: { glyph: "💻 Dev", title: "Developer workflow", color: "#56d4e8" },
    app: { glyph: "📋 App", title: "App workflow", color: "#68a5ff" },
    game: { glyph: "🎮 Game", title: "Game / fallback", color: "#a78bfa" },
    travel: { glyph: "⚡ Spd", title: "Travel / speed", color: "#ffb347" },
    utility: { glyph: "🔀 Mix", title: "Mixed utility", color: "#4cc9b0" }
  };

  function clean(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function csvSplit(line) {
    const out = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = line[i + 1];
      if (ch === '"' && quoted && next === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = !quoted;
      } else if (ch === "," && !quoted) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    const headers = csvSplit(lines.shift());
    return lines.map((line) => {
      const values = csvSplit(line);
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      return row;
    });
  }

  async function loadJson(path, fallback) {
    try {
      const res = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status}`);
      return await res.json();
    } catch {
      return fallback;
    }
  }

  async function loadText(path) {
    const res = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return await res.text();
  }

  function shortHint(text, max = 18) {
    const value = clean(text);
    if (!value) return "";
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }

  function modifierParts(modifiers) {
    return clean(modifiers)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part
        .replace(/^L\s+Ctrl$/i, "Ctrl")
        .replace(/^R\s+Ctrl$/i, "Ctrl")
        .replace(/^LeftControl$/i, "Ctrl")
        .replace(/^L\s+Shift$/i, "Shift")
        .replace(/^R\s+Shift$/i, "Shift")
        .replace(/^LeftShift$/i, "Shift")
        .replace(/^L\s+Alt$/i, "Alt")
        .replace(/^R\s+Alt$/i, "AltGr")
        .replace(/^LeftAlt$/i, "Alt")
        .replace(/^RightAlt$/i, "AltGr")
        .replace(/^L\s+GUI$/i, "Win")
        .replace(/^Left GUI$/i, "Win")
        .replace(/^Left\s+GUI$/i, "Win")
        .replace(/^GUI$/i, "Win"));
  }

  function hasModifier(modifiers, pattern) {
    return modifierParts(modifiers).some((part) => pattern.test(part));
  }

  const US_PARAM_LABELS = {
    "1": "1", "1 and Bang": "1",
    "2": "2", "2 and At": "2",
    "3": "3", "3 and Hash": "3",
    "4": "4", "4 and Dollar": "4",
    "5": "5", "5 and Percent": "5",
    "6": "6", "6 and Caret": "6",
    "7": "7", "7 and Ampersand": "7",
    "8": "8", "8 and Star": "8",
    "9": "9", "9 and Left Bracket": "9",
    "0": "0", "0 and Right Bracket": "0",
    "SemiColon": ";", "SemiColon and Colon": ";",
    "Left Apos and Double": "'",
    "Left Brace": "[", "Left Bracket": "[",
    "Right Bracket": "]", "Right Brace": "]",
    "Backslash and Pipe": "\\", "Backslash": "\\",
    "ForwardSlash and QuestionMark": "/", "ForwardSlash": "/",
    "Minus": "-", "Equal": "=", "Equals": "=", "Equal and Plus": "=", "Equals and Plus": "=",
    "Comma": ",", "Comma and LessThan": ",",
    "Period": ".", "Period and GreaterThan": ".",
    "Grave": "`", "Grave Accent and Tilde": "`"
  };

  function hostOutputEntryForToken(token) {
    const map = state.hostKeyboard?.zmk_to_host_output || {};
    const raw = clean(token).replace(/^Keyboard\s+/i, "");
    const candidates = [raw, ...zmkTokensForLookup(raw)];
    for (const candidate of candidates) {
      if (map[candidate]) return map[candidate];
    }
    for (const candidate of candidates) {
      const parts = clean(candidate).split(/\s+and\s+/i).map((part) => part.trim());
      for (const part of parts) {
        if (map[part]) return map[part];
      }
    }
    return null;
  }

  function hostOutputEntryForParam(param) {
    return hostOutputEntryForToken(param);
  }

  function hostGlyphFromEntry(entry, modifiers = "") {
    if (!entry) return "";
    if (hasModifier(modifiers, /^AltGr$/i) && entry.altgr) return entry.altgr;
    if (hasModifier(modifiers, /^Shift$/i) && entry.shift) return entry.shift;
    return entry.normal || "";
  }

  function usGlyphForParam(param) {
    const raw = clean(param).replace(/^Keyboard\s+/i, "");
    const candidates = [raw, ...zmkTokensForLookup(raw)];
    for (const candidate of candidates) {
      if (US_PARAM_LABELS[candidate]) return US_PARAM_LABELS[candidate];
    }
    const entry = hostOutputEntryForParam(raw);
    if (entry?.us) return entry.us;
    return raw.split(/\s+and\s+/i)[0] || raw;
  }

  function comboDisplay(modifiers, keyLabel) {
    const parts = modifierParts(modifiers);
    if (keyLabel) parts.push(keyLabel);
    return parts.join("+");
  }

  function hostShortcutForRow(row) {
    if (!/key press/i.test(clean(row.behavior))) return "";
    const entry = hostOutputEntryForParam(row.parameter);
    const hostKey = hostGlyphFromEntry(entry, row.modifiers) || usGlyphForParam(row.parameter);
    return comboDisplay(row.modifiers, hostKey);
  }

  function usShortcutForRow(row) {
    if (!/key press/i.test(clean(row.behavior))) return "";
    return comboDisplay(row.modifiers, usGlyphForParam(row.parameter));
  }

  function hostShortcutMeta(row) {
    const host = hostShortcutForRow(row);
    const us = usShortcutForRow(row);
    return {
      host,
      us,
      differs: Boolean(host && us && host !== us)
    };
  }

  function hostPrimaryForPrintable(label, param) {
    const entry = hostOutputEntryForParam(param);
    if (!entry) return "";
    const host = hostGlyphFromEntry(entry, "");
    const current = clean(label);
    if (!current) return host;
    if (/^[^\w\s]{1,2}$/i.test(current) || /^[øæåØÆÅ]$/i.test(current)) return host;
    return "";
  }

  function outputDisplayForRow(row) {
    if (/transparent|none/i.test(clean(row.behavior))) {
      const through = transparentFallthroughLabel(row);
      return through ? `Falls through to ${through}` : "Transparent";
    }
    const meta = hostShortcutMeta(row);
    if (!meta.host) return clean(row.parameter) || "-";
    return meta.differs ? `${meta.host} (US HID: ${meta.us})` : meta.host;
  }

  function layerParam(row) {
    const param = clean(row.parameter);
    const match = param.match(/(\d+)/);
    return match ? match[1] : "";
  }

  const SINGLE_LETTER_ACTION_MAP = [
    [/^c$/i, /^l ctrl$/i, { emoji: "📄", action: "Copy" }],
    [/^v$/i, /^l ctrl$/i, { emoji: "📥", action: "Paste" }],
    [/^v$/i, /gui/i, { emoji: "🗂️", action: "ClipHist" }],
    [/^x$/i, /^l ctrl$/i, { emoji: "✂️", action: "Cut" }],
    [/^z$/i, /^l ctrl$/i, { emoji: "↩️", action: "Undo" }],
    [/^y$/i, /^l ctrl$/i, { emoji: "↪️", action: "Redo" }],
    [/^s$/i, /^l ctrl$/i, { emoji: "💾", action: "Save" }],
    [/^s$/i, /gui.*shift|shift.*gui/i, { emoji: "📸", action: "Snip" }],
    [/^s$/i, /gui/i, { emoji: "🔍", action: "Search" }],
    [/^a$/i, /^l ctrl$/i, { emoji: "🔲", action: "Sel All" }],
    [/^a$/i, /gui/i, { emoji: "⚙️", action: "QSett" }],
    [/^f$/i, /^l ctrl$/i, { emoji: "🔎", action: "Find" }],
    [/^h$/i, /^l ctrl$/i, { emoji: "🔁", action: "Replace" }],
    [/^h$/i, /gui/i, { emoji: "🎙️", action: "Voice" }],
    [/^d$/i, /gui.*ctrl|ctrl.*gui/i, { emoji: "🆕", action: "NewDesk" }],
    [/^d$/i, /^l gui$/i, { emoji: "🏠", action: "Desktop" }],
    [/^d$/i, /^l ctrl$/i, { emoji: "🔂", action: "Dupl" }],
    [/^e$/i, /gui/i, { emoji: "📁", action: "Explorer" }],
    [/^e$/i, /^l ctrl$/i, { emoji: "🔍", action: "Search" }],
    [/^n$/i, /gui/i, { emoji: "🔔", action: "Notif" }],
    [/^n$/i, /^l ctrl$/i, { emoji: "🆕", action: "New" }],
    [/^c$/i, /gui/i, { emoji: "🤖", action: "Copilot" }],
    [/^w$/i, /^l ctrl$/i, { emoji: "❌", action: "Close" }],
    [/^r$/i, /gui/i, { emoji: "▶️", action: "Run" }],
    [/^r$/i, /^l ctrl$/i, { emoji: "🔃", action: "Refresh" }],
    [/^l$/i, /gui/i, { emoji: "🔒", action: "Lock" }],
    [/^l$/i, /^l ctrl$/i, { emoji: "📍", action: "AddrBar" }],
    [/^i$/i, /gui/i, { emoji: "⚙️", action: "Settings" }],
    [/^i$/i, /^l ctrl$/i, { emoji: "ℹ️", action: "Info" }],
    [/^t$/i, /gui/i, { emoji: "🧲", action: "Taskbar" }],
    [/^t$/i, /^l ctrl$/i, { emoji: "➕", action: "NewTab" }],
    [/^b$/i, /gui/i, { emoji: "🔽", action: "SysTray" }],
    [/^b$/i, /^l ctrl$/i, { emoji: "🅱️", action: "Bold" }],
    [/^u$/i, /gui/i, { emoji: "♿", action: "Access" }],
    [/^u$/i, /^l ctrl$/i, { emoji: "🔡", action: "Underln" }],
    [/^p$/i, /^l ctrl$/i, { emoji: "🖨️", action: "Print" }],
    [/^g$/i, /^l ctrl$/i, { emoji: "📍", action: "GoTo" }],
    [/^k$/i, /^l ctrl$/i, { emoji: "🔗", action: "Link" }],
    [/^o$/i, /^l ctrl$/i, { emoji: "📂", action: "Open" }],
    [/^m$/i, /gui/i, { emoji: "⏬", action: "MinAll" }],
    [/^m$/i, /ctrl.*shift/i, { emoji: "🔇", action: "Mute" }],
    [/^x$/i, /gui/i, { emoji: "⚡", action: "Power" }],
    [/^j$/i, /^l ctrl$/i, { emoji: "💿", action: "Downld" }],
  ];

  function matchSingleLetterAction(label, modifiers) {
    const l = clean(label);
    const m = clean(modifiers);
    for (const [labelPat, modPat, result] of SINGLE_LETTER_ACTION_MAP) {
      if (labelPat.test(l) && modPat.test(m)) return result;
    }
    return null;
  }

  const KEYCAP_EMOJI_RULES = [
    [/^copy$/i, null, "📄"],
    [/^paste$/i, null, "📥"],
    [/^cut$/i, null, "✂️"],
    [/^undo$/i, null, "↩️"],
    [/^redo$/i, null, "↪️"],
    [/^save$/i, null, "💾"],
    [/^search$/i, null, "🔍"],
    [/^find$/i, null, "🔎"],
    [/^close$/i, null, "❌"],
    [/^sel all$/i, null, "🔲"],
    [/^snip$/i, null, "📸"],
    [/^screenshot$/i, null, "📸"],
    [/^task view$/i, null, "🪟"],
    [/^desktop$/i, null, "🏠"],
    [/^next tab$/i, null, "⏭️"],
    [/^prev tab$/i, null, "⏮️"],
    [/^refresh$/i, null, "🔃"],
    [/^zoom in$/i, null, "🔭"],
    [/^zoom out$/i, null, "🔬"],
    [/^alt\+tab$/i, null, "🔀"],
    [/^cmdpal$/i, null, "🪄"],
    [/^run$/i, null, "▶️"],
    [/^print$/i, null, "🖨️"],
    [/^mute$/i, null, "🔇"],
    [/^camera$/i, null, "📷"],
    [/^screen$/i, null, "📡"],
    [/^share$/i, null, "📡"],
    [/^reply$/i, null, "↩️"],
    [/^forward$/i, null, "➡️"],
    [/^attach$/i, null, "📎"],
    [/^link$/i, null, "🔗"],
    [/^new$/i, null, "🆕"],
    [/^del$/i, null, "🗑️"],
    [/^delete$/i, null, "🗑️"],
    [/^rename$/i, null, "✏️"],
    [/^bold$/i, null, "🅱️"],
    [/^italic$/i, null, "🔤"],
    [/^underline$/i, null, "🔡"],
    [/^emoji$/i, null, "😀"],
    [/^voice$/i, null, "🎙️"],
    [/^copilot$/i, null, "🤖"],
    [/^lock$/i, null, "🔒"],
    [/^settings$/i, null, "⚙️"],
    [/^notif$/i, null, "🔔"],
    [/^minimize$/i, null, "⏬"],
    [/^maximize$/i, null, "⏫"],
    [/^snap$/i, null, "🧲"],
    [/^split$/i, null, "↔️"],
    [/^sidebar$/i, null, "📐"],
    [/^terminal$/i, null, "💻"],
    [/^debug$/i, null, "🐛"],
    [/^breakpt$/i, null, "🔴"],
    [/^step$/i, null, "👟"],
    [/^bookmark$/i, null, "⭐"],
    [/^history$/i, null, "🕰️"],
    [/^download$/i, null, "💿"],
    [/^upload$/i, null, "☁️"],
    [/^comment$/i, null, "💬"],
    [/^format$/i, null, "🎨"],
    [/^insert$/i, null, "➕"],
    [/^duplicate$/i, null, "🔂"],
    [/^group$/i, null, "📦"],
    [/^export$/i, null, "📤"],
    [/^import$/i, null, "📥"],
    [/^check.?out$/i, null, "🔓"],
    [/^check.?in$/i, null, "🔐"],
    [/^send$/i, null, "📨"],
    [/^mark read$/i, null, "👁️"],
    [/^mark unread$/i, null, "📩"],
    [/^flag$/i, null, "🚩"],
    [/^calendar$/i, null, "📅"],
    [/^chat$/i, null, "🗨️"],
    [/^call$/i, null, "📞"],
    [/^hang.?up$/i, null, "📵"],
    [/^accept$/i, null, "🟢"],
    [/^decline$/i, null, "🔴"],
    [/^record$/i, null, "⏺️"],
    [/^hand$/i, null, "✋"],
    [/^blur$/i, null, "🌫️"],
    [/^fill$/i, null, "⬇️"],
    [/^autosum$/i, null, "🧮"],
    [/^formula$/i, null, "🧮"],
    [/^navigate$/i, null, "🧭"],
    [/^home$/i, null, "🏠"],
    [/^end$/i, null, "🔚"],
    [/^pgup$|^pg up$|^page.?up$/i, null, "⏫"],
    [/^pgdn$|^pg dn$|^page.?dn$|^page.?down$/i, null, "⏬"],
    [/^1 PU$|^9 PU$/i, null, "⏫"],
    [/^3 PD$|^7 PD$/i, null, "⏬"],
    [/^win$/i, null, "🪟"],
    [/^menu$/i, null, "☰"],
    [/^power$/i, null, "⚡"],
    [/^play$/i, null, "▶️"],
    [/^pause$/i, null, "⏸️"],
    [/^stop$/i, null, "⏹️"],
    [/^next$/i, null, "⏭️"],
    [/^prev$/i, null, "⏮️"],
    [/^vol.?up$/i, null, "🔊"],
    [/^vol.?dn$|^vol.?down$/i, null, "🔉"],
    [/^mute$/i, null, "🔇"],
    [/^bright$/i, null, "☀️"],
    [/^hover$/i, null, "💡"],
    [/^selnx$/i, null, "🔦"],
    [/^stpov$/i, null, "👟"],
    [/^stpot$/i, null, "⤴️"],
    [/^gosym$/i, null, "🔣"],
    [/^bkpt$/i, null, "🔴"],
    [/^rstr$/i, null, "🔁"],
    [/^cmnt$/i, null, "💬"],
    [/^explr$/i, null, "🗂️"],
    [/^newfl$/i, null, "🆕"],
    [/^fmt$/i, null, "🎨"],
    [/^wrap$/i, null, "🔄"],
    [/^lnup$/i, null, "⬆️"],
    [/^lndn$/i, null, "⬇️"],
    [/^cpdn$/i, null, "🔂"],
    [/^insup$/i, null, "⤴️"],
    [/^insln$/i, null, "➕"],
    [/^open$/i, null, "📂"],
    [/^peek$/i, null, "👁️"],
    [/^goln$/i, null, "📍"],
    [/^brkt$/i, null, "🔗"],
    [/^sett$/i, null, "⚙️"],
    [/^delln$/i, null, "🗑️"],
    [/^term$/i, null, "⬛"],
    [/^selal$/i, null, "🔦"],
    [/^indnt$/i, null, "➡️"],
    [/^outdn$/i, null, "⬅️"],
    [/^toggle$/i, null, "🔀"],
    [/^copy$/i, null, "📄"],
    [/^paste$/i, null, "📥"],
    [/^undo$/i, null, "↩️"],
    [/^redo$/i, null, "↪️"],
    [/^snip$/i, null, "📸"],
    [/^zoom in$/i, null, "🔭"],
    [/^zoom out$/i, null, "🔬"],
    [/^close win$/i, null, "💥"],
    [/^minall$/i, null, "⏬"],
    [/^cliph$/i, null, "🗂️"],
    [/^lang$/i, null, "🌐"],
    [/^tskmg$/i, null, "📊"],
    [/^tskcy$/i, null, "🧲"],
    [/^systr$/i, null, "🔽"],
    [/^qsett$/i, null, "⚙️"],
    [/^acces$/i, null, "♿"],
    [/^explorer$/i, null, "📁"],
    [/^dms$/i, null, "🏛️"],
    [/^excel$/i, null, "📊"],
    [/^code$/i, null, "💻"],
    [/^hand$/i, null, "✋"],
    [/^hangup$/i, null, "📵"],
    [/^accept$/i, null, "🟢"],
    [/^ctrl\+g$/i, null, "📍"],
    [/^ctrl\+o$/i, null, "📂"],
    [/^ctrl\+k$/i, null, "🔗"],
    [/^ctrl\+s$/i, null, "💾"],
    [/^ctrl\+l$/i, null, "📍"],
    [/^ctrl\+b$/i, null, "🅱️"],
    [/^ctrl\+u$/i, null, "🔡"],
    [/^ctrl\+e$/i, null, "🔍"],
    [/^ctrl\+p$/i, null, "🖨️"],
    [/^ctrl\+r$/i, null, "🔃"],
    [/^ctrl\+d$/i, null, "🔂"],
    [/^ctrl\+i$/i, null, "ℹ️"],
    [/^ctrl\+w$/i, null, "❌"],
    [/^ctrl\+n$/i, null, "🆕"],
    [/^mb1$/i, null, "👆"],
    [/^mb2$/i, null, "🤞"],
    [/^mb3$/i, null, "🖖"],
    [/^mb4$/i, null, "👈"],
    [/^mb5$/i, null, "👉"],
    [/^sel all$/i, null, "🔲"],
    [/^alt\+tab$/i, null, "🔀"],
    [/^sidebar$/i, null, "📐"],
    [/^probs$/i, null, "⚠️"],
    [/^ext$/i, null, "🧩"],
    [/^git$/i, null, "🌿"],
    [/^srcctl$/i, null, "🌿"],
    [/^nxtpr$/i, null, "🚨"],
    [/^prvpr$/i, null, "🚨"],
    [/^defn$/i, null, "🎯"],
    [/^refs$/i, null, "🔎"],
    [/^impl$/i, null, "🏗️"],
    [/^type$/i, null, "🏷️"],
    [/^select$/i, null, "🔲"],
    [/^srch$/i, null, "🔍"],
    [/^repl$/i, null, "🔁"],
    [/^nxtch$/i, null, "⏭️"],
    [/^prvch$/i, null, "⏮️"],
    [/^inbox$/i, null, "📬"],
    [/^newterm$/i, null, "⬛"],
    [/^systray$/i, null, "🔽"],
  ];

  function keycapEmoji(label, modifiers, purpose) {
    const labelClean = clean(label);
    const modsClean = clean(modifiers);
    const combined = `${labelClean} ${purpose}`.toLowerCase();
    if (/base typing key for the main work layout/i.test(purpose)) return "";
    for (const [labelPattern, modPattern, emoji] of KEYCAP_EMOJI_RULES) {
      if (labelPattern.test(labelClean)) {
        if (!modPattern || modPattern.test(modsClean)) return emoji;
      }
    }
    if (!modsClean) return "";
    if (/copy/i.test(combined)) return "📄";
    if (/paste/i.test(combined)) return "📥";
    if (/cut\b/i.test(combined)) return "✂️";
    if (/undo/i.test(combined)) return "↩️";
    if (/redo/i.test(combined)) return "↪️";
    if (/save/i.test(combined)) return "💾";
    if (/search/i.test(combined)) return "🔍";
    if (/find/i.test(combined)) return "🔎";
    if (/close.*tab|close.*window/i.test(combined)) return "❌";
    if (/close/i.test(combined)) return "❌";
    if (/select all/i.test(combined)) return "🔲";
    if (/screenshot|snip/i.test(combined)) return "📸";
    if (/task view/i.test(combined)) return "🪟";
    if (/desktop/i.test(combined)) return "🏠";
    if (/next tab/i.test(combined)) return "⏭️";
    if (/prev.*tab/i.test(combined)) return "⏮️";
    if (/refresh|reload/i.test(combined)) return "🔃";
    if (/zoom.*in/i.test(combined)) return "🔭";
    if (/zoom.*out/i.test(combined)) return "🔬";
    if (/zoom/i.test(combined)) return "🔭";
    if (/switch.*app|alt.*tab/i.test(combined)) return "🔀";
    if (/command.*palette|powertoys/i.test(combined)) return "🪄";
    if (/delete.*line/i.test(combined)) return "🗑️";
    if (/delete|word del/i.test(combined)) return "🗑️";
    if (/rename/i.test(combined)) return "✏️";
    if (/clipboard/i.test(combined)) return "🗂️";
    if (/print/i.test(combined)) return "🖨️";
    if (/mute/i.test(combined)) return "🔇";
    if (/camera/i.test(combined)) return "📷";
    if (/screen.*share/i.test(combined)) return "📡";
    if (/emoji/i.test(combined)) return "😀";
    if (/voice/i.test(combined)) return "🎙️";
    if (/copilot/i.test(combined)) return "🤖";
    if (/lock.*pc/i.test(combined)) return "🔒";
    if (/settings/i.test(combined)) return "⚙️";
    if (/notification/i.test(combined)) return "🔔";
    if (/minimize.*all/i.test(combined)) return "⏬";
    if (/minimize/i.test(combined)) return "⏬";
    if (/maximize/i.test(combined)) return "⏫";
    if (/snap/i.test(combined)) return "🧲";
    if (/move.*monitor/i.test(combined)) return "🖥️";
    if (/new.*virtual/i.test(combined)) return "🆕";
    if (/switch.*desktop/i.test(combined)) return "🔀";
    if (/file.*explorer/i.test(combined)) return "📁";
    if (/run.*dialog/i.test(combined)) return "▶️";
    if (/power.*user/i.test(combined)) return "⚡";
    if (/switch.*lang|switch.*input/i.test(combined)) return "🌐";
    if (/toggle.*sidebar/i.test(combined)) return "📐";
    if (/bold/i.test(combined)) return "🅱️";
    if (/italic/i.test(combined)) return "🔤";
    if (/underline/i.test(combined)) return "🔡";
    if (/format/i.test(combined)) return "🎨";
    if (/toggle.*comment/i.test(combined)) return "💬";
    if (/comment/i.test(combined)) return "💬";
    if (/link|hyperlink/i.test(combined)) return "🔗";
    if (/reply/i.test(combined)) return "↩️";
    if (/forward/i.test(combined)) return "➡️";
    if (/attach/i.test(combined)) return "📎";
    if (/send/i.test(combined)) return "📨";
    if (/word.*move|word.*jump/i.test(combined)) return "⏩";
    if (/navigat/i.test(combined)) return "🧭";
    if (/page.*break/i.test(combined)) return "📃";
    if (/new.*tab/i.test(combined)) return "➕";
    if (/new.*window/i.test(combined)) return "🪟";
    if (/new.*chat/i.test(combined)) return "🗨️";
    if (/new.*file|new.*doc|new.*page/i.test(combined)) return "🆕";
    if (/bookmark/i.test(combined)) return "⭐";
    if (/favorite/i.test(combined)) return "💛";
    if (/history/i.test(combined)) return "🕰️";
    if (/download/i.test(combined)) return "💿";
    if (/upload/i.test(combined)) return "☁️";
    if (/app.*taskbar|launcher|pinned app/i.test(combined)) return "🧲";
    if (/toggle.*output|usb.*ble/i.test(combined)) return "🔌";
    if (/step.*over/i.test(combined)) return "👟";
    if (/step.*into/i.test(combined)) return "⤵️";
    if (/step.*out/i.test(combined)) return "⤴️";
    if (/breakpoint/i.test(combined)) return "🔴";
    if (/restart.*debug/i.test(combined)) return "🔁";
    if (/debug/i.test(combined)) return "🐛";
    if (/hover.*info/i.test(combined)) return "💡";
    if (/select.*next|select.*occur/i.test(combined)) return "🔦";
    if (/go.*symbol/i.test(combined)) return "🔣";
    if (/explorer.*panel/i.test(combined)) return "🗂️";
    if (/word.*wrap/i.test(combined)) return "🔄";
    if (/move.*line/i.test(combined)) return "↕️";
    if (/copy.*line/i.test(combined)) return "🔂";
    if (/insert.*line/i.test(combined)) return "➕";
    if (/split.*editor/i.test(combined)) return "↔️";
    if (/quick.*open/i.test(combined)) return "⚡";
    if (/peek.*def/i.test(combined)) return "👁️";
    if (/go.*line/i.test(combined)) return "📍";
    if (/jump.*bracket/i.test(combined)) return "🔗";
    if (/toggle.*terminal/i.test(combined)) return "⬛";
    if (/address.*bar/i.test(combined)) return "📍";
    if (/select.*line|select all/i.test(combined)) return "🔲";
    if (/duplicate/i.test(combined)) return "🔂";
    if (/object.*info/i.test(combined)) return "ℹ️";
    if (/raise.*hand/i.test(combined)) return "✋";
    if (/end.*call|hang.*up/i.test(combined)) return "📵";
    if (/accept.*call/i.test(combined)) return "🟢";
    if (/system.*tray|focus.*tray/i.test(combined)) return "🔽";
    if (/accessibility/i.test(combined)) return "♿";
    if (/quick.*settings/i.test(combined)) return "⚙️";
    if (/input.*language/i.test(combined)) return "🌐";
    if (/cycle.*taskbar/i.test(combined)) return "🧲";
    if (/window.*menu/i.test(combined)) return "☰";
    if (/refresh|run/i.test(combined)) return "🔃";
    if (/quick.*switcher/i.test(combined)) return "⚡";
    if (/insert.*link/i.test(combined)) return "🔗";
    if (/open.*file/i.test(combined)) return "📂";
    if (/go.*vault|go.*page/i.test(combined)) return "📍";
    if (/programming.*shortcut|editing.*shortcut/i.test(combined)) return "⌨️";
    if (/control-modified/i.test(combined)) return "⌨️";
    if (/navigation.*key.*cursor/i.test(combined)) return "🧭";
    if (/macro.*key/i.test(combined)) return "🔧";
    if (/rpg.*game.*action|game.*confirm/i.test(combined)) return "🎮";
    if (/rpg.*game.*movement|game.*navigation/i.test(combined)) return "🕹️";
    if (/mouse.*qol/i.test(combined)) return "🖱️";
    if (/function.*key.*access/i.test(combined)) return "🎹";
    if (/base.*typing.*key/i.test(combined)) return "";
    return "";
  }

  function classifyKey(row) {
    const behavior = clean(row.behavior);
    const behaviorLower = behavior.toLowerCase();
    const label = clean(row.visual_label);
    const labelLower = label.toLowerCase();
    const param = clean(row.parameter);
    const modifiers = clean(row.modifiers);
    const combined = `${label} ${param} ${behavior}`.toLowerCase();

    const coachMap = {
      coach_game_lock: { kind: "game", primary: "Game", badge: "🎮", secondary: "Lock → L7" },
      coach_base: { kind: "home", primary: "Base", badge: "🏠", secondary: "Return L0" },
      coach_travel_toggle: { kind: "toggle", primary: "Layer", badge: "🔀", secondary: "Toggle configured layer" },
      coach_travel_off: { kind: "toggle", primary: "Layer", badge: "🔀", secondary: "Exit configured toggle" },
      coach_recover_base: { kind: "home", primary: "Base", badge: "🏠", secondary: "Recover L0" },
      coach_scroll_toggle: { kind: "toggle", primary: "Layer", badge: "🔀", secondary: "Toggle configured layer" }
    };
    const numberedCoachHold = behaviorLower.match(/^coach_l(\d+)_hold$/);
    if (numberedCoachHold) {
      const target = numberedCoachHold[1];
      const meta = dynamicLayerMeta(target);
      return {
        kind: "momentary",
        primary: clean(label) || `L${target}`,
        badge: meta.glyph || "👆",
        secondary: `Hold → L${target}${meta.role ? ` ${meta.role}` : ""}`.trim()
      };
    }
    const layerAccessBehaviors = {
      coach_mouse_lock: { kind: "lock", target: "2", verb: "Lock" }
    };
    if (layerAccessBehaviors[behaviorLower]) {
      const info = layerAccessBehaviors[behaviorLower];
      const meta = dynamicLayerMeta(info.target);
      return {
        kind: info.kind,
        primary: clean(label) || `L${info.target}`,
        badge: meta.glyph || "👆",
        secondary: `${info.verb} → L${info.target} ${meta.role || meta.title || ""}`.trim()
      };
    }
    if (coachMap[behaviorLower]) return { ...coachMap[behaviorLower] };

    if (/reset|bootloader/i.test(behavior) || /reset|bootloader/i.test(label)) {
      return { kind: "danger", primary: label || "Reset", badge: "⚠️", secondary: behavior };
    }
    if (/studio/i.test(behavior)) {
      return { kind: "studio", primary: "Studio", badge: "🔓", secondary: "Unlock" };
    }
    if (/transparent|none/i.test(behavior)) {
      const through = transparentFallthroughLabel(row);
      return {
        kind: "transparent",
        primary: through || "·",
        badge: "↧",
        secondary: through ? "fall-through" : ""
      };
    }
    if (/mouse key press/i.test(behavior)) {
      const btn = label.replace(/mouse key press/i, "").trim() || param.replace(/select:/i, "") || "Btn";
      const mbEmojis = { MB1: "👆", MB2: "🤞", MB3: "🖖", MB4: "👈", MB5: "👉" };
      const mbEmoji = mbEmojis[btn.toUpperCase()] || "🖱️";
      return { kind: "mouse-btn", primary: btn, badge: mbEmoji, secondary: shortHint(param, 14) };
    }
    if (/bluetooth/i.test(behavior)) {
      return { kind: "bluetooth", primary: label || "BT", badge: "📶", secondary: shortHint(param, 16) };
    }
    if (/output/i.test(behavior)) {
      return { kind: "output", primary: label || "Out", badge: "🔌", secondary: shortHint(param, 16) };
    }
    if (/toggle layer/i.test(behavior)) {
      const layer = layerParam(row);
      const meta = dynamicLayerMeta(layer);
      return { kind: "toggle", primary: label || meta.role || `T${layer}`, badge: meta.glyph || "🔀", secondary: `Toggle L${layer}` };
    }
    if (/momentary layer/i.test(behavior)) {
      const layer = layerParam(row);
      const meta = dynamicLayerMeta(layer);
      return { kind: "momentary", primary: label || meta.role || `M${layer}`, badge: meta.glyph || "👆", secondary: `Hold L${layer}` };
    }
    if (/to layer/i.test(behavior)) {
      const layer = layerParam(row);
      if (layer === "0") return { kind: "home", primary: "Exit", badge: "🏠", secondary: "To L0" };
      if (layer === "7") return { kind: "game", primary: "Game", badge: "🎮", secondary: "To L7" };
      return { kind: "jump", primary: label || `L${layer}`, badge: "➡️", secondary: `To L${layer}` };
    }

    if (/leftarrow|←/i.test(combined)) return { kind: "arrow", primary: "←", badge: "", secondary: shortHint(modifiers, 12) };
    if (/rightarrow|→/i.test(combined)) return { kind: "arrow", primary: "→", badge: "", secondary: shortHint(modifiers, 12) };
    if (/uparrow|↑/i.test(combined)) return { kind: "arrow", primary: "↑", badge: "", secondary: shortHint(modifiers, 12) };
    if (/downarrow|↓/i.test(combined)) return { kind: "arrow", primary: "↓", badge: "", secondary: shortHint(modifiers, 12) };

    if (/key press/i.test(behavior)) {
      const hostPrimary = hostPrimaryForPrintable(label, param);
      const primary = hostPrimary || label || param.replace(/^Keyboard\s+/i, "").split(" and ")[0] || "?";
      const shortcutHint = modifiers ? shortHint(hostShortcutForRow(row) || modifiers, 14) : "";
      if (/^f\d{1,2}$/i.test(primary)) {
        const fBadge = modifiers ? "🎹" : "";
        return { kind: "function", primary: primary.toUpperCase(), badge: fBadge, secondary: shortcutHint };
      }
      if (/shift|ctrl|control|alt|gui|win/i.test(`${primary} ${label}`)) {
        return { kind: "modifier", primary: label || primary, badge: "⇧", secondary: shortcutHint };
      }
      if (/space|spacebar|␣/i.test(`${primary} ${label}`)) {
        return { kind: "space", primary: "␣", badge: "", secondary: shortcutHint };
      }
      if (/enter|return|ret/i.test(`${primary} ${label}`)) {
        return { kind: "enter", primary: "↵", badge: "", secondary: shortcutHint };
      }
      if (/delete|bksp|backspace/i.test(`${primary} ${label}`)) {
        const delEmoji = /base typing/i.test(clean(row.purpose)) ? "" : "🗑️";
        return { kind: "edit", primary: label || "Del", badge: delEmoji, secondary: shortcutHint };
      }
      if (/tab/i.test(`${primary} ${label}`)) {
        const tabEmoji = /base typing/i.test(clean(row.purpose)) ? "" : "↔️";
        return { kind: "edit", primary: "Tab", badge: tabEmoji, secondary: shortcutHint };
      }
      if (/escape|esc/i.test(`${primary} ${label}`)) {
        const escEmoji = /base typing/i.test(clean(row.purpose)) ? "" : "🚫";
        return { kind: "edit", primary: "Esc", badge: escEmoji, secondary: shortcutHint };
      }
      if (/^[a-z]$/i.test(primary) && modifiers) {
        const singleMatch = matchSingleLetterAction(primary, modifiers);
        if (singleMatch) {
          return { kind: "letter", primary: singleMatch.action, badge: singleMatch.emoji, secondary: shortcutHint };
        }
      }
      const keyEmoji = keycapEmoji(primary, modifiers, clean(row.purpose));
      if (keyEmoji) {
        return { kind: "letter", primary, badge: keyEmoji, secondary: shortcutHint };
      }
      return {
        kind: "letter",
        primary,
        badge: "",
        secondary: shortcutHint
      };
    }

    return { kind: "action", primary: label || "?", badge: "···", secondary: shortHint(behavior, 16) };
  }

  function behaviorKind(row) {
    return classifyKey(row).kind;
  }

  function behaviorCaption(row) {
    return classifyKey(row).secondary || clean(row.behavior) || clean(row.visual_label);
  }

  function visualFor(row) {
    return classifyKey(row);
  }

  function lowerBindingFor(row) {
    const layer = Number(row?.layer || 0);
    if (!Number.isFinite(layer) || layer <= 0) return null;
    for (let lower = layer - 1; lower >= 0; lower--) {
      const lowerRows = state.rowsByLayer.get(String(lower)) || [];
      const candidate = lowerRows.find((item) => item.x === row.x && item.y === row.y);
      if (candidate && !/transparent|none/i.test(candidate.behavior)) return candidate;
    }
    return null;
  }

  function transparentFallthroughLabel(row) {
    const lower = lowerBindingFor(row);
    if (!lower) return "";
    return clean(lower.visual_label) || clean(lower.parameter) || clean(lower.behavior);
  }

  function rowSearchText(row) {
    return [
      row.layer,
      row.layer_role,
      row.dynamic_role,
      transparentFallthroughLabel(row),
      row.app,
      row.category,
      row.visual_label,
      row.behavior,
      row.parameter,
      row.modifiers,
      row.purpose,
      row.usage_notes
    ].map(clean).join(" ").toLowerCase();
  }

  function isImportant(row) {
    return !/transparent|none/i.test(row.behavior)
      && (/layer|mouse|bluetooth|output|reset|bootloader|studio/i.test(`${row.behavior} ${row.visual_label} ${row.purpose}`)
        || row.modifiers
        || /workflow|navigation|debug|system|window|scroll|mouse|layer_access/i.test(`${row.dynamic_role} ${row.category} ${row.app}`));
  }

  function numberSort(a, b) {
    return Number(a) - Number(b);
  }

  function rowApp(row) {
    const notes = clean(row.usage_notes);
    const appMatch = notes.match(/\bApp:\s*([^,;]+)/i);
    if (appMatch) return clean(appMatch[1]);
    return clean(row.app || "");
  }

  function rowCategory(row) {
    return clean(row.category || "");
  }

  function inferRowTags(row) {
    const text = `${row.visual_label} ${row.behavior} ${row.parameter} ${row.purpose} ${row.usage_notes}`.toLowerCase();
    const tags = [];
    if (/base typing key|_base_|permanent l0/i.test(text)) tags.push("base");
    if (/mouse key press|\bmb[1-5]\b|click|mouse/i.test(text)) tags.push("mouse");
    if (/scroll|layer::6|trackball scroll/i.test(text)) tags.push("scroll");
    if (/leftarrow|rightarrow|uparrow|downarrow|pageup|pagedown|\bhome\b|\bend\b|navigation/i.test(text)) tags.push("nav");
    if (/win\+|window|desktop|taskbar|snap|system tray|notification/i.test(text)) tags.push("window");
    if (/bluetooth|output|reset|bootloader|studio|system|settings|device/i.test(text)) tags.push("system");
    if (/code|debug|terminal|vscode|developer|git|source control|command palette/i.test(text)) tags.push("code");
    if (/game|rpg/i.test(text)) tags.push("game");
    if (/travel|speed/i.test(text)) tags.push("travel");
    if (/layer access|momentary layer|toggle layer|to layer|coach_/i.test(text)) tags.push("access");
    return tags;
  }

  function dominantEntries(counter, max = 3) {
    return [...counter.entries()]
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, max);
  }

  function classifyLayerProfile(layer, rows) {
    const activeRows = rows.filter((row) => !/transparent|none/i.test(row.behavior));
    const tagCounts = new Map();
    const appCounts = new Map();
    const categoryCounts = new Map();
    for (const row of activeRows) {
      for (const tag of inferRowTags(row)) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      const app = rowApp(row);
      const category = rowCategory(row);
      if (app) appCounts.set(app, (appCounts.get(app) || 0) + 1);
      if (category) categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    }
    const total = Math.max(1, activeRows.length);
    const score = (tag) => (tagCounts.get(tag) || 0) / total;
    let kind = "utility";
    if (score("base") > 0.45 && layer === "0") kind = "base";
    else if (score("game") > 0.18 || (layer === "7" && score("nav") > 0.2)) kind = "game";
    else if (score("mouse") > 0.16) kind = "mouse";
    else if (score("scroll") > 0.16) kind = "scroll";
    else if (score("code") > 0.2) kind = "code";
    else if (score("window") > 0.18) kind = "window";
    else if (score("system") > 0.16) kind = "system";
    else if (score("nav") > 0.2) kind = "nav";
    else if (appCounts.size > 0) kind = "app";

    const topApps = dominantEntries(appCounts, 3);
    const topCats = dominantEntries(categoryCounts, 3);
    const meta = LAYER_KIND_META[kind] || LAYER_KIND_META.utility;
    const appText = topApps.map(([name]) => name).join(" / ");
    const catText = topCats.map(([name]) => name).join(" / ");
    const role = appText || catText || meta.title;
    return {
      layer,
      kind,
      glyph: meta.glyph,
      color: meta.color,
      title: `${meta.title}${role && role !== meta.title ? ` · ${role}` : ""}`,
      role,
      activeCount: activeRows.length,
      totalCount: rows.length,
      topApps,
      topCats,
      tags: dominantEntries(tagCounts, 6)
    };
  }

  function normalizeRows(rows) {
    return rows.map((row) => {
      const normalized = { ...row };
      normalized.layer = clean(normalized.layer);
      normalized.x = clean(normalized.x);
      normalized.y = clean(normalized.y);
      normalized.visual_label = clean(normalized.visual_label || normalized.label);
      normalized.behavior = clean(normalized.behavior);
      normalized.parameter = clean(normalized.parameter);
      normalized.modifiers = clean(normalized.modifiers);
      normalized.purpose = clean(normalized.purpose);
      normalized.usage_notes = clean(normalized.usage_notes);
      normalized.app = rowApp(normalized);
      normalized.category = rowCategory(normalized);
      return normalized;
    });
  }

  function groupRows() {
    state.rowsByLayer.clear();
    state.layerProfiles.clear();
    LAYERS = [...new Set(state.rows.map((row) => row.layer).filter(Boolean))].sort(numberSort);
    for (const layer of LAYERS) state.rowsByLayer.set(layer, []);
    for (const row of state.rows) {
      if (!state.rowsByLayer.has(row.layer)) state.rowsByLayer.set(row.layer, []);
      state.rowsByLayer.get(row.layer).push(row);
    }
    LAYERS = [...state.rowsByLayer.keys()].sort(numberSort);
    for (const layer of LAYERS) {
      const profile = classifyLayerProfile(layer, state.rowsByLayer.get(layer) || []);
      state.layerProfiles.set(layer, profile);
      for (const row of state.rowsByLayer.get(layer) || []) {
        row.dynamic_role = profile.role;
        row.layer_kind = profile.kind;
      }
    }
  }

  function layerRole(layer) {
    const profile = state.layerProfiles.get(String(layer));
    if (profile?.role) return profile.role;
    const rows = state.rowsByLayer.get(layer) || [];
    return clean(rows[0]?.layer_role || state.layoutSpec.layers?.[layer] || `Layer ${layer}`);
  }

  function renderLayerTabs() {
    els.layerTabs.innerHTML = "";
    for (const layer of LAYERS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "layer-tab";
      button.dataset.layer = layer;
      const tabMeta = dynamicLayerMeta(layer);
      button.title = tabMeta.title;
      button.innerHTML = `<strong class="layer-tab-num">${layer}</strong><span class="layer-tab-glyph">${escapeHtml(tabMeta.glyph)}</span><span class="layer-tab-role">${escapeHtml(shortLayerRole(tabMeta.role))}</span>`;
      button.addEventListener("click", () => {
        pinDisplayedLayer(layer);
      });
      els.layerTabs.appendChild(button);
    }
  }

  function shortLayerRole(role) {
    return clean(role).replace(" and ", " / ").replace("Window, app, language, mouse/game/travel control", "Window");
  }

  function dynamicLayerMeta(layer) {
    const profile = state.layerProfiles.get(String(layer));
    if (!profile) return { ...LAYER_KIND_META.utility, role: layerRole(layer), title: layerRole(layer) };
    return {
      glyph: profile.glyph,
      title: `Layer ${layer}: ${profile.title}`,
      role: profile.role || profile.title,
      color: profile.color
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function keyId(row) {
    return `${row.layer}:${row.x}:${row.y}`;
  }

  function renderKeyboard() {
    els.keyboardMap.innerHTML = "";
    const rows = state.rowsByLayer.get(state.displayedLayer) || [];
    const rowMap = new Map(rows.map((row) => [`${row.x}:${row.y}`, row]));
    els.keyboardMap.appendChild(renderHand("left", X_LEFT, rowMap));
    els.keyboardMap.appendChild(renderHand("right", X_RIGHT, rowMap));
    applyFilters();
  }

  function renderHand(side, xs, rowMap) {
    const hand = document.createElement("div");
    hand.className = `hand ${side}`;
    for (let y = 0; y <= 5; y++) {
      for (const x of xs) {
        const row = rowMap.get(`${x}:${y}`);
        if (!row) {
          const spacer = document.createElement("div");
          spacer.className = "key-spacer";
          hand.appendChild(spacer);
          continue;
        }
        const visual = visualFor(row);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `keycap kind-${visual.kind}`;
        if (visual.kind === "danger") button.classList.add("warning");
        if (visual.kind === "transparent") button.classList.add("transparent");
        button.dataset.search = rowSearchText(row);
        button.dataset.important = String(isImportant(row));
        button.dataset.keyId = keyId(row);
        button.title = `${clean(row.visual_label)} — ${clean(row.behavior)} — ${outputDisplayForRow(row)}`;
        const badgeHtml = visual.badge
          ? `<span class="key-badge" aria-hidden="true">${escapeHtml(visual.badge)}</span>`
          : "";
        const secondaryHtml = visual.secondary
          ? `<div class="key-secondary">${escapeHtml(visual.secondary)}</div>`
          : "";
        button.innerHTML = [
          badgeHtml,
          `<div class="key-primary">${escapeHtml(visual.primary)}</div>`,
          secondaryHtml
        ].join("");
        button.addEventListener("click", () => onUserSelectKey(row));
        hand.appendChild(button);
      }
    }
    return hand;
  }

  function selectKey(row) {
    state.selectedKey = row;
    const visual = visualFor(row);
    els.selectedIcon.className = `behavior-icon kind-${visual.kind}`;
    els.selectedIcon.textContent = visual.badge || visual.primary.slice(0, 3);
    els.selectedTitle.textContent = clean(row.visual_label) || "Unnamed key";
    els.selectedSubtitle.textContent = `Layer ${row.layer} - x${row.x} y${row.y}`;
    els.selectedBehavior.textContent = clean(row.behavior) || "-";
    els.selectedOutput.textContent = outputDisplayForRow(row);
    els.selectedModifiers.textContent = clean(row.modifiers) || "-";
    els.selectedPurpose.textContent = clean(row.purpose) || "-";
    els.selectedNotes.textContent = clean(row.usage_notes) || "-";
    document.querySelectorAll(".keycap.selected").forEach((el) => el.classList.remove("selected"));
    document.querySelector(`[data-key-id="${CSS.escape(keyId(row))}"]`)?.classList.add("selected");
  }

  function renderApps() {
    els.appList.innerHTML = "";
    for (const app of state.apps) {
      const chip = document.createElement("span");
      chip.className = "app-chip";
      chip.title = app.notes || app.id;
      chip.textContent = app.aliases?.[0] || app.id;
      els.appList.appendChild(chip);
    }
  }

  function applyFilters() {
    const query = state.query.toLowerCase();
    document.querySelectorAll(".keycap").forEach((el) => {
      const matchesSearch = !query || el.dataset.search.includes(query);
      const matchesFocus = !state.focusImportant || el.dataset.important === "true";
      el.classList.toggle("filtered-out", !(matchesSearch && matchesFocus));
    });
  }

  function renderStatus() {
    els.activeLayer.textContent = state.liveLayer || state.displayedLayer || "0";
    try { updateRailStrip(); } catch {}
    document.querySelectorAll(".layer-tab").forEach((tab) => {
      const layer = tab.dataset.layer;
      tab.classList.toggle("active", layer === state.displayedLayer);
      tab.classList.toggle("pinned", layer === state.pinnedLayer);
      tab.classList.toggle("live", layer === state.liveLayer && layer !== state.displayedLayer);
    });
    document.querySelectorAll(".keycap.beacon-live-key, .keycap.beacon-source-key").forEach((el) => {
      el.classList.remove("beacon-live-key", "beacon-source-key");
    });
    const liveKey = state.lastState?.lastKey;
    if (liveKey?.layer && liveKey.x !== "" && liveKey.y !== "") {
      const selector = `[data-key-id="${CSS.escape(`${liveKey.layer}:${liveKey.x}:${liveKey.y}`)}"]`;
      const keyEl = document.querySelector(selector);
      if (keyEl) {
        const onDisplayedLayer = String(liveKey.layer) === state.displayedLayer;
        keyEl.classList.add(onDisplayedLayer ? "beacon-live-key" : "beacon-source-key");
      }
    }
  }

  function renderEvents() {
    els.eventList.innerHTML = "";
    for (const event of state.events.slice(0, MAX_EVENTS)) {
      const li = document.createElement("li");
      const when = event.updatedAt ? new Date(event.updatedAt) : new Date();
      li.innerHTML = `<time>${escapeHtml(when.toLocaleTimeString())}</time>${escapeHtml(event.lastAction || "State update")}`;
      els.eventList.appendChild(li);
    }
  }

  function beaconAgeMs(live, field) {
    if (!live) return Number.POSITIVE_INFINITY;
    const ts = live[field] || (field === "beaconHeartbeatAt" ? live.updatedAt : "");
    if (!ts) return Number.POSITIVE_INFINITY;
    const parsed = Date.parse(ts);
    if (Number.isNaN(parsed)) return Number.POSITIVE_INFINITY;
    return Math.max(0, Date.now() - parsed);
  }

  function beaconStatus(live) {
    const restartHint = "Run scripts\\windows\\start_charybdis_coach.ps1 or restart_beacon_listener.ps1.";
    if (!live) {
      return {
        level: "error",
        alive: false,
        stale: true,
        ageSec: null,
        title: "Beacon not detected",
        detail: `No state file from the beacon listener. ${restartHint}`,
        transportLabel: "No beacon",
        source: ""
      };
    }

    const hasHeartbeat = live.beaconHeartbeatAt != null && live.beaconHeartbeatAt !== "";
    const hasBeaconMeta = live.beaconAlive === true || Boolean(live.beaconSource) || hasHeartbeat;
    const heartbeatAgeMs = beaconAgeMs(live, "beaconHeartbeatAt");
    const updateAgeMs = beaconAgeMs(live, "updatedAt");
    const ageMs = hasHeartbeat ? heartbeatAgeMs : updateAgeMs;
    const ageSec = Number.isFinite(ageMs) ? Math.max(0, Math.round(ageMs / 1000)) : null;
    const explicitDead = live.beaconAlive === false;
    const stale = explicitDead || ageMs > BEACON_STALE_MS;
    const source = clean(live.beaconSource) || (hasBeaconMeta ? "listener" : "");

    if (stale) {
      const level = !hasBeaconMeta || explicitDead || (ageSec != null && ageSec > BEACON_STALE_MS * 2)
        ? "error"
        : "warn";
      const title = explicitDead ? "Beacon listener stopped" : "Beacon not responding";
      let detail = `Layer thumb sync is offline`;
      if (ageSec != null) detail += ` (${ageSec}s since last signal)`;
      if (source) detail += `. Last source: ${source}`;
      if (!hasBeaconMeta) detail += ". State file has no beacon heartbeat — listener may be dead or an old build.";
      detail += `. ${restartHint}`;
      return {
        level,
        alive: false,
        stale: true,
        ageSec,
        title,
        detail,
        transportLabel: ageSec != null ? `No beacon (${ageSec}s)` : "No beacon",
        source
      };
    }

    const transportBase = clean(live.transport) || "USB";
    const transportLabel = hasBeaconMeta ? `Beacon live · ${transportBase}` : transportBase;
    return {
      level: "ok",
      alive: true,
      stale: false,
      ageSec,
      title: "Beacon connected",
      detail: source
        ? `Layer sync active (${source}, PID ${live.beaconPid ?? "?"})`
        : "Layer sync active",
      transportLabel,
      source
    };
  }

  function beaconListenerStale(live) {
    return beaconStatus(live).stale;
  }

  function renderBeaconBanner(live) {
    if (!els.beaconBanner) return;
    const status = beaconStatus(live);
    const show = status.stale;
    els.beaconBanner.hidden = !show;
    els.beaconBanner.classList.toggle("beacon-banner--hidden", !show);
    els.beaconBanner.classList.remove("beacon-banner--ok", "beacon-banner--warn", "beacon-banner--error");
    if (show) {
      els.beaconBanner.classList.add(`beacon-banner--${status.level}`);
    }
    if (els.beaconBannerTitle) els.beaconBannerTitle.textContent = status.title;
    if (els.beaconBannerDetail) els.beaconBannerDetail.textContent = status.detail;
  }

  function renderNow() {
    const live = state.lastState;
    const beacon = beaconStatus(live);
    const liveObj = live || {};
    els.activeApp.textContent = clean(liveObj.activeApp) || "Unknown";
    els.lastAction.textContent = clean(liveObj.lastAction) || "Ready";
    const ageSec = liveObj.updatedAt
      ? Math.max(0, Math.round((Date.now() - Date.parse(liveObj.updatedAt)) / 1000))
      : null;
    els.transport.textContent = beacon.transportLabel;
    els.heldLayers.textContent = formatList(liveObj.heldLayers);
    els.lockedLayer.textContent = clean(liveObj.lockedLayer) || "-";
    els.toggledLayers.textContent = formatList(liveObj.toggledLayers);
    els.stateAge.textContent = ageSec != null ? `${ageSec}s` : "-";

    if (els.transport) {
      els.transport.title = beacon.stale
        ? beacon.detail
        : (clean(state.layoutSpec?.host_keyboard?.primary)
          ? "Beacon listener updating layer state; coach matches physical keys (event.code) for Norwegian Windows"
          : beacon.detail);
      els.transport.classList.toggle("stale-sync", beacon.stale);
      els.transport.classList.toggle("beacon-down", beacon.stale);
      els.transport.classList.toggle("beacon-live", beacon.alive);
    }
    renderBeaconBanner(live);
  }

  function formatList(value) {
    if (Array.isArray(value) && value.length) return value.join(", ");
    return "-";
  }

  function normalizeLayerList(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item));
  }

  function deriveLiveLayer(live) {
    // Dynamic priority: explicit lock, active hold, latest toggle, then base.
    if (!live) return state.liveLayer;
    const toggled = normalizeLayerList(live.toggledLayers);
    const held = normalizeLayerList(live.heldLayers);
    if (live.lockedLayer) return String(live.lockedLayer);
    if (held.length) return held[held.length - 1];
    if (toggled.length) return toggled[toggled.length - 1];
    return "0";
  }

  function liveKeySignature(live) {
    const key = live?.lastKey;
    if (!key || key.x === "" || key.y === "") return "";
    return [
      key.layer ?? "",
      key.x ?? "",
      key.y ?? "",
      key.label ?? "",
      live.lastAction ?? ""
    ].join(":");
  }

  function pinDisplayedLayer(layer) {
    const nextLayer = String(layer);
    state.displayedLayer = nextLayer;
    state.pinnedLayer = nextLayer;
    render();
  }

  function releasePinnedLayer() {
    if (!state.pinnedLayer) return;
    state.pinnedLayer = null;
    if (state.liveLayer && state.displayedLayer !== state.liveLayer) {
      state.displayedLayer = state.liveLayer;
      render();
      return;
    }
    updateRailStrip();
    renderStatus();
  }

  function pushEvent(live) {
    if (!live?.lastAction) return;
    const last = state.events[0];
    if (last && last.lastAction === live.lastAction && last.updatedAt === live.updatedAt) return;
    state.events.unshift({ lastAction: live.lastAction, updatedAt: live.updatedAt });
    state.events = state.events.slice(0, MAX_EVENTS);
  }

  async function pollState() {
    const stateUrl = window.CHARYBDIS_STATE_URL || "../charybdis-tools/runtime/charybdis_state.json";
    const live = await loadJson(stateUrl, null);
    state.lastState = live;
    if (live) {
      const newLiveLayer = deriveLiveLayer(live);
      const keySignature = liveKeySignature(live);
      if (state.pinnedLayer && keySignature && state.lastLiveKeySignature && keySignature !== state.lastLiveKeySignature) {
        state.pinnedLayer = null;
      }
      if (keySignature) state.lastLiveKeySignature = keySignature;

      const held = normalizeLayerList(live.heldLayers);
      const locked = live.lockedLayer ? String(live.lockedLayer) : "";
      const toggled = normalizeLayerList(live.toggledLayers);
      // Always show the layer the keyboard is actually on; lastKey highlights the thumb source key.
      const preferredDisplay = state.pinnedLayer || newLiveLayer;
      const layerChanged = newLiveLayer !== state.liveLayer;
      const displayChanged = preferredDisplay !== state.displayedLayer;

      if (layerChanged || displayChanged) {
        state.liveLayer = newLiveLayer;
        state.displayedLayer = preferredDisplay;
        render();
      } else {
        state.liveLayer = newLiveLayer;
        renderNow();
        renderStatus();
      }

      pushEvent(live);
      renderEvents();
    }
    renderNow();
  }

  function render() {
    renderLayerTabs();
    renderKeyboard();
    renderStatus();
    if (state.selectedKey && state.selectedKey.layer === state.displayedLayer) {
      selectKey(state.selectedKey);
    } else {
      const first = (state.rowsByLayer.get(state.displayedLayer) || []).find((row) => behaviorKind(row) !== "transparent");
      if (first) selectKey(first);
    }
  }

  // ----- Workflow guide -----
  const workflowState = { index: null, apps: new Map(), activeApp: null, query: "" };

  async function loadWorkflowIndex() {
    workflowState.index = await loadJson("./workflows/index.json", { apps: [] });
    if (!els.workflowAppSelect) return;
    els.workflowAppSelect.innerHTML = '<option value="">Select an app...</option>';
    for (const app of (workflowState.index.apps || [])) {
      const opt = document.createElement("option");
      opt.value = app.id;
      opt.textContent = app.name;
      els.workflowAppSelect.appendChild(opt);
    }
  }

  async function loadWorkflowApp(appId) {
    if (!appId) { workflowState.activeApp = null; renderWorkflow(); return; }
    if (!workflowState.apps.has(appId)) {
      const entry = (workflowState.index.apps || []).find((a) => a.id === appId);
      if (!entry) return;
      const data = await loadJson(`./workflows/${entry.file}`, null);
      if (data) workflowState.apps.set(appId, data);
    }
    workflowState.activeApp = workflowState.apps.get(appId) || null;
    renderWorkflow();
  }

  const ACTION_EMOJI_MAP = [
    [/\bcopy\b/i, "📄"],
    [/\bpaste\b/i, "📥"],
    [/\bcut\b/i, "✂️"],
    [/\bundo\b/i, "↩️"],
    [/\bredo\b/i, "↪️"],
    [/\bsave\b/i, "💾"],
    [/\bprint\b/i, "🖨️"],
    [/\bsearch\b|quick search/i, "🔍"],
    [/\bfind\b/i, "🔎"],
    [/\breplace\b/i, "🔁"],
    [/\bdelete\b|clear cell/i, "🗑️"],
    [/\brename\b/i, "✏️"],
    [/\bnew tab\b/i, "➕"],
    [/\bclose tab\b|close editor\b|close pane/i, "❌"],
    [/\bnext tab\b|switch.*tab/i, "⏭️"],
    [/\bprevious tab\b/i, "⏮️"],
    [/\breopen closed tab\b|restore closed/i, "♻️"],
    [/\bnew window\b/i, "🪟"],
    [/\bnew file\b|new document\b|new page\b|new item/i, "🆕"],
    [/\bnew folder\b/i, "📁"],
    [/\bnew chat\b|new message/i, "🗨️"],
    [/\bnew slide\b/i, "🖼️"],
    [/\bopen file\b|open document\b|open selected/i, "📂"],
    [/\brefresh\b|reload/i, "🔃"],
    [/\bbookmark\b/i, "⭐"],
    [/\bfavorites\b/i, "💛"],
    [/\bhistory\b/i, "🕰️"],
    [/\bdownload\b/i, "💿"],
    [/\bzoom in\b/i, "🔭"],
    [/\bzoom out\b/i, "🔬"],
    [/\breset zoom\b|zoom 100/i, "🔭"],
    [/\bfullscreen\b/i, "🔲"],
    [/\bbold\b/i, "🅱️"],
    [/\bitalic\b/i, "🔤"],
    [/\bunderline\b/i, "🔡"],
    [/\bstrikethrough\b/i, "✖️"],
    [/\bformat\b/i, "🎨"],
    [/\bcomment\b/i, "💬"],
    [/\bsend message\b|^send\b|send \(/i, "📨"],
    [/\breply\b/i, "↩️"],
    [/\bforward\b(?!.*pane)/i, "➡️"],
    [/\bback\b(?!ground)|go back|navigate back/i, "⬅️"],
    [/\battach\b/i, "📎"],
    [/\bupload\b/i, "☁️"],
    [/\binsert link\b|hyperlink\b/i, "🔗"],
    [/\binsert.*date\b/i, "📅"],
    [/\binsert.*time\b/i, "🕐"],
    [/\bemoji\b/i, "😀"],
    [/\bclipboard history\b/i, "🗂️"],
    [/\bscreenshot\b|snip\b/i, "📸"],
    [/\block pc\b/i, "🔒"],
    [/\bvoice typing\b/i, "🎙️"],
    [/\bcopilot\b/i, "🤖"],
    [/\btask manager\b/i, "📊"],
    [/\bsettings\b|settings menu/i, "⚙️"],
    [/\bnotification\b/i, "🔔"],
    [/\bmute\b|toggle mute/i, "🔇"],
    [/\bcamera\b|toggle camera/i, "📷"],
    [/\bscreen share\b/i, "📡"],
    [/\braise.*hand|lower.*hand/i, "✋"],
    [/\bhang up\b|end call\b/i, "📵"],
    [/\baccept call\b/i, "🟢"],
    [/\bdecline call\b/i, "🔴"],
    [/\brecording\b|start recording/i, "⏺️"],
    [/\bstart.*debug\b|continue debug/i, "▶️"],
    [/\bstop debug\b/i, "⏹️"],
    [/\bbreakpoint\b/i, "🔴"],
    [/\bstep over\b/i, "👟"],
    [/\bstep into\b/i, "⤵️"],
    [/\bstep out\b/i, "⤴️"],
    [/\brestart debug\b/i, "🔁"],
    [/\bcommand palette\b/i, "🪄"],
    [/\bquick open\b|quick switcher/i, "⚡"],
    [/\btoggle terminal\b/i, "⬛"],
    [/\bnew terminal\b/i, "⬛"],
    [/\btoggle sidebar\b/i, "📐"],
    [/\bsplit\b.*editor|split pane/i, "↔️"],
    [/\bgo to definition\b/i, "🎯"],
    [/\bpeek definition\b/i, "👁️"],
    [/\bgo to line\b|go to page/i, "📍"],
    [/\bgo to symbol\b/i, "🔣"],
    [/\bexplorer panel\b/i, "📂"],
    [/\bsource control\b/i, "🌿"],
    [/\bextensions panel\b/i, "🧩"],
    [/\bproblems panel\b/i, "⚠️"],
    [/\bnext problem\b/i, "🚨"],
    [/\bprevious problem\b/i, "🚨"],
    [/\bselect all\b/i, "🔲"],
    [/\bindent\b/i, "➡️"],
    [/\boutdent\b/i, "⬅️"],
    [/\bmove line\b/i, "↕️"],
    [/\bcopy line\b/i, "🔂"],
    [/\bdelete line\b/i, "🗑️"],
    [/\binsert line\b/i, "➕"],
    [/\bswitch apps\b/i, "🔀"],
    [/\bclose window\b/i, "❌"],
    [/\bshow.*desktop\b/i, "🏠"],
    [/\btask view\b/i, "🪟"],
    [/\bsnap window\b/i, "🧲"],
    [/\bmaximize\b/i, "⏫"],
    [/\bminimize\b/i, "⏬"],
    [/\bmove to.*monitor\b/i, "🖥️"],
    [/\bvirtual desktop\b|new virtual/i, "🆕"],
    [/\bswitch desktop\b/i, "🔀"],
    [/\bclose.*desktop\b/i, "❌"],
    [/\bfile explorer\b/i, "📁"],
    [/\brun dialog\b/i, "▶️"],
    [/\bpower user\b/i, "⚡"],
    [/\bswitch.*language\b|switch.*input/i, "🌐"],
    [/\bactivity\b/i, "📊"],
    [/\bchat\b/i, "🗨️"],
    [/\bcalendar\b|appointment|meeting/i, "📅"],
    [/\bcalls\b/i, "📞"],
    [/\bfiles\b/i, "📁"],
    [/\bmail\b|inbox/i, "📧"],
    [/\bmark as read\b/i, "👁️"],
    [/\bmark as unread\b/i, "📩"],
    [/\bflag\b|follow up/i, "🚩"],
    [/\bspell check\b/i, "📝"],
    [/\bnumber format\b|currency format|percent format|general format/i, "💲"],
    [/\bformula\b|autosum/i, "🧮"],
    [/\bcalculate\b/i, "🧮"],
    [/\bfill down\b|fill right\b/i, "⬇️"],
    [/\bparent folder\b|go up/i, "⬆️"],
    [/\bhide.*rows\b|hide.*columns\b/i, "👁️‍🗨️"],
    [/\bunhide\b/i, "👁️"],
    [/\binsert cell|insert.*row|insert.*column/i, "➕"],
    [/\bdelete cell|delete.*row|delete.*column/i, "🗑️"],
    [/\bgroup\b/i, "📦"],
    [/\bungroup\b/i, "📦"],
    [/\bduplicate\b/i, "🔂"],
    [/\bslideshow\b|start from\b/i, "▶️"],
    [/\bend slideshow\b/i, "⏹️"],
    [/\bnext slide\b/i, "⏭️"],
    [/\bprevious slide\b/i, "⏮️"],
    [/\bblack screen\b/i, "⬛"],
    [/\bwhite screen\b/i, "⬜"],
    [/\bcheck out\b/i, "🔓"],
    [/\bcheck in\b/i, "🔐"],
    [/\bundo checkout\b/i, "↩️"],
    [/\bversion history\b/i, "📜"],
    [/\bworkflow\b/i, "🔄"],
    [/\bassign\b/i, "👤"],
    [/\bnotif/i, "🔔"],
    [/\brelationship\b/i, "🔗"],
    [/\bvault\b/i, "🏦"],
    [/\bobject info\b/i, "ℹ️"],
    [/\bcopy.*link\b|copy.*path\b|copy.*url\b/i, "🔗"],
    [/\bhuddle\b/i, "🎧"],
    [/\bdeafen\b/i, "🔈"],
    [/\bautofill\b|login/i, "🔑"],
    [/\bdevtools\b|inspect/i, "🛠️"],
    [/\bconsole\b/i, "⬛"],
    [/\bdevice toolbar\b/i, "📱"],
    [/\bread aloud\b/i, "🔊"],
    [/\bview.*source\b|page source/i, "🔬"],
    [/\bscroll\b/i, "📜"],
    [/\bfocus.*input\b|focus.*address/i, "📍"],
    [/\bautocomplete\b/i, "⚡"],
    [/\bprevious command\b|next command/i, "📜"],
    [/\bclear screen\b/i, "🧹"],
    [/\breverse search\b/i, "🔍"],
    [/\bpreview pane\b/i, "👁️"],
    [/\bproperties\b|metadata/i, "🏷️"],
    [/\bexport\b/i, "📤"],
    [/\btoggle ui\b/i, "👁️"],
    [/\bmove tool\b/i, "↔️"],
    [/\bframe tool\b/i, "🖼️"],
    [/\brectangle\b/i, "⬜"],
    [/\btext tool\b/i, "✏️"],
    [/\bpen tool\b/i, "🖊️"],
    [/\beyedropper\b/i, "💧"],
    [/\bhand.*pan\b/i, "✋"],
    [/\bto do\b/i, "☑️"],
    [/\bnew line\b/i, "↵"],
    [/\bpage break\b/i, "📃"],
    [/\balign\b/i, "📐"],
    [/\bspacing\b/i, "📏"],
    [/\bnormal style\b/i, "📝"],
    [/\bhelp\b/i, "❓"],
    [/\bkeyboard shortcuts\b|show shortcuts/i, "⌨️"],
    [/\bblur\b|background blur/i, "🌫️"],
    [/\binprivate\b|incognito\b/i, "🕶️"],
    [/\bopen.*pinned\b|taskbar\b|system tray/i, "📌"],
    [/\babsolute ref\b/i, "📌"],
    [/\barray formula\b/i, "📊"],
    [/\bshow.*formula\b/i, "📊"],
    [/\bedit cell\b/i, "✏️"],
    [/\bcancel\b/i, "❌"],
    [/\bnext section\b|previous section/i, "📑"],
    [/\bexpand\b/i, "📐"],
    [/\bconnect\b|cast\b/i, "📡"],
    [/\bproject.*display/i, "📺"],
    [/\bquick settings\b|action center/i, "⚙️"],
    [/\bedit last/i, "✏️"],
    [/\bselect.*occurrence/i, "🔦"],
    [/\bjump to.*bracket/i, "🔗"],
    [/\bformat selection\b|format document/i, "🎨"],
    [/\baccept suggestion\b/i, "✅"],
  ];

  const CATEGORY_EMOJI_MAP = {
    "Window Management": "🪟",
    "Virtual Desktops": "🖥️",
    "System Shortcuts": "🔧",
    "Taskbar": "📌",
    "Input & Language": "🌐",
    "Universal Clipboard & Edit": "📋",
    "Clipboard & Edit": "📋",
    "Tab Management": "📑",
    "Navigation": "🧭",
    "Find & Page": "🔎",
    "Zoom & View": "🔍",
    "Developer Tools": "🛠️",
    "Vimium Extension": "⌨️",
    "Proton Pass Extension": "🔑",
    "Edge Specific": "🌐",
    "General": "⚙️",
    "Messaging": "💬",
    "Meetings & Calls": "📞",
    "File Operations": "📁",
    "Editing": "✏️",
    "Multi-cursor": "🖊️",
    "Search & Replace": "🔎",
    "Search & Navigation": "🔍",
    "Debug": "🐛",
    "Selection": "⬛",
    "Formatting": "🎨",
    "Rows & Columns": "📊",
    "Formulas": "🧮",
    "View & Search": "🔍",
    "Mail Navigation": "📧",
    "Mail Actions": "📨",
    "Calendar": "📅",
    "Tabs & Panes": "📑",
    "Terminal Actions": "💻",
    "Zoom & Settings": "⚙️",
    "Slideshow": "▶️",
    "Tools": "🔧",
    "Objects": "📦",
    "View": "👁️",
    "Document Operations": "📄",
    "Metadata & Properties": "📋",
    "Views & Selection": "👁️",
    "Workflow & Assignments": "🔄",
    "Admin Operations": "🔧",
    "Voice & Video": "🎥",
    "Calls": "📞",
    "Search": "🔍",
    "File": "📁",
  };

  function emojiForAction(action) {
    for (const [pattern, emoji] of ACTION_EMOJI_MAP) {
      if (pattern.test(action)) return emoji;
    }
    return "";
  }

  function emojiForCategory(name) {
    return CATEGORY_EMOJI_MAP[name] || "";
  }

  function rowForWorkflowShortcut(shortcut) {
    if (!shortcut) return null;
    const byKeys = rowForShortcutKeys(shortcut.keys, shortcut.action);
    if (byKeys) return byKeys;

    // Legacy workflow files may contain stale position hints. Use those only
    // after key/action matching fails, because evolved layouts move layers.
    if (shortcut.charybdis) {
      const layerMatch = shortcut.charybdis.match(/L(\d+)/);
      const posMatch = shortcut.charybdis.match(/x(\d+),\s*y(\d+)/);
      if (layerMatch && posMatch) {
        const layer = layerMatch[1];
        const row = (state.rowsByLayer.get(layer) || []).find((item) => item.x === posMatch[1] && item.y === posMatch[2]) || null;
        if (row && rowMatchesShortcut(row, shortcut.keys, shortcut.action)) return row;
      }
    }
    return rowForShortcutAction(shortcut.action);
  }

  function displayKeysForShortcut(shortcut) {
    const row = rowForWorkflowShortcut(shortcut);
    if (!row) {
      const gap = workflowShortcutGap(shortcut);
      return {
        display: shortcut.keys,
        original: shortcut.keys,
        row: null,
        differs: false,
        missing: true,
        gapLabel: gap.label,
        gapDetail: gap.detail
      };
    }
    const meta = hostShortcutMeta(row);
    const display = meta.host || shortcut.keys;
    return {
      display,
      original: shortcut.keys,
      row,
      differs: Boolean(display && shortcut.keys && display !== shortcut.keys)
    };
  }

  function workflowShortcutGap(shortcut) {
    const keys = clean(shortcut?.keys);
    const action = clean(shortcut?.action);
    if (/click|drag|wheel|mouse/i.test(keys)) {
      return { label: "Pointer", detail: "Pointer-modified action; not a single keyboard binding in the layout CSV" };
    }
    if (/\S+\s+\S+/.test(keys) && /ctrl|alt|shift|win|cmd/i.test(keys)) {
      return { label: "Sequence", detail: "Multi-step app chord; optimize by sequence usage, not one key slot" };
    }
    if (/^[/?a-z0-9]{1,3}$/i.test(keys) && !/[+]/.test(keys)) {
      return { label: "App keymap", detail: "Application-local command; available only when that app/keymap mode is active" };
    }
    if (/up\/down|left\/right/i.test(keys)) {
      return { label: "Pair", detail: "Shortcut family shorthand; split into individual shortcuts before direct mapping" };
    }
    return { label: "Missing", detail: action ? `No matching row found for ${action}` : "No matching row found in current layout CSV" };
  }

  function workflowLocationForRow(row) {
    if (!row) return "Not mapped in current layout";
    const layer = row.layer;
    const profile = state.layerProfiles.get(String(layer));
    const role = clean(row.dynamic_role) || clean(profile?.role) || "dynamic layer";
    const app = clean(row.app);
    const category = clean(row.category);
    const context = app || category ? ` · ${[app, category].filter(Boolean).join(" / ")}` : "";
    return `L${layer} x${row.x}, y${row.y} · ${role}${context}`;
  }

  function normalizeShortcutText(value) {
    return clean(value)
      .replace(/^Keyboard\s+/i, "")
      .replace(/\s+/g, "")
      .replace(/LeftControl|LControl|LCtrl|L Ctrl/gi, "Ctrl")
      .replace(/LeftShift|LShift|L Shift/gi, "Shift")
      .replace(/LeftAlt|LAlt|L Alt/gi, "Alt")
      .replace(/LeftGUI|Left GUI|L GUI|GUI|Meta/gi, "Win")
      .replace(/ReturnEnter|Return/gi, "Enter")
      .replace(/Delete\s+Forward/gi, "Delete")
      .replace(/Spacebar/gi, "Space")
      .toUpperCase();
  }

  function shortcutCandidatesForRow(row) {
    const candidates = new Set([
      row.visual_label,
      hostShortcutForRow(row),
      usShortcutForRow(row),
      comboDisplay(row.modifiers, clean(row.parameter).replace(/^Keyboard\s+/i, "")),
      comboDisplay(row.modifiers, usGlyphForParam(row.parameter))
    ].map(normalizeShortcutText).filter(Boolean));
    return candidates;
  }

  function rowMatchesShortcut(row, keys, action = "") {
    if (!row || /transparent|none/i.test(row.behavior)) return false;
    const wanted = normalizeShortcutText(keys);
    if (wanted && shortcutCandidatesForRow(row).has(wanted)) return true;
    const actionWords = clean(action).toLowerCase().split(/\W+/).filter((part) => part.length > 2);
    if (!actionWords.length) return false;
    const haystack = `${row.visual_label} ${row.purpose} ${row.usage_notes}`.toLowerCase();
    const hits = actionWords.filter((word) => haystack.includes(word)).length;
    return hits >= Math.min(2, actionWords.length);
  }

  function allRows() {
    return LAYERS.flatMap((layer) => state.rowsByLayer.get(layer) || []);
  }

  function rowForShortcutKeys(keys, action = "") {
    const wanted = normalizeShortcutText(keys);
    if (!wanted) return null;
    const rows = allRows().filter((row) => !/transparent|none/i.test(row.behavior));
    return rows.find((row) => shortcutCandidatesForRow(row).has(wanted) && rowMatchesShortcut(row, keys, action))
      || rows.find((row) => shortcutCandidatesForRow(row).has(wanted))
      || null;
  }

  function rowForShortcutAction(action = "") {
    const words = clean(action).toLowerCase().split(/\W+/).filter((part) => part.length > 2);
    if (!words.length) return null;
    let best = null;
    for (const row of allRows()) {
      if (/transparent|none/i.test(row.behavior)) continue;
      const haystack = `${row.visual_label} ${row.purpose} ${row.usage_notes}`.toLowerCase();
      const score = words.filter((word) => haystack.includes(word)).length;
      if (score > (best?.score || 0)) best = { row, score };
    }
    return best && best.score >= Math.min(2, words.length) ? best.row : null;
  }

  function renderWorkflow() {
    if (!els.workflowContent) return;
    const app = workflowState.activeApp;
    if (!app) {
      els.workflowContent.innerHTML = '<div class="workflow-empty">Select an app to see its shortcuts and how they map to your Charybdis layers.</div>';
      return;
    }
    const query = workflowState.query.toLowerCase();
    let html = "";
    for (const cat of (app.categories || [])) {
      const rows = cat.shortcuts.map((s) => {
        const keys = displayKeysForShortcut(s);
        const location = workflowLocationForRow(keys.row);
        const text = `${s.keys} ${s.action} ${s.charybdis || ""} ${keys.display || ""} ${location}`.toLowerCase();
        const hidden = query && !text.includes(query);
        const classes = ["workflow-shortcut"];
        if (hidden) classes.push("filtered-out");
        if (keys.missing) classes.push("missing");
        const cls = ` class="${classes.join(" ")}"`;
        const actionEmoji = emojiForAction(s.action);
        const actionDisplay = actionEmoji ? `${actionEmoji} ${s.action}` : s.action;
        const title = keys.differs
          ? ` title="${escapeHtml(`Norwegian Windows from Charybdis: ${keys.display} | App shortcut: ${keys.original}`)}"`
          : "";
        const gapTitle = keys.missing && keys.gapDetail ? ` title="${escapeHtml(keys.gapDetail)}"` : "";
        const missingBadge = keys.missing ? `<span class="workflow-missing"${gapTitle}>${escapeHtml(keys.gapLabel || "Missing")}</span>` : "";
        let row = `<div${cls}><span class="workflow-keys"${title}>${escapeHtml(keys.display)}</span><span class="workflow-action">${escapeHtml(actionDisplay)}</span>`;
        row += `<span class="workflow-charybdis">${missingBadge}${escapeHtml(location)}</span>`;
        row += "</div>";
        return { html: row, hidden };
      });
      const anyVisible = rows.some((r) => !r.hidden);
      const catEmoji = emojiForCategory(cat.name);
      const catDisplay = catEmoji ? `${catEmoji} ${cat.name}` : cat.name;
      if (anyVisible || !query) {
        html += `<div class="workflow-category"><div class="workflow-category-name">${escapeHtml(catDisplay)}</div>`;
        html += rows.map((r) => r.html).join("");
        html += "</div>";
      }
    }
    els.workflowContent.innerHTML = html || '<div class="workflow-empty">No shortcuts match your filter.</div>';
  }

  function setupWorkflow() {
    if (els.workflowAppSelect) {
      els.workflowAppSelect.addEventListener("change", (e) => {
        loadWorkflowApp(e.target.value);
        try { localStorage.setItem("charybdis-workflow-app", e.target.value); } catch {}
      });
    }
    if (els.workflowSearch) {
      els.workflowSearch.addEventListener("input", (e) => {
        workflowState.query = e.target.value || "";
        renderWorkflow();
      });
    }
    const saved = localStorage.getItem("charybdis-workflow-app");
    if (saved && els.workflowAppSelect) {
      els.workflowAppSelect.value = saved;
      loadWorkflowApp(saved);
    }
    populatePracticeAppSelect();
  }

  async function populatePracticeAppSelect() {
    if (!els.practiceAppSelect || !workflowState.index) return;
    els.practiceAppSelect.innerHTML = '<option value="">Layer mode (current layer)</option>';
    for (const entry of (workflowState.index.apps || [])) {
      const opt = document.createElement("option");
      opt.value = entry.id;
      opt.textContent = `${entry.name} shortcuts`;
      els.practiceAppSelect.appendChild(opt);
      if (!workflowState.apps.has(entry.id)) {
        const data = await loadJson(`./workflows/${entry.file}`, null);
        if (data) workflowState.apps.set(entry.id, data);
      }
    }
  }

  async function init() {
    const [csvText, layoutSpec, appsConfig, hostKeyboard] = await Promise.all([
      loadText("./data/keybindings_explained.csv"),
      loadJson("./data/layout_spec.json", {}),
      loadJson("./data/charybdis_apps.json", { apps: [] }),
      loadJson("./data/windows_norwegian_host.json", null)
    ]);
    state.rows = normalizeRows(parseCsv(csvText));
    state.layoutSpec = layoutSpec || {};
    state.hostKeyboard = hostKeyboard;
    state.apps = appsConfig.apps || [];
    const device = clean(state.layoutSpec.device) || "Charybdis";
    const host = clean(state.layoutSpec.host_keyboard?.primary) || clean(hostKeyboard?.name) || "";
    els.deviceLabel.textContent = host ? `${device} · ${host}` : device;
    if (els.transport && host) {
      els.transport.title = "Coach matches physical keys (event.code) for Norwegian Windows; firmware sends US HID scancodes.";
    }
    groupRows();
    buildRailColorStrip();
    renderApps();
    render();
    setupPractice();
    await loadWorkflowIndex();
    setupWorkflow();
    await pollState();
    setInterval(pollState, 150);
    setInterval(renderNow, 1000);
  }

  // ----- Practice / learning modes (drill, quiz, guided, progress) -----
  const PROGRESS_KEY = "charybdis-coach-progress-v1";

  function loadProgress() {
    try {
      state.progress = JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
    } catch {
      state.progress = {};
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress));
    } catch {
      /* storage unavailable — practice still works for the session */
    }
  }

  function practiceableRows(layer) {
    return (state.rowsByLayer.get(layer) || []).filter((row) => isImportant(row) && behaviorKind(row) !== "transparent");
  }

  function allPracticeableRows() {
    return LAYERS.flatMap((layer) => practiceableRows(layer));
  }

  function masteryPercent() {
    const all = allPracticeableRows();
    if (!all.length) return 0;
    const known = all.filter((row) => (state.progress[keyId(row)] || {}).correct > 0).length;
    return Math.round((known / all.length) * 100);
  }

  function updatePracticeUI() {
    if (!els.practiceScore) return;
    els.practiceScore.textContent = `${state.practice.correct} / ${state.practice.attempts}`;
    els.practiceMastery.textContent = `${masteryPercent()}%`;
  }

  function setPrompt(text) {
    if (els.practicePrompt) els.practicePrompt.textContent = text;
  }

  function recordAttempt(row, correct) {
    state.practice.attempts++;
    if (correct) state.practice.correct++;
    const id = keyId(row);
    const entry = state.progress[id] || { seen: 0, correct: 0 };
    entry.seen++;
    if (correct) entry.correct++;
    state.progress[id] = entry;
    saveProgress();
    updatePracticeUI();
  }

  function flashKey(row, cls) {
    const el = document.querySelector(`[data-key-id="${CSS.escape(keyId(row))}"]`);
    if (!el) return;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 600);
  }

  function pickWeightedTarget(rows) {
    // Prefer keys the user has gotten wrong or not seen, so practice targets weak spots.
    if (!rows.length) return null;
    const scored = rows.map((row) => {
      const p = state.progress[keyId(row)] || { seen: 0, correct: 0 };
      const weight = 1 + Math.max(0, p.seen - p.correct) * 2 + (p.seen === 0 ? 2 : 0);
      return { row, weight };
    });
    const total = scored.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * total;
    for (const x of scored) {
      r -= x.weight;
      if (r <= 0) return x.row;
    }
    return scored[scored.length - 1].row;
  }

  function startDrill() {
    setActiveMode("drill");
    nextDrill();
  }

  function nextDrill() {
    const rows = practiceableRows(state.displayedLayer).filter((row) => behaviorKind(row) === "key");
    const pool = rows.length ? rows : practiceableRows(state.displayedLayer);
    const target = pickWeightedTarget(pool);
    state.practice.target = target;
    if (!target) {
      setPrompt("No drillable keys on this layer. Switch layers and try again.");
      return;
    }
    setPrompt(`DRILL — type this key on your keyboard: "${clean(target.visual_label) || clean(target.parameter)}"  (Layer ${target.layer})`);
    selectKey(target);
  }

  function checkDrillAnswer(row) {
    if (state.practice.mode !== "drill" || !state.practice.target) return;
    const correct = keyId(row) === keyId(state.practice.target);
    recordAttempt(state.practice.target, correct);
    flashKey(state.practice.target, correct ? "answer-correct" : "answer-wrong");
    if (correct) {
      setPrompt(`✓ Correct! "${clean(state.practice.target.visual_label)}". Next…`);
      setTimeout(nextDrill, 650);
    } else {
      setPrompt(`✗ That was "${clean(row.visual_label)}". Target is "${clean(state.practice.target.visual_label)}" — try again.`);
    }
  }

  function startQuiz() {
    setActiveMode("quiz");
    const appId = getSelectedPracticeApp();
    if (appId) {
      state.practice.appShortcuts = appShortcutRows(appId);
      if (!state.practice.appShortcuts.length) {
        setPrompt(`No mapped shortcuts found for this app. Select a different app or use layer mode.`);
        return;
      }
    } else {
      state.practice.appShortcuts = null;
    }
    nextQuiz();
  }

  function nextQuiz() {
    const appId = getSelectedPracticeApp();
    if (appId && state.practice.appShortcuts?.length) {
      const shortcuts = state.practice.appShortcuts;
      const idx = Math.floor(Math.random() * shortcuts.length);
      const sc = shortcuts[idx];
      state.practice.target = sc.row;
      state.practice.appContext = sc;
      if (sc.row.layer !== state.displayedLayer) {
        state.displayedLayer = sc.row.layer;
        render();
      }
      selectKey(sc.row);
      setPrompt(`APP QUIZ — In ${appId}, find the key for: "${sc.appAction}" (${sc.appKeysDisplay || sc.appKeys})  ·  Layer ${sc.row.layer}`);
      return;
    }
    const target = pickWeightedTarget(practiceableRows(state.displayedLayer));
    state.practice.target = target;
    if (!target) {
      setPrompt("No quizzable keys on this layer. Switch layers and try again.");
      return;
    }
    const clue = clean(target.purpose) || clean(target.usage_notes) || `${clean(target.behavior)} ${clean(target.parameter)}`;
    setPrompt(`QUIZ — click the key that does this:  "${clue}"  (Layer ${target.layer})`);
  }

  function checkQuizAnswer(row) {
    if (state.practice.mode !== "quiz" || !state.practice.target) return;
    const correct = keyId(row) === keyId(state.practice.target);
    recordAttempt(state.practice.target, correct);
    flashKey(state.practice.target, correct ? "answer-correct" : "answer-wrong");
    if (correct) {
      setPrompt(`✓ Correct — "${clean(state.practice.target.visual_label)}". Next…`);
      setTimeout(nextQuiz, 700);
    } else {
      setPrompt(`✗ Not quite. You clicked "${clean(row.visual_label)}". Keep looking…`);
    }
  }

  function startGuided() {
    setActiveMode("guided");
    const appId = getSelectedPracticeApp();
    if (appId) {
      state.practice.appShortcuts = appShortcutRows(appId);
      state.practice.guidedList = state.practice.appShortcuts.map((s) => s.row);
      state.practice.guidedAppData = state.practice.appShortcuts;
    } else {
      state.practice.guidedList = practiceableRows(state.displayedLayer);
      state.practice.guidedAppData = null;
      state.practice.appShortcuts = null;
    }
    state.practice.guidedIndex = 0;
    guidedShow();
  }

  function guidedShow() {
    const list = state.practice.guidedList;
    if (!list.length) {
      setPrompt("Nothing to tour. " + (getSelectedPracticeApp() ? "No mapped shortcuts for this app." : "Switch layers and try again."));
      return;
    }
    const i = ((state.practice.guidedIndex % list.length) + list.length) % list.length;
    state.practice.guidedIndex = i;
    const row = list[i];
    if (row.layer !== state.displayedLayer) {
      state.displayedLayer = row.layer;
      render();
    }
    selectKey(row);
    flashKey(row, "answer-correct");
    const appData = state.practice.guidedAppData?.[i];
    if (appData) {
      setPrompt(`APP GUIDE ${i + 1}/${list.length} — ${appData.category}: "${appData.appAction}" (${appData.appKeysDisplay || appData.appKeys})  ·  Key: "${clean(row.visual_label)}" on Layer ${row.layer}  ·  click to advance`);
    } else {
      setPrompt(`GUIDED ${i + 1}/${list.length} — "${clean(row.visual_label)}": ${clean(row.purpose) || clean(row.usage_notes)}  ·  click another key to advance.`);
    }
    state.practice.guidedIndex = i + 1;
  }

  function setActiveMode(mode) {
    state.practice.mode = mode;
    [["drill", els.drillButton], ["quiz", els.quizButton], ["guided", els.guidedButton]].forEach(([m, btn]) => {
      if (btn) btn.classList.toggle("active", m === mode);
    });
  }

  function getSelectedPracticeApp() {
    return els.practiceAppSelect?.value || "";
  }

  function appShortcutRows(appId) {
    const app = workflowState.apps.get(appId);
    if (!app) return [];
    const results = [];
    for (const cat of (app.categories || [])) {
      for (const s of (cat.shortcuts || [])) {
        const matchedRow = rowForWorkflowShortcut(s);
        if (matchedRow) {
          const keys = displayKeysForShortcut(s);
          results.push({
            row: matchedRow,
            appAction: s.action,
            appKeys: s.keys,
            appKeysDisplay: keys.display,
            category: cat.name
          });
        }
      }
    }
    return results;
  }

  function stopPractice() {
    state.practice.mode = null;
    state.practice.target = null;
    state.practice.appShortcuts = null;
    setActiveMode(null);
    setPrompt("Practice stopped. Pick a mode to start again.");
  }

  function onUserSelectKey(row) {
    selectKey(row);
    if (state.practice.mode === "quiz") checkQuizAnswer(row);
    else if (state.practice.mode === "guided") guidedShow();
  }

  function setupPractice() {
    loadProgress();
    updatePracticeUI();
    if (els.drillButton) els.drillButton.addEventListener("click", startDrill);
    if (els.quizButton) els.quizButton.addEventListener("click", startQuiz);
    if (els.guidedButton) els.guidedButton.addEventListener("click", startGuided);
    if (els.practiceStopButton) els.practiceStopButton.addEventListener("click", stopPractice);
    if (els.practiceResetButton) {
      els.practiceResetButton.addEventListener("click", () => {
        state.progress = {};
        saveProgress();
        state.practice.attempts = 0;
        state.practice.correct = 0;
        updatePracticeUI();
        setPrompt("Progress reset.");
      });
    }
  }
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value || "";
    applyFilters();
  });

  els.focusImportantButton.addEventListener("click", () => {
    state.focusImportant = true;
    els.focusImportantButton.classList.add("active");
    els.showAllButton.classList.remove("active");
    applyFilters();
  });

  els.showAllButton.addEventListener("click", () => {
    state.focusImportant = false;
    els.showAllButton.classList.add("active");
    els.focusImportantButton.classList.remove("active");
    applyFilters();
  });

  // ----- Collapsible panels -----
  const layerRail = document.getElementById("layerRail");
  const railTitle = document.getElementById("railTitle");
  const railColorStrip = document.getElementById("railColorStrip");
  const inspectorPanel = document.getElementById("inspectorPanel");

  function buildRailColorStrip() {
    if (!railColorStrip) return;
    railColorStrip.innerHTML = "";
    for (const layer of LAYERS) {
      const swatch = document.createElement("div");
      swatch.className = "rail-swatch";
      swatch.dataset.layer = layer;
      const layerMeta = dynamicLayerMeta(layer);
      const color = layerMeta.color || "#4cc9b0";
      swatch.style.background = color;
      swatch.style.setProperty("--swatch-color", color);
      swatch.title = layerMeta.title || `Layer ${layer}`;
      swatch.addEventListener("click", (e) => {
        e.stopPropagation();
        pinDisplayedLayer(layer);
      });
      railColorStrip.appendChild(swatch);
    }
    updateRailStrip();
  }

  function updateRailStrip() {
    if (!railColorStrip) return;
    railColorStrip.querySelectorAll(".rail-swatch").forEach((sw) => {
      sw.classList.toggle("active", sw.dataset.layer === state.displayedLayer);
      sw.classList.toggle("pinned", sw.dataset.layer === state.pinnedLayer);
      sw.classList.toggle("live", sw.dataset.layer === state.liveLayer && sw.dataset.layer !== state.displayedLayer);
    });
  }

  function toggleRail() {
    layerRail.classList.toggle("collapsed");
  }

  function toggleInspector() {
    inspectorPanel.classList.toggle("collapsed");
  }

  if (railTitle) railTitle.addEventListener("click", toggleRail);
  if (railColorStrip) railColorStrip.addEventListener("click", (e) => {
    if (e.target === railColorStrip) toggleRail();
  });
  if (layerRail) layerRail.addEventListener("click", (e) => {
    if (layerRail.classList.contains("collapsed") && e.target === layerRail) toggleRail();
  });
  if (inspectorPanel) {
    inspectorPanel.addEventListener("click", (e) => {
      if (inspectorPanel.classList.contains("collapsed")) {
        e.stopPropagation();
        toggleInspector();
      }
    });
  }

  const inspectorCollapseBtn = document.getElementById("inspectorCollapseBtn");
  if (inspectorCollapseBtn) inspectorCollapseBtn.addEventListener("click", toggleInspector);

  if (inspectorPanel) inspectorPanel.classList.add("collapsed");
  buildRailColorStrip();

  els.fullscreenButton.addEventListener("click", async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  });

  const US_EVENT_KEY_MAP = {
    Escape: "Escape",
    Backspace: "Delete",
    Delete: "Delete",
    Tab: "Tab",
    Enter: "Return",
    " ": "Spacebar",
    ArrowLeft: "LeftArrow",
    ArrowRight: "RightArrow",
    ArrowUp: "UpArrow",
    ArrowDown: "DownArrow",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    Insert: "Insert",
    F1: "F1", F2: "F2", F3: "F3", F4: "F4", F5: "F5", F6: "F6",
    F7: "F7", F8: "F8", F9: "F9", F10: "F10", F11: "F11", F12: "F12",
    "1": "1", "2": "2", "3": "3", "4": "4", "5": "5",
    "6": "6", "7": "7", "8": "8", "9": "9", "0": "0",
    q: "Q", w: "W", e: "E", r: "R", t: "T",
    y: "Y", u: "U", i: "I", o: "O", p: "P",
    a: "A", s: "S", d: "D", f: "F", g: "G",
    h: "H", j: "J", k: "K", l: "L",
    ";": "SemiColon", "'": "Left Apos and Double", "\\": "Backslash and Pipe",
    z: "Z", x: "X", c: "C", v: "V", b: "B",
    n: "N", m: "M", ",": "Comma", ".": "Period",
    "/": "ForwardSlash", "-": "Minus", "=": "Equal",
    "`": "Grave", "[": "LeftBrace", "]": "RightBracket",
    Control: "LeftControl",
    Shift: "LeftShift",
    Alt: "LeftAlt",
    Meta: "GUI"
  };

  function hostCodeMap() {
    return state.hostKeyboard?.event_code_to_zmk || {};
  }

  function hostKeyAliasMap() {
    return state.hostKeyboard?.event_key_to_zmk || {};
  }

  function zmkTokensForLookup(token) {
    const value = clean(token);
    if (!value) return [];
    const hostAliases = state.hostKeyboard?.zmk_parameter_aliases || {};
    const aliases = {
      SemiColon: ["SemiColon", "SemiColon and Colon"],
      "Left Apos and Double": ["Left Apos and Double", "Apostrophe", "Keyboard Apostrophe"],
      "Left Brace": ["Left Brace", "Left Bracket"],
      "Right Bracket": ["Right Bracket", "Right Brace"],
      "Backslash and Pipe": ["Backslash and Pipe", "Backslash"],
      "Comma and LessThan": ["Comma and LessThan", "Comma"],
      "ForwardSlash and QuestionMark": ["ForwardSlash and QuestionMark", "ForwardSlash"],
      Period: ["Period", "Period and GreaterThan"],
      Spacebar: ["Spacebar", "Space"],
      Return: ["Return", "Return Enter", "Enter"],
      Grave: ["Grave", "Grave Accent and Tilde"],
      GUI: ["GUI", "Left GUI", "L GUI"],
      ...hostAliases
    };
    const base = value.replace(/^Keyboard\s+/i, "");
    for (const [key, list] of Object.entries(aliases)) {
      if (base === key || list.includes(base)) return list;
    }
    return [base];
  }

  function matchRowsByZmkToken(keyRows, token) {
    for (const candidate of zmkTokensForLookup(token)) {
      const exact = keyRows.find((row) => normalizeParamToken(row.parameter) === normalizeParamToken(candidate));
      if (exact) return exact;
      const partial = keyRows.find((row) => paramMatchesToken(row.parameter, candidate));
      if (partial) return partial;
    }
    return null;
  }

  function normalizeParamToken(value) {
    return clean(value)
      .replace(/^Keyboard\s+/i, "")
      .replace(/^Keypad\s+/i, "")
      .replace(/\s+and\s+/gi, " and ")
      .toUpperCase();
  }

  function paramMatchesToken(param, token) {
    const normalized = normalizeParamToken(param);
    const search = normalizeParamToken(token);
    if (!normalized || !search) return false;
    if (normalized === search) return true;
    if (normalized.endsWith(` ${search}`) || normalized.endsWith(`::${search}`)) return true;
    const parts = normalized.split(/\s+and\s+/i).map((part) => part.trim());
    return parts.some((part) => part === search || part.endsWith(` ${search}`));
  }

  function matchableRows(rows) {
    return rows.filter((row) => /key press|mouse key press/i.test(row.behavior));
  }

  function resolveKeyFromKeyboardEvent(eventKey, eventCode, rows) {
    const keyRows = matchableRows(rows);
    if (!keyRows.length) return null;

    // 1) Physical key (layout-independent) — required for Windows Norwegian.
    if (eventCode) {
      const codeToken = hostCodeMap()[eventCode];
      if (codeToken) {
        const codeMatch = matchRowsByZmkToken(keyRows, codeToken);
        if (codeMatch) return codeMatch;
      }
    }

    // 2) Norwegian localized character (øæå) from event.key.
    const hostAlias = hostKeyAliasMap()[eventKey];
    if (hostAlias) {
      const aliasMatch = matchRowsByZmkToken(keyRows, hostAlias);
      if (aliasMatch) return aliasMatch;
    }

    // 3) Coach visual label (ø, æ, å, ←, single letters).
    const labelMatch = keyRows.find((row) => clean(row.visual_label).toUpperCase() === String(eventKey).toUpperCase());
    if (labelMatch) return labelMatch;

    const arrowHints = {
      ArrowLeft: /leftarrow|←/i,
      ArrowRight: /rightarrow|→/i,
      ArrowUp: /uparrow|↑/i,
      ArrowDown: /downarrow|↓/i
    };
    if (arrowHints[eventKey]) {
      const arrowMatch = keyRows.find((row) => arrowHints[eventKey].test(`${row.visual_label} ${row.parameter}`));
      if (arrowMatch) return arrowMatch;
    }

    // 4) US-layout event.key fallback (English Windows or legacy).
    const zmkKey = US_EVENT_KEY_MAP[eventKey] || US_EVENT_KEY_MAP[String(eventKey).toLowerCase()];
    if (!zmkKey) return null;
    return matchRowsByZmkToken(keyRows, zmkKey);
  }

  function overlayRowForMatch(matchRow, displayLayer) {
    if (!matchRow) return null;
    const layer = String(displayLayer);
    if (String(matchRow.layer) === layer) {
      return { row: matchRow, fallthrough: false };
    }
    const overlay = (state.rowsByLayer.get(layer) || []).find(
      (row) => row.x === matchRow.x && row.y === matchRow.y
    );
    if (!overlay) return null;
    return { row: overlay, fallthrough: true };
  }

  function resolveActiveKeyPress(event) {
    const eventKey = event.key;
    const eventCode = event.code || "";
    const displayLayer = state.liveLayer || state.displayedLayer || "0";
    const overlayRows = state.rowsByLayer.get(displayLayer) || [];

    let match = resolveKeyFromKeyboardEvent(eventKey, eventCode, overlayRows);
    if (match) return overlayRowForMatch(match, displayLayer);

    if (displayLayer !== "0") {
      const baseRows = state.rowsByLayer.get("0") || [];
      match = resolveKeyFromKeyboardEvent(eventKey, eventCode, baseRows);
      if (match) return overlayRowForMatch(match, displayLayer);
    }

    return null;
  }

  // Physical keypress highlighting (separate from beacon thumb highlights).
  const keyPressTimeouts = new Map();

  const MODIFIER_EVENT_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

  function flashPhysicalKey(matchInfo) {
    if (!matchInfo?.row) return;
    const id = keyId(matchInfo.row);
    const selector = `[data-key-id="${CSS.escape(id)}"]`;
    const keyEl = document.querySelector(selector);
    if (!keyEl) return;

    const prevTimeout = keyPressTimeouts.get(id);
    if (prevTimeout) clearTimeout(prevTimeout);

    keyEl.classList.remove("press-flash", "press-fallthrough");
    keyEl.classList.add(matchInfo.fallthrough ? "press-fallthrough" : "press-flash");

    const timeout = setTimeout(() => {
      keyEl.classList.remove("press-flash", "press-fallthrough");
      keyPressTimeouts.delete(id);
    }, 450);

    keyPressTimeouts.set(id, timeout);
  }

  document.addEventListener("keydown", (event) => {
    if (event.target === els.searchInput) return;
    if (MODIFIER_EVENT_KEYS.has(event.key)) return;
    if (event.ctrlKey && event.altKey && event.shiftKey) return;

    const matchInfo = resolveActiveKeyPress(event);
    if (!matchInfo) return;

    flashPhysicalKey(matchInfo);

    if (state.practice.mode === "drill") {
      checkDrillAnswer(matchInfo.row);
    }

    if (learnState.active && learnEls.autoAdvance?.checked) {
      const currentStep = learnState.shortcuts[learnState.index];
      if (currentStep && keyId(matchInfo.row) === keyId(currentStep.row)) {
        setTimeout(learnAdvance, 500);
      }
    }

    releasePinnedLayer();
  });

  // ----- Learn overlay (fullscreen guided app training) -----
  const learnState = { active: false, appId: null, shortcuts: [], index: 0 };
  const learnEls = {
    overlay: document.getElementById("learnOverlay"),
    pickerView: document.getElementById("learnPickerView"),
    tourView: document.getElementById("learnTourView"),
    appGrid: document.getElementById("learnAppGrid"),
    closeBtn: document.getElementById("learnCloseButton"),
    backBtn: document.getElementById("learnBackToApps"),
    access: document.getElementById("learnAccess"),
    step: document.getElementById("learnStep"),
    warning: document.getElementById("learnWarning"),
    progress: document.getElementById("learnProgress"),
    prevBtn: document.getElementById("learnPrevButton"),
    nextBtn: document.getElementById("learnNextButton"),
    keyboardArea: document.getElementById("learnKeyboardArea"),
    autoAdvance: document.getElementById("learnAutoAdvance"),
  };

  const DANGEROUS_KEYS = new Set(["Alt+F4", "Ctrl+W", "Win+D", "Win+L", "Ctrl+Shift+Esc", "Alt+Tab", "Win+Tab"]);

  function layerAccessRows(targetLayer) {
    const target = String(targetLayer);
    return allRows().filter((row) => {
      if (!/momentary layer|toggle layer|to layer/i.test(row.behavior)) return false;
      return layerParam(row) === target;
    });
  }

  function accessVerb(row) {
    if (/momentary layer/i.test(row.behavior)) return "Hold";
    if (/toggle layer/i.test(row.behavior)) return "Toggle";
    if (/to layer/i.test(row.behavior)) return "Switch";
    return "Use";
  }

  function dynamicLayerName(layer) {
    const meta = dynamicLayerMeta(layer);
    return `${meta.glyph} ${meta.role || meta.title} (Layer ${layer})`;
  }

  function dynamicLayerAccessInfo(layer) {
    const meta = dynamicLayerMeta(layer);
    if (String(layer) === "0") return `${meta.glyph} Base layer - no layer access key needed`;
    const access = layerAccessRows(layer).slice(0, 3).map((row) => {
      const source = dynamicLayerMeta(row.layer);
      return `${accessVerb(row)} <strong>${escapeHtml(clean(row.visual_label) || `x${row.x},y${row.y}`)}</strong> on L${row.layer} (${escapeHtml(source.role || source.title)} x${row.x},y${row.y})`;
    });
    if (access.length) return `${meta.glyph} ${escapeHtml(meta.role || meta.title)} access: ${access.join(" or ")}`;
    return `${meta.glyph} ${escapeHtml(meta.role || meta.title)} layer detected, but no access key is described in the current CSV`;
  }

  async function openLearnOverlay() {
    if (!learnEls.overlay) return;
    learnEls.overlay.classList.remove("learn-overlay--hidden");
    learnState.active = false;
    showLearnPicker();

    for (const entry of (workflowState.index?.apps || [])) {
      if (!workflowState.apps.has(entry.id)) {
        const data = await loadJson(`./workflows/${entry.file}`, null);
        if (data) workflowState.apps.set(entry.id, data);
      }
    }
    showLearnPicker();
  }

  function showLearnPicker() {
    if (learnEls.pickerView) learnEls.pickerView.style.display = "";
    if (learnEls.tourView) learnEls.tourView.classList.add("learn-tour--hidden");
    if (learnEls.progress) learnEls.progress.textContent = "";
    if (!learnEls.appGrid) return;
    learnEls.appGrid.innerHTML = "";
    for (const entry of (workflowState.index?.apps || [])) {
      const app = workflowState.apps.get(entry.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "learn-app-card";
      btn.textContent = app?.name || entry.name;
      btn.addEventListener("click", () => startLearnTour(entry.id));
      learnEls.appGrid.appendChild(btn);
    }
  }

  function closeLearnOverlay() {
    if (!learnEls.overlay) return;
    learnEls.overlay.classList.add("learn-overlay--hidden");
    learnState.active = false;
  }

  async function startLearnTour(appId) {
    if (!appId) return;
    if (!workflowState.apps.has(appId)) {
      const entry = (workflowState.index?.apps || []).find((a) => a.id === appId);
      if (entry) {
        const data = await loadJson(`./workflows/${entry.file}`, null);
        if (data) workflowState.apps.set(appId, data);
      }
    }
    const shortcuts = appShortcutRows(appId);
    if (!shortcuts.length) return;

    const safe = shortcuts.filter((s) => !DANGEROUS_KEYS.has(s.appKeys));
    const dangerous = shortcuts.filter((s) => DANGEROUS_KEYS.has(s.appKeys));
    const sorted = [...safe, ...dangerous];

    learnState.active = true;
    learnState.appId = appId;
    learnState.shortcuts = sorted;
    learnState.index = 0;

    if (learnEls.pickerView) learnEls.pickerView.style.display = "none";
    if (learnEls.tourView) learnEls.tourView.classList.remove("learn-tour--hidden");
    showLearnStep();
  }

  function showLearnStep() {
    if (!learnState.active || !learnState.shortcuts.length) return;
    const idx = Math.max(0, Math.min(learnState.index, learnState.shortcuts.length - 1));
    learnState.index = idx;
    const sc = learnState.shortcuts[idx];
    const layer = sc.row.layer;
    const layerName = dynamicLayerName(layer);
    const accessInfo = dynamicLayerAccessInfo(layer);

    if (learnEls.access) learnEls.access.innerHTML = accessInfo;

    learnEls.step.innerHTML = [
      `<strong>${escapeHtml(sc.appAction)}</strong>`,
      `<span class="learn-keys">${escapeHtml(sc.appKeysDisplay || sc.appKeys)}</span>`,
      `<span class="learn-pos">Key: ${escapeHtml(clean(sc.row.visual_label))} &middot; x${sc.row.x}, y${sc.row.y} &middot; ${layerName}</span>`,
    ].join("");

    if (learnEls.progress) learnEls.progress.textContent = `${idx + 1} / ${learnState.shortcuts.length} — ${sc.category}`;

    const isDangerous = DANGEROUS_KEYS.has(sc.appKeys);
    if (learnEls.warning) {
      learnEls.warning.classList.toggle("learn-warning--hidden", !isDangerous);
      if (isDangerous) learnEls.warning.textContent = `This shortcut (${sc.appKeysDisplay || sc.appKeys}) may affect other windows or close tabs. Use with care.`;
    }

    if (sc.row.layer !== state.displayedLayer) {
      state.displayedLayer = sc.row.layer;
      render();
    }
    renderLearnKeyboard(sc);
  }

  function renderLearnKeyboard(sc) {
    if (!learnEls.keyboardArea) return;
    learnEls.keyboardArea.innerHTML = "";
    const rows = state.rowsByLayer.get(state.displayedLayer) || [];
    const rowMap = new Map(rows.map((r) => [`${r.x}:${r.y}`, r]));
    learnEls.keyboardArea.appendChild(renderHand("left", X_LEFT, rowMap));
    learnEls.keyboardArea.appendChild(renderHand("right", X_RIGHT, rowMap));
    learnEls.keyboardArea.className = "learn-keyboard-area keyboard-map";
    const targetId = keyId(sc.row);
    const targetEl = learnEls.keyboardArea.querySelector(`[data-key-id="${CSS.escape(targetId)}"]`);
    if (targetEl) {
      targetEl.classList.add("answer-correct");
      targetEl.scrollIntoView({ block: "center", inline: "center" });
    }
  }

  function learnAdvance() {
    if (!learnState.active) return;
    learnState.index = Math.min(learnState.shortcuts.length - 1, learnState.index + 1);
    showLearnStep();
  }

  if (document.getElementById("learnButton")) {
    document.getElementById("learnButton").addEventListener("click", openLearnOverlay);
  }
  if (learnEls.closeBtn) learnEls.closeBtn.addEventListener("click", closeLearnOverlay);
  if (learnEls.backBtn) learnEls.backBtn.addEventListener("click", showLearnPicker);
  if (learnEls.prevBtn) learnEls.prevBtn.addEventListener("click", () => { if (learnState.active) { learnState.index = Math.max(0, learnState.index - 1); showLearnStep(); } });
  if (learnEls.nextBtn) learnEls.nextBtn.addEventListener("click", learnAdvance);

  // ----- Key input debug overlay -----
  const keyDebugEl = document.getElementById("keyDebugOverlay");
  const keyDebugLog = document.getElementById("keyDebugLog");
  const keyDebugMods = document.getElementById("keyDebugMods");
  const keyDebugToggleBtn = document.getElementById("keyDebugToggle");
  const keyDebugCloseBtn = document.getElementById("keyDebugClose");
  let keyDebugVisible = false;
  const MAX_DEBUG_EVENTS = 20;

  function toggleKeyDebug() {
    keyDebugVisible = !keyDebugVisible;
    if (keyDebugEl) keyDebugEl.classList.toggle("key-debug--hidden", !keyDebugVisible);
  }

  if (keyDebugToggleBtn) keyDebugToggleBtn.addEventListener("click", toggleKeyDebug);
  if (keyDebugCloseBtn) keyDebugCloseBtn.addEventListener("click", () => { keyDebugVisible = false; if (keyDebugEl) keyDebugEl.classList.add("key-debug--hidden"); });

  function logKeyEvent(e) {
    if (!keyDebugVisible || !keyDebugLog) return;
    const mods = [e.ctrlKey && "Ctrl", e.shiftKey && "Shift", e.altKey && "Alt", e.metaKey && "Win"].filter(Boolean).join("+") || "none";
    if (keyDebugMods) keyDebugMods.textContent = `Modifiers: ${mods}`;
    const li = document.createElement("li");
    li.innerHTML = `<span class="key-event-type">${e.type}</span> <span class="key-event-key">${escapeHtml(e.key)}</span> code=${escapeHtml(e.code)} mods=${mods}`;
    keyDebugLog.prepend(li);
    while (keyDebugLog.children.length > MAX_DEBUG_EVENTS) keyDebugLog.lastChild.remove();
  }

  document.addEventListener("keydown", logKeyEvent);
  document.addEventListener("keyup", logKeyEvent);

  init().catch((error) => {
    els.keyboardMap.innerHTML = `<div class="panel selected-panel"><h2>Coach failed to load</h2><p>${escapeHtml(error.message)}</p></div>`;
  });
})();
