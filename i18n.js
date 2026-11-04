// Texts for the interface. Italian is the default language.
// {name} placeholders are filled from the params object.

export const LANGUAGES = ["it", "en"];

const STRINGS = {
  it: {
    "meta.description":
      "Carica i font statici sui vertici dello spazio di design e genera un font variabile direttamente nel browser.",
    "hero.tagline": "Trasforma font compatibili in un unico font variabile.",
    "hero.about": "About",
    "hero.aboutText1":
      "Un font variabile contiene più disegni (master) dello stesso carattere e permette di passare dall'uno all'altro in modo continuo. Ogni master sta su un vertice dello spazio di design: una linea per un asse, un quadrato per due, un cubo per tre.",
    "hero.aboutText2":
      "Perché l'interpolazione funzioni, tutti i master devono avere gli stessi glifi, e ogni glifo lo stesso numero di contorni e di nodi, nello stesso ordine. Varialo controlla i font e, se qualcosa non torna, ti mostra esattamente dove.",
    "hero.aboutText3":
      "Tutto avviene nel tuo browser: i font non vengono caricati su nessun server. Il font generato è sempre un .ttf variabile.",
    "hero.credits":
      "La prima versione di Varialo è stata sviluppata da Rocco Modugno per il workshop Sabotaggio Tipografico di Edoardo Pensieri allo IED Torino.",
    "lang.label": "Lingua",

    "steps.1": "Scegli quanti assi",
    "steps.2": "Trascina un font su ogni vertice",
    "steps.3": "Genera e prova il font variabile",

    "space.title": "Spazio di design",
    "space.axes": "Numero di assi",
    "space.axis1": "1 asse",
    "space.axis2": "2 assi",
    "space.axis3": "3 assi",
    "space.fonts": "{count} font",
    "space.hint":
      "Clicca o trascina un file .otf/.ttf su ogni vertice. Il vertice A è il font di partenza (tutti gli assi a 0).",
    "space.clear": "Svuota",
    "space.familyName": "Nome del font variabile",
    "space.familyPlaceholder": "Automatico: nome del font A + “Variable”",
    "space.build": "Genera font variabile",
    "space.download": "Scarica .ttf",

    "axis.name": "Asse {letter}",
    "slot.base": "Font base",
    "slot.end": "Fine asse {letters}",
    "slot.corner": "Angolo {letters}",
    "slot.title": "Vertice {vertex} · {title}",
    "slot.empty": "Vertice {vertex}: clicca o trascina un font",

    "status.idle": "In attesa",
    "status.working": "Al lavoro",
    "status.success": "Pronto",
    "status.error": "Errore",
    "status.start": "Carica {count} font per iniziare.",
    "status.loadingEngine":
      "Carico il motore dei font (Pyodide + fontTools). La prima volta può richiedere qualche secondo.",
    "status.readyToBuild": "Tutti i font sono caricati: premi “Genera font variabile”.",
    "status.checking": "Controllo la compatibilità dei font…",
    "status.ready": "Font variabile pronto: provalo qui a fianco e scaricalo.",
    "status.notCompatible": "I font non sono compatibili: guarda il report per capire cosa correggere.",
    "status.engineFailed": "Il motore dei font non è riuscito a completare l'operazione.",
    "status.missing": "Mancano dei font: {list}.",
    "status.badFile": "“{name}” non è un file .ttf o .otf.",

    "preview.title": "Anteprima",
    "preview.placeholderBefore": "Qui potrai scrivere con il tuo font variabile dopo averlo generato.",
    "preview.placeholderAfter": "Scrivi qualcosa…",
    "preview.sample": "Hamburgefontsiv",
    "preview.matrix": "Matrice di interpolazione",
    "preview.matrixHint": "Clicca una cella per portare l'anteprima su quei valori.",
    "preview.matrixZ": "Asse Z = {value} (cambialo con il cursore Z).",
    "preview.size": "Dimensione",
    "preview.empty": "I cursori degli assi compaiono qui dopo la generazione.",

    "info.title": "Info font",
    "info.exportTitle": "Font variabile esportato",
    "info.familyName": "Nome della famiglia",
    "info.familyPlaceholder": "es. Corso Sans Variable",
    "info.designer": "Autore",
    "info.designerPlaceholder": "es. Nome Cognome",
    "info.exportNote":
      "Questi dati vengono scritti nel file .ttf. Se li lasci vuoti si usano quelli del font A.",
    "info.sourcesTitle": "Font di partenza",
    "info.empty": "Le informazioni compaiono qui appena carichi un font su un vertice.",
    "info.file": "File",
    "info.family": "Famiglia",
    "info.style": "Stile",
    "info.designerRow": "Autore",
    "info.manufacturer": "Produttore",
    "info.version": "Versione",
    "info.copyright": "Copyright",
    "info.format": "Formato",
    "info.upm": "UPM",
    "info.glyphs": "Glifi",
    "info.weight": "Peso (OS/2)",
    "info.axes": "Assi",
    "info.static": "nessuno (statico)",
    "info.mismatch": "Diverso dal font A: deve essere uguale in tutti i font.",

    "summary.title": "Font caricati",
    "summary.empty": "I dati dei font compaiono qui dopo il controllo.",
    "summary.glyphs": "{count} glifi",

    "report.title": "Report di compatibilità",
    "report.okTitle": "Tutto compatibile",
    "report.okText": "I font sono stati controllati e il font variabile è stato generato.",
    "report.failTitle": "I tuoi font non sono preparati correttamente per l'interpolazione.",
    "report.failText":
      "Per generare un font variabile ogni glifo deve avere, in tutti i master, la stessa struttura: stessi contorni, stessi nodi, nello stesso ordine. Qui sotto trovi i glifi che non corrispondono, con i punti problematici evidenziati in giallo.",
    "report.howToFix": "Come risolvere",
    "report.glyphsBlocking": "Glifi da correggere ({count})",
    "report.glyphsWarning": "Da controllare ({count})",
    "report.glyphsWarningText":
      "Il font è stato generato, ma in questi glifi l'interpolazione potrebbe deformarsi.",
    "report.moreGlyphs": "Altri glifi con lo stesso problema: {list}",
    "report.reference": "riferimento",
    "report.technical": "Dettagli tecnici",
    "report.legendBad": "punto in più / non corrispondente",
    "report.legendContour": "contorno con problemi",
    "report.legendStart": "punto di partenza",
    "report.glyph": "Glifo {name}",
    "report.notes": "Note",

    "fix.nodes":
      "Apri i glifi segnalati nel tuo editor (Glyphs, FontLab, RoboFont…) e fai in modo che ogni contorno abbia lo stesso numero di nodi in tutti i master: aggiungi o togli i nodi evidenziati.",
    "fix.contours":
      "Ogni master deve avere lo stesso numero di contorni. Se in un master c'è un contorno in più (ad esempio un pezzo staccato o sovrapposto), uniscilo o aggiungilo anche agli altri.",
    "fix.order":
      "Controlla anche l'ordine dei contorni e il punto di partenza: devono corrispondere tra i master. Usa la funzione “Correct path direction” del tuo editor.",
    "fix.glyphs":
      "Tutti i font devono contenere gli stessi glifi, con gli stessi nomi. Aggiungi i glifi mancanti o eliminali dagli altri font.",
    "fix.outlines":
      "Esporta tutti i master nello stesso formato (tutti .otf oppure tutti .ttf), dallo stesso file sorgente se possibile.",
    "fix.upm": "Tutti i font devono avere la stessa dimensione dell'em (Units Per Em).",
    "fix.composite":
      "Se un glifo è composto (es. una lettera accentata fatta con componenti) deve esserlo in tutti i master, con gli stessi componenti.",
    "fix.editor":
      "Suggerimento: se disegni i master nello stesso file del tuo editor, l'editor ti avvisa quando i glifi non sono compatibili.",

    "msg.unknown_outlines": "{font}: formato dei contorni non riconosciuto.",
    "msg.already_variable": "{font} è già un font variabile: carica solo font statici.",
    "msg.mixed_outlines":
      "I font usano formati di contorno diversi (il font base usa {base}; diversi: {fonts}). Esportali tutti come .otf oppure tutti come .ttf.",
    "msg.upm": "{font} usa {value} Units Per Em, il font base {base}.",
    "msg.missing_glyphs": "In {font} mancano {count} glifi presenti nel font base: {glyphs}.",
    "msg.extra_glyphs": "{font} contiene {count} glifi che il font base non ha: {glyphs}.",
    "msg.outlines_incompatible": "{count} glifi hanno contorni non compatibili: {glyphs}.",
    "msg.outlines_suspicious": "{count} glifi potrebbero interpolare male: {glyphs}.",
    "msg.glyph_unreadable": "Il glifo non può essere letto.",
    "msg.composite_mismatch": "In un master il glifo è composto da componenti, nell'altro è disegnato.",
    "msg.component_mismatch": "Componenti diversi ({base} / {other}).",
    "msg.contour_count": "Numero di contorni diverso: {base} nel riferimento, {other} qui.",
    "msg.node_count": "Contorno {contour}: {base} nodi nel riferimento, {other} qui.",
    "msg.point_count": "Contorno {contour}: {base} punti nel riferimento, {other} qui.",
    "msg.point_types": "Contorno {contour}: stessi punti, ma alcuni sono nodi in un master e maniglie nell'altro.",
    "msg.line_vs_curve":
      "Contorno {contour}: un segmento è una retta in un master e una curva nell'altro (corretto automaticamente).",
    "msg.direction": "Contorno {contour}: direzione opposta rispetto al riferimento. Il contorno si “ribalterà” durante l'interpolazione.",
    "msg.start_point": "Contorno {contour}: il punto di partenza è in una posizione diversa. Il contorno potrebbe “ruotare” durante l'interpolazione.",
    "msg.contour_order": "L'ordine dei contorni è diverso dal riferimento.",
    "msg.converted_to_ttf":
      "I font .otf (curve PostScript) sono stati convertiti in curve TrueType per esportare un .ttf variabile.",
    "msg.axes_info": "Assi del font: {tags}, da 0 a 1000.",
    "msg.build_failed":
      "I controlli sono passati, ma la generazione del font variabile si è interrotta. Apri i dettagli tecnici qui sotto.",
  },

  en: {
    "meta.description":
      "Load static fonts onto the vertices of a design space and generate a variable font right in the browser.",
    "hero.tagline": "Turn compatible fonts into one variable font.",
    "hero.about": "About",
    "hero.aboutText1":
      "A variable font contains several drawings (masters) of the same typeface and lets you move smoothly between them. Each master sits on a vertex of the design space: a line for one axis, a square for two, a cube for three.",
    "hero.aboutText2":
      "For interpolation to work, every master needs the same glyphs, and every glyph the same number of contours and nodes, in the same order. Varialo checks your fonts and, when something doesn't match, shows you exactly where.",
    "hero.aboutText3":
      "Everything happens in your browser: fonts are never uploaded to a server. The generated font is always a variable .ttf.",
    "hero.credits":
      "The first version of Varialo was developed by Rocco Modugno for the Sabotaggio Tipografico workshop by Edoardo Pensieri at IED Torino.",
    "lang.label": "Language",

    "steps.1": "Choose how many axes",
    "steps.2": "Drop a font on every vertex",
    "steps.3": "Build and try the variable font",

    "space.title": "Design space",
    "space.axes": "Number of axes",
    "space.axis1": "1 axis",
    "space.axis2": "2 axes",
    "space.axis3": "3 axes",
    "space.fonts": "{count} fonts",
    "space.hint":
      "Click or drop an .otf/.ttf file on each vertex. Vertex A is the starting font (all axes at 0).",
    "space.clear": "Clear",
    "space.familyName": "Variable font name",
    "space.familyPlaceholder": "Automatic: name of font A + “Variable”",
    "space.build": "Build variable font",
    "space.download": "Download .ttf",

    "axis.name": "Axis {letter}",
    "slot.base": "Base font",
    "slot.end": "End of axis {letters}",
    "slot.corner": "Corner {letters}",
    "slot.title": "Vertex {vertex} · {title}",
    "slot.empty": "Vertex {vertex}: click or drop a font",

    "status.idle": "Idle",
    "status.working": "Working",
    "status.success": "Ready",
    "status.error": "Error",
    "status.start": "Load {count} fonts to begin.",
    "status.loadingEngine":
      "Loading the font engine (Pyodide + fontTools). The first time can take a few seconds.",
    "status.readyToBuild": "All fonts are loaded: press “Build variable font”.",
    "status.checking": "Checking font compatibility…",
    "status.ready": "Variable font ready: try it next to this panel and download it.",
    "status.notCompatible": "The fonts are not compatible: see the report to find out what to fix.",
    "status.engineFailed": "The font engine could not finish the job.",
    "status.missing": "Some fonts are missing: {list}.",
    "status.badFile": "“{name}” is not a .ttf or .otf file.",

    "preview.title": "Preview",
    "preview.placeholderBefore": "Once generated, you can type with your variable font here.",
    "preview.placeholderAfter": "Type something…",
    "preview.sample": "Hamburgefontsiv",
    "preview.matrix": "Interpolation matrix",
    "preview.matrixHint": "Click a cell to move the preview to those values.",
    "preview.matrixZ": "Axis Z = {value} (change it with the Z slider).",
    "preview.size": "Size",
    "preview.empty": "Axis sliders appear here after building.",

    "info.title": "Font info",
    "info.exportTitle": "Exported variable font",
    "info.familyName": "Family name",
    "info.familyPlaceholder": "e.g. Course Sans Variable",
    "info.designer": "Author",
    "info.designerPlaceholder": "e.g. First Last",
    "info.exportNote":
      "These details are written into the .ttf file. If you leave them empty, font A's are used.",
    "info.sourcesTitle": "Source fonts",
    "info.empty": "The details appear here as soon as you load a font on a vertex.",
    "info.file": "File",
    "info.family": "Family",
    "info.style": "Style",
    "info.designerRow": "Author",
    "info.manufacturer": "Manufacturer",
    "info.version": "Version",
    "info.copyright": "Copyright",
    "info.format": "Format",
    "info.upm": "UPM",
    "info.glyphs": "Glyphs",
    "info.weight": "Weight (OS/2)",
    "info.axes": "Axes",
    "info.static": "none (static)",
    "info.mismatch": "Different from font A: it must be the same in every font.",

    "summary.title": "Loaded fonts",
    "summary.empty": "Font details appear here after the check.",
    "summary.glyphs": "{count} glyphs",

    "report.title": "Compatibility report",
    "report.okTitle": "Everything is compatible",
    "report.okText": "The fonts were checked and the variable font was generated.",
    "report.failTitle": "Your fonts are not prepared properly for interpolation.",
    "report.failText":
      "To build a variable font, every glyph needs the same structure in all masters: same contours, same nodes, in the same order. Below are the glyphs that don't match, with the problem points highlighted in yellow.",
    "report.howToFix": "How to fix it",
    "report.glyphsBlocking": "Glyphs to fix ({count})",
    "report.glyphsWarning": "Worth checking ({count})",
    "report.glyphsWarningText":
      "The font was generated, but these glyphs may deform while interpolating.",
    "report.moreGlyphs": "Other glyphs with the same problem: {list}",
    "report.reference": "reference",
    "report.technical": "Technical details",
    "report.legendBad": "extra / unmatched point",
    "report.legendContour": "contour with problems",
    "report.legendStart": "start point",
    "report.glyph": "Glyph {name}",
    "report.notes": "Notes",

    "fix.nodes":
      "Open the listed glyphs in your editor (Glyphs, FontLab, RoboFont…) and make every contour have the same number of nodes in all masters: add or remove the highlighted nodes.",
    "fix.contours":
      "Every master needs the same number of contours. If one master has an extra contour (for example a detached or overlapping piece), merge it or add it to the others too.",
    "fix.order":
      "Also check contour order and start points: they must match across masters. Use your editor's “Correct path direction” command.",
    "fix.glyphs":
      "All fonts must contain the same glyphs, with the same names. Add the missing glyphs or remove them from the other fonts.",
    "fix.outlines":
      "Export all masters in the same format (all .otf or all .ttf), ideally from the same source file.",
    "fix.upm": "All fonts need the same em size (Units Per Em).",
    "fix.composite":
      "If a glyph is a composite (e.g. an accented letter built from components) it must be one in every master, with the same components.",
    "fix.editor":
      "Tip: if you draw all masters in one file of your editor, the editor warns you when glyphs are not compatible.",

    "msg.unknown_outlines": "{font}: outline format not recognised.",
    "msg.already_variable": "{font} is already a variable font: load static fonts only.",
    "msg.mixed_outlines":
      "The fonts use different outline formats (the base font uses {base}; different: {fonts}). Export them all as .otf or all as .ttf.",
    "msg.upm": "{font} uses {value} Units Per Em, the base font {base}.",
    "msg.missing_glyphs": "{font} is missing {count} glyphs that the base font has: {glyphs}.",
    "msg.extra_glyphs": "{font} contains {count} glyphs the base font doesn't have: {glyphs}.",
    "msg.outlines_incompatible": "{count} glyphs have incompatible outlines: {glyphs}.",
    "msg.outlines_suspicious": "{count} glyphs may interpolate badly: {glyphs}.",
    "msg.glyph_unreadable": "The glyph cannot be read.",
    "msg.composite_mismatch": "In one master the glyph is built from components, in the other it is drawn.",
    "msg.component_mismatch": "Different components ({base} / {other}).",
    "msg.contour_count": "Different number of contours: {base} in the reference, {other} here.",
    "msg.node_count": "Contour {contour}: {base} nodes in the reference, {other} here.",
    "msg.point_count": "Contour {contour}: {base} points in the reference, {other} here.",
    "msg.point_types": "Contour {contour}: same points, but some are nodes in one master and handles in the other.",
    "msg.line_vs_curve":
      "Contour {contour}: a segment is a line in one master and a curve in the other (fixed automatically).",
    "msg.direction": "Contour {contour}: opposite direction to the reference. The contour will “flip” while interpolating.",
    "msg.start_point": "Contour {contour}: the start point is in a different place. The contour may “rotate” while interpolating.",
    "msg.contour_order": "The contour order differs from the reference.",
    "msg.converted_to_ttf":
      "The .otf fonts (PostScript curves) were converted to TrueType curves to export a variable .ttf.",
    "msg.axes_info": "Font axes: {tags}, from 0 to 1000.",
    "msg.build_failed":
      "The checks passed, but building the variable font stopped. Open the technical details below.",
  },
};

let current = "it";

export function getLanguage() {
  return current;
}

export function setLanguage(lang) {
  current = LANGUAGES.includes(lang) ? lang : "it";
  document.documentElement.lang = current;
  try {
    localStorage.setItem("varialo-lang", current);
  } catch {
    // storage unavailable: the choice just isn't remembered
  }
  applyStaticTexts();
}

export function initialLanguage() {
  try {
    const saved = localStorage.getItem("varialo-lang");
    if (LANGUAGES.includes(saved)) {
      return saved;
    }
  } catch {
    // ignore
  }
  return "it";
}

export function t(key, params = {}) {
  const template = STRINGS[current][key] ?? STRINGS.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match,
  );
}

// Engine messages: {code, params}
export function tm(message) {
  return t(`msg.${message.code}`, message.params || {});
}

export function applyStaticTexts(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
  root.querySelectorAll("[data-i18n-content]").forEach((el) => {
    el.content = t(el.dataset.i18nContent);
  });
}
