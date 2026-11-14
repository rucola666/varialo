// Texts for the interface. Italian is the default language.
// {name} placeholders are filled from the params object.

export const LANGUAGES = ["it", "en"];

const STRINGS = {
  it: {
    "meta.description":
      "Carica i font statici sui vertici della rappresentazione spaziale e genera un font variabile direttamente nel browser.",
    "hero.tagline": "Varialo trasforma font compatibili in un unico font.",
    "hero.about": "About",
    "hero.aboutText1": "Un font variabile contiene più disegni (master) dello stesso carattere e permette di passare dall'uno all'altro in modo continuo. Ogni master sta su un vertice della rappresentazione spaziale: una linea per un asse, un quadrato per due, un cubo per tre. Puoi partire da font statici o da font variabili: questi ultimi vengono “spacchettati” nei loro angoli.",
    "hero.aboutText2":
      "Perché l'interpolazione funzioni, tutti i master devono avere gli stessi glifi, e ogni glifo lo stesso numero di contorni e di nodi, nello stesso ordine. Varialo controlla i font e, se qualcosa non torna, ti mostra esattamente dove.",
    "hero.aboutText3":
      "Tutto avviene nel tuo browser: i font non vengono caricati su nessun server. Il font generato è sempre un .ttf variabile.",
    "hero.credits":
      "La prima versione di Varialo è stata sviluppata da Rocco Modugno per il workshop Sabotaggio Tipografico di Edoardo Pensieri allo IED Torino.",
    "status.place": "Metti un font su ognuno dei {count} vertici.",
    "status.folderMismatch": "“{name}” contiene {count} font, ma lo spazio ha {vertices} vertici. Cambia il numero di assi, svuota i vertici o trascina i font uno alla volta.",
    "status.axisErrors": "Correggi gli assi segnalati prima di generare.",
    "status.rebuilding": "Aggiorno il font variabile…",
    "library.title": "Libreria",
    "library.import": "Importa font",
    "library.empty": "Trascina qui i tuoi font .ttf o .otf, statici o variabili, oppure usa “Importa font”. I font variabili vengono spacchettati in cartelle con i loro angoli.",
    "library.hint": "Trascina le icone sui vertici. Clicca un'icona per vederla nell'anteprima.",
    "library.selected": "Selezionato: {name}. Ora clicca un vertice.",
    "library.dragHint": "Trascina su un vertice · clic: anteprima",
    "library.folderDragHint": "Trascina la cartella sulla rappresentazione spaziale per riempire tutti i vertici · clic: anteprima",
    "library.remove": "Rimuovi dalla libreria",
    "library.collapse": "Chiudi cartella",
    "library.expand": "Apri cartella",
    "library.variable": "variabile",
    "library.cornerCount": "{count} angoli",
    "library.pickAxes": "Questo font ha più di {max} assi: scegli quali spacchettare. Gli altri restano fissi al valore indicato.",
    "library.pinValue": "Valore fisso",
    "library.noteDefault": "Il font di default ({tag} {value}) non è un angolo: spacchettando solo gli estremi questo disegno intermedio si perde.",
    "library.notePinned": "Assi fissi: {list}.",
    "library.unreadable": "“{name}” non può essere letto come font.",
    "axis.title": "Asse",
    "axis.preset": "Tipo di asse",
    "axis.custom": "Personalizzato",
    "axis.tag": "Tag",
    "axis.start": "Valore in A (default)",
    "axis.end": "Valore alla fine",
    "axis.info.custom": "Asse personalizzato. Nelle pagine web si usa con font-variation-settings: \"{tag}\" valore.",
    "axis.info.wght": "Asse registrato: lo controlla anche CSS font-weight. Valori 1–1000 (400 = Regular, 700 = Bold).",
    "axis.info.wdth": "Asse registrato: lo controlla anche CSS font-stretch. Valori in % della larghezza normale (100).",
    "axis.info.ital": "Asse registrato: 0 = tondo, 1 = corsivo.",
    "axis.info.slnt": "Asse registrato: gradi di inclinazione (negativo = verso destra). CSS: font-style: oblique.",
    "axis.info.opsz": "Asse registrato: dimensione ottica in punti. I browser lo regolano da soli in base al corpo.",
    "axis.err.tagLength": "Il tag deve avere esattamente 4 caratteri.",
    "axis.err.tagLowercase": "I tag minuscoli sono riservati agli assi registrati: usa {upper}.",
    "axis.err.tagChars": "Tag personalizzato: solo lettere maiuscole A–Z e cifre, e deve iniziare con una lettera.",
    "axis.err.tagDuplicate": "Il tag {tag} è già usato da un altro asse.",
    "axis.err.nameEmpty": "Dai un nome all'asse.",
    "axis.err.number": "Inserisci due numeri.",
    "axis.err.sameValues": "Il valore in A e quello alla fine devono essere diversi.",
    "axis.err.tooBig": "I valori devono stare tra -{limit} e {limit}.",
    "axis.err.range.wght": "wght accetta valori da {min} a {max}.",
    "axis.err.range.wdth": "wdth accetta valori da {min} a {max} (percentuale).",
    "axis.err.range.ital": "ital accetta solo valori tra {min} e {max}.",
    "axis.err.range.slnt": "slnt accetta gradi da {min} a {max}.",
    "axis.err.range.opsz": "opsz accetta valori da {min} a {max}.",
    "axis.warn.nameLong": "Nome lungo: alcuni programmi lo potrebbero tagliare.",
    "axis.warn.decimals": "Più di 3 decimali: verranno arrotondati.",
    "info.source": "Font",
    "info.origin": "Origine",
    "info.originVariable": "variabile · {location}",
    "msg.vf_intermediate": "{font} ha master intermedi: spacchettando solo gli estremi, il nuovo font interpolerà in modo lineare tra gli angoli e i disegni intermedi si perdono.",
    "msg.vf_avar": "{font} usa una curva di interpolazione non lineare (avar): nel nuovo font l'interpolazione tra gli angoli sarà lineare.",
    "library.download": "Scarica come font statico",
    "library.downloadFolder": "Scarica tutti gli angoli come font statici (.zip)",
    "axis.edit": "Clicca per scegliere il tipo di asse, il tag e il nome",
    "axis.close": "Chiudi",
    "status.exporting": "Preparo il font statico…",
    "status.exported": "Scaricato: {name}.",
    "status.exportFailed": "Non è stato possibile esportare il font: {error}",
    "library.previewGenerated": "Font variabile generato",
    "library.previewEmpty": "Anteprima: importa un font",
    "preview.modes": "Cosa mostrare nell'anteprima",
    "preview.modeLetter": "Lettera",
    "preview.modeWord": "Parola",
    "preview.modePangram": "Pangramma",
    "preview.word": "Tipografia",
    "preview.pangram": "Quel vituperabile xenofobo zelante assaggia il whisky ed esclama: alleluja!",
    "status.restored": "Questa configurazione era già stata generata: il font variabile è di nuovo pronto da scaricare.",
    "lang.label": "Lingua",

    "steps.1": "Importa i font nella libreria",
    "steps.2": "Trascinali sui vertici e dai un nome agli assi",
    "steps.3": "Genera e muoviti nello spazio",

    "space.title": "Rappresentazione spaziale",
    "space.axes": "Numero di assi",
    "space.axis1": "1 asse",
    "space.axis2": "2 assi",
    "space.axis3": "3 assi",
    "space.fonts": "{count} font",
    "space.hint": "Trascina le icone della libreria sui vertici (una cartella riempie tutti i vertici) e sposta un font trascinandolo su un altro vertice. Scrivi i valori agli estremi degli assi e clicca il nome di un asse per rinominarlo. Dopo la generazione trascina le maniglie gialle.",
    "space.clear": "Svuota vertici",
    "space.familyName": "Nome del font variabile",
    "space.familyPlaceholder": "Automatico: nome del font A + “Variable”",
    "space.build": "Genera font variabile",
    "space.download": "Scarica font variabile .ttf",

    "axis.name": "Nome",
    "slot.base": "Font base",
    "slot.end": "Fine asse {letters}",
    "slot.corner": "Angolo {letters}",
    "slot.title": "Vertice {vertex} · {title}",
    "slot.empty": "Vertice {vertex}: trascina qui un font",

    "status.idle": "In attesa",
    "status.working": "Al lavoro",
    "status.success": "Pronto",
    "status.error": "Errore",
    "status.start": "Importa i font nella libreria per iniziare.",
    "status.loadingEngine":
      "Carico il motore dei font (Pyodide + fontTools). La prima volta può richiedere qualche secondo.",
    "status.readyToBuild": "Tutti i font sono caricati: premi “Genera font variabile”.",
    "status.checking": "Controllo la compatibilità dei font…",
    "status.ready": "Font variabile pronto: provalo nell'anteprima e scaricalo da Info font.",
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
    "preview.matrixZ": "{tag} = {value} (cambialo con l'asse Z).",
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
    "info.sourcesTitle": "Font sui vertici",
    "info.empty": "Le informazioni compaiono qui quando metti un font su un vertice.",
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
    "short.contour_count": "Contorni: {value}.",
    "short.node_count": "Contorno {contour}: {value} nodi.",
    "short.point_count": "Contorno {contour}: {value} punti.",
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
    "hero.tagline": "Varialo turns compatible fonts into a single font.",
    "hero.about": "About",
    "hero.aboutText1": "A variable font contains several drawings (masters) of the same typeface and lets you move smoothly between them. Each master sits on a vertex of the design space: a line for one axis, a square for two, a cube for three. You can start from static fonts or from variable fonts: those get “unpacked” into their corners.",
    "hero.aboutText2":
      "For interpolation to work, every master needs the same glyphs, and every glyph the same number of contours and nodes, in the same order. Varialo checks your fonts and, when something doesn't match, shows you exactly where.",
    "hero.aboutText3":
      "Everything happens in your browser: fonts are never uploaded to a server. The generated font is always a variable .ttf.",
    "hero.credits":
      "The first version of Varialo was developed by Rocco Modugno for the Sabotaggio Tipografico workshop by Edoardo Pensieri at IED Torino.",
    "status.place": "Put a font on each of the {count} vertices.",
    "status.folderMismatch": "“{name}” contains {count} fonts, but the space has {vertices} vertices. Change the number of axes, clear the vertices or drag the fonts one by one.",
    "status.axisErrors": "Fix the flagged axes before building.",
    "status.rebuilding": "Updating the variable font…",
    "library.title": "Library",
    "library.import": "Import fonts",
    "library.empty": "Drop your .ttf or .otf fonts here, static or variable, or use “Import fonts”. Variable fonts are unpacked into folders with their corners.",
    "library.hint": "Drag the icons onto the vertices. Click an icon to see it in the preview.",
    "library.selected": "Selected: {name}. Now click a vertex.",
    "library.dragHint": "Drag onto a vertex · click: preview",
    "library.folderDragHint": "Drag the folder onto the design space to fill every vertex · click: preview",
    "library.remove": "Remove from the library",
    "library.collapse": "Close folder",
    "library.expand": "Open folder",
    "library.variable": "variable",
    "library.cornerCount": "{count} corners",
    "library.pickAxes": "This font has more than {max} axes: choose which ones to unpack. The others stay fixed at the value shown.",
    "library.pinValue": "Fixed value",
    "library.noteDefault": "The default font ({tag} {value}) is not a corner: unpacking only the extremes loses this intermediate design.",
    "library.notePinned": "Fixed axes: {list}.",
    "library.unreadable": "“{name}” cannot be read as a font.",
    "axis.title": "Axis",
    "axis.preset": "Axis type",
    "axis.custom": "Custom",
    "axis.tag": "Tag",
    "axis.start": "Value at A (default)",
    "axis.end": "Value at the end",
    "axis.info.custom": "Custom axis. On web pages it is used with font-variation-settings: \"{tag}\" value.",
    "axis.info.wght": "Registered axis: CSS font-weight also controls it. Values 1–1000 (400 = Regular, 700 = Bold).",
    "axis.info.wdth": "Registered axis: CSS font-stretch also controls it. Values in % of the normal width (100).",
    "axis.info.ital": "Registered axis: 0 = upright, 1 = italic.",
    "axis.info.slnt": "Registered axis: slant in degrees (negative = leaning right). CSS: font-style: oblique.",
    "axis.info.opsz": "Registered axis: optical size in points. Browsers set it automatically from the font size.",
    "axis.err.tagLength": "The tag must have exactly 4 characters.",
    "axis.err.tagLowercase": "Lowercase tags are reserved for registered axes: use {upper}.",
    "axis.err.tagChars": "Custom tag: only uppercase letters A–Z and digits, starting with a letter.",
    "axis.err.tagDuplicate": "The tag {tag} is already used by another axis.",
    "axis.err.nameEmpty": "Give the axis a name.",
    "axis.err.number": "Enter two numbers.",
    "axis.err.sameValues": "The value at A and the end value must be different.",
    "axis.err.tooBig": "Values must be between -{limit} and {limit}.",
    "axis.err.range.wght": "wght accepts values from {min} to {max}.",
    "axis.err.range.wdth": "wdth accepts values from {min} to {max} (percent).",
    "axis.err.range.ital": "ital only accepts values between {min} and {max}.",
    "axis.err.range.slnt": "slnt accepts degrees from {min} to {max}.",
    "axis.err.range.opsz": "opsz accepts values from {min} to {max}.",
    "axis.warn.nameLong": "Long name: some apps may cut it.",
    "axis.warn.decimals": "More than 3 decimals: they will be rounded.",
    "info.source": "Font",
    "info.origin": "Origin",
    "info.originVariable": "variable · {location}",
    "msg.vf_intermediate": "{font} has intermediate masters: unpacking only the extremes, the new font interpolates linearly between the corners and the intermediate designs are lost.",
    "msg.vf_avar": "{font} uses a non-linear interpolation curve (avar): in the new font interpolation between the corners will be linear.",
    "library.download": "Download as a static font",
    "library.downloadFolder": "Download every corner as static fonts (.zip)",
    "axis.edit": "Click to choose the axis type, tag and name",
    "axis.close": "Close",
    "status.exporting": "Preparing the static font…",
    "status.exported": "Downloaded: {name}.",
    "status.exportFailed": "The font could not be exported: {error}",
    "library.previewGenerated": "Generated variable font",
    "library.previewEmpty": "Preview: import a font",
    "preview.modes": "What to show in the preview",
    "preview.modeLetter": "Letter",
    "preview.modeWord": "Word",
    "preview.modePangram": "Pangram",
    "preview.word": "Typography",
    "preview.pangram": "The quick brown fox jumps over the lazy dog.",
    "status.restored": "This configuration was already built: the variable font is ready to download again.",
    "lang.label": "Language",

    "steps.1": "Import fonts into the library",
    "steps.2": "Drag them onto the vertices and name the axes",
    "steps.3": "Build and move through the space",

    "space.title": "Design space",
    "space.axes": "Number of axes",
    "space.axis1": "1 axis",
    "space.axis2": "2 axes",
    "space.axis3": "3 axes",
    "space.fonts": "{count} fonts",
    "space.hint": "Drag the library icons onto the vertices (a folder fills every vertex) and move a font by dragging it onto another vertex. Type the values at the ends of the axes and click an axis name to rename it. After building, drag the yellow handles.",
    "space.clear": "Clear vertices",
    "space.familyName": "Variable font name",
    "space.familyPlaceholder": "Automatic: name of font A + “Variable”",
    "space.build": "Build variable font",
    "space.download": "Download variable font .ttf",

    "axis.name": "Name",
    "slot.base": "Base font",
    "slot.end": "End of axis {letters}",
    "slot.corner": "Corner {letters}",
    "slot.title": "Vertex {vertex} · {title}",
    "slot.empty": "Vertex {vertex}: drop a font here",

    "status.idle": "Idle",
    "status.working": "Working",
    "status.success": "Ready",
    "status.error": "Error",
    "status.start": "Import fonts into the library to begin.",
    "status.loadingEngine":
      "Loading the font engine (Pyodide + fontTools). The first time can take a few seconds.",
    "status.readyToBuild": "All fonts are loaded: press “Build variable font”.",
    "status.checking": "Checking font compatibility…",
    "status.ready": "Variable font ready: try it in the preview and download it from Font info.",
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
    "preview.matrixZ": "{tag} = {value} (change it with the Z axis).",
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
    "info.sourcesTitle": "Fonts on the vertices",
    "info.empty": "The details appear here when you put a font on a vertex.",
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
    "short.contour_count": "Contours: {value}.",
    "short.node_count": "Contour {contour}: {value} nodes.",
    "short.point_count": "Contour {contour}: {value} points.",
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
