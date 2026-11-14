import { applyStaticTexts, getLanguage, initialLanguage, setLanguage, t, tm } from "./i18n.js";
import { AXIS_LETTERS, applyPreset, defaultAxis, presetForTag, PRESETS, tagFromName, validateAxis, valueAt } from "./axes.js";
import { applyLocation, el, formatNumber, variableFontFace, variationCss } from "./dom.js";
import { corners, importFile, itemName, renderLibrary, resolve } from "./library.js";
import { renderReport } from "./report.js";
import { renderSpace, updateSpace } from "./space.js";
import { pickLetters } from "./fontinfo.js";

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/";
const KEYS = "abcdefgh";

const state = {
  pyodide: null,
  library: [], // imported fonts (see library.js)
  selected: null, // {item, child} chosen in the library, waiting for a vertex
  axisCount: 1,
  vertices: {}, // vertex key -> {item, child}
  axes: [0, 1, 2].map(defaultAxis),
  positions: [0, 0, 0], // where the preview is on each axis, 0 = start, 1 = end
  exportEdited: { family: false, designer: false },
  status: { kind: "idle", key: "status.start", params: {} },
  result: null,
  build: null, // {bytes, fileName, axes}
  building: false,
  rebuildTimer: null,
  previewFace: null,
  previewUrl: null,
  fsPaths: {}, // library item id -> path in the Pyodide file system
  letters: { matrix: "M", variable: "V" }, // M for masters, V for the variable font
};

const $ = (selector) => document.querySelector(selector);
const dom = {
  library: $("#library"),
  libraryPanel: $("#library-panel"),
  importInput: $("#import-input"),
  importButton: $("#import-button"),
  libPreview: $("#lib-preview"),
  libPreviewLabel: $("#lib-preview-label"),
  designSpace: $("#design-space"),
  axisErrors: $("#axis-errors"),
  wordmark: $(".wordmark"),
  workspace: $(".workspace"),
  topRow: $(".top-row"),
  axisRadios: Array.from(document.querySelectorAll('input[name="axis-count"]')),
  familyName: $("#family-name"),
  designer: $("#designer"),
  fontInfo: $("#font-info"),
  infoSources: $("#info-sources"),
  buildButton: $("#build-button"),
  downloadButton: $("#download-button"),
  clearButton: $("#clear-button"),
  statusBadge: $("#status-badge"),
  statusText: $("#status-text"),
  reportPanel: $("#report-panel"),
  report: $("#report"),
  previewStage: $("#preview-stage"),
  previewValues: $("#preview-values"),
  sizeSlider: $("#size-slider"),
  matrixBlock: $("#matrix-block"),
  matrixNote: $("#matrix-note"),
  instanceGrid: $("#instance-grid"),
  langButtons: Array.from(document.querySelectorAll(".lang-button")),
};

// ---------------------------------------------------------------------------
// Model helpers
// ---------------------------------------------------------------------------

const activeKeys = () => KEYS.slice(0, 2 ** state.axisCount).split("");
const activeAxes = () => state.axes.slice(0, state.axisCount);
const isLive = () => Boolean(state.build && state.previewFace);

function sources() {
  const out = {};
  for (const key of activeKeys()) out[key] = resolve(state.library, state.vertices[key]);
  return out;
}

function slotLabel(index) {
  const key = KEYS[index];
  const source = resolve(state.library, state.vertices[key]);
  return source ? `${key.toUpperCase()} · ${source.label}` : key.toUpperCase();
}

function updateLetter() {
  const placed = activeKeys()
    .map((key) => resolve(state.library, state.vertices[key])?.info)
    .filter(Boolean);
  const infos = placed.length ? placed : state.library.map((item) => item.info);
  state.letters = pickLetters(infos);
}

// The VARIALO wordmark is set in the fonts being worked on: the variable font
// once it exists (following the sliders), otherwise the font on vertex A, or
// the first font of the library. Missing glyphs fall back to the interface font.
function renderHeader() {
  const word = dom.wordmark;
  let family = null;
  let location = null;
  if (isLive()) {
    family = state.previewFace.family;
    location = locationAt();
  } else {
    const source = resolve(state.library, state.vertices.a) ?? null;
    if (source?.family) {
      family = source.family;
      location = source.location;
    } else {
      const first = state.library.find((item) => item.family);
      if (first) {
        family = first.family;
        location = first.kind === "variable" ? first.pinned : null;
      }
    }
  }
  word.style.fontFamily = family ? `"${family}", var(--font-display)` : "";
  applyLocation(word, location);
  // The wordmark is bold in the interface font: with a loaded font, show the
  // font as it is (no fake bold).
  if (family && !(location && "wght" in location)) word.style.fontWeight = "400";
  word.classList.toggle("is-custom", Boolean(family));
}

function placementsOf(ref) {
  return activeKeys()
    .filter((key) => {
      const placed = state.vertices[key];
      return placed && placed.item === ref.item && (placed.child ?? null) === (ref.child ?? null);
    })
    .map((key) => key.toUpperCase());
}

function failingKeys() {
  const failing = new Set();
  for (const report of state.result?.glyphReports ?? []) {
    for (const master of report.masters) if (master.problems.length) failing.add(KEYS[master.master]);
  }
  return failing;
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

async function importFiles(files) {
  const added = [];
  for (const file of files) {
    const { item, error, params } = await importFile(file);
    if (error) {
      setStatus("error", error, params);
      continue;
    }
    state.library.push(item);
    added.push(item);
  }
  updateLetter();
  drawLibrary();
  drawSpace();
  renderHeader();
  return added;
}

function drawLibrary() {
  renderLibrary(dom.library, state.library, {
    selected: state.selected,
    placementsOf,
    onSelect: (ref) => {
      state.selected = ref; // clicking only shows the font in the preview
      drawLibrary();
      renderMiniPreview();
    },
    onRemove: (id) => {
      const item = state.library.find((entry) => entry.id === id);
      if (item?.face) document.fonts.delete(item.face);
      state.library = state.library.filter((entry) => entry.id !== id);
      delete state.fsPaths[id];
      for (const key of KEYS) if (state.vertices[key]?.item === id) delete state.vertices[key];
      if (state.selected?.item === id) state.selected = null;
      placementsChanged();
    },
    onToggle: (id) => {
      const item = state.library.find((entry) => entry.id === id);
      item.open = !item.open;
      drawLibrary();
    },
    onDownload: (ref) => void downloadMaster(ref),
    onDownloadFolder: (id) => void downloadFolder(id),
    onAxesChange: (id, axesUsed, pinned) => {
      const item = state.library.find((entry) => entry.id === id);
      item.axesUsed = axesUsed;
      item.pinned = pinned;
      for (const key of KEYS) if (state.vertices[key]?.item === id) delete state.vertices[key];
      placementsChanged();
    },
  });
  renderMiniPreview();
}

function place(key, ref) {
  state.vertices[key] = { item: ref.item, child: ref.child ?? null };
  placementsChanged();
}

// A variable font folder fills all the vertices (if the number of corners
// matches the design space, or the space is still empty).
function fillFromFolder(item) {
  const list = corners(item);
  const axes = Math.log2(list.length);
  const empty = activeKeys().every((key) => !state.vertices[key]);
  if (axes !== state.axisCount) {
    if (empty && axes >= 1 && axes <= 3) {
      setAxisCount(axes, { keepVertices: true });
    } else {
      setStatus("error", "status.folderMismatch", {
        name: itemName(item),
        count: list.length,
        vertices: 2 ** state.axisCount,
      });
      return;
    }
  }
  list.forEach((corner, index) => {
    state.vertices[KEYS[index]] = { item: item.id, child: corner.index };
  });
  placementsChanged();
}

async function dropFiles(key, files) {
  const added = await importFiles(files);
  if (!added.length) return;
  const first = added[0];
  if (first.kind === "variable") fillFromFolder(first);
  else if (key) place(key, { item: first.id, child: null });
}

function dropRef(key, data) {
  const item = state.library.find((entry) => entry.id === data.item);
  if (!item) return;
  if (data.folder) {
    fillFromFolder(item);
    return;
  }
  if (!key) return;
  if (data.fromVertex) {
    // Moving a font from one vertex to another (swap if the target is taken).
    if (data.fromVertex === key) return;
    const target = state.vertices[key];
    state.vertices[key] = { item: data.item, child: data.child ?? null };
    if (target) state.vertices[data.fromVertex] = target;
    else delete state.vertices[data.fromVertex];
    placementsChanged();
    return;
  }
  place(key, data);
}

// Clicking a vertex shows its font in the small preview under the library.
function clickVertex(key) {
  const ref = state.vertices[key];
  if (ref) {
    state.selected = ref;
    drawLibrary();
  }
}

// Small preview under the library: the clicked font (a matrix, or a variable
// font folder), or the generated variable font once it exists.
function renderMiniPreview() {
  const stage = dom.libPreview;
  let family = null;
  let location = null;
  let label = "";
  if (isLive()) {
    family = state.previewFace.family;
    location = locationAt();
    label = `${t("library.previewGenerated")} · ${Object.entries(location)
      .map(([tag, value]) => `${tag} ${formatNumber(value)}`)
      .join(" · ")}`;
  } else {
    let ref = state.selected;
    if (ref && !state.library.some((item) => item.id === ref.item)) ref = null;
    if (!ref && state.library.length) {
      const first = state.library[0];
      ref = first.kind === "variable" ? { item: first.id, child: null, folder: true } : { item: first.id, child: null };
    }
    const item = ref && state.library.find((entry) => entry.id === ref.item);
    if (item && item.kind === "variable" && (ref.folder || ref.child === null)) {
      family = item.family;
      location = item.pinned;
      label = `${itemName(item)} · ${t("library.variable")}`;
    } else if (ref) {
      const source = resolve(state.library, ref);
      if (source) {
        family = source.family;
        location = source.location;
        label = source.label;
      }
    }
  }
  stage.style.fontFamily = family ? `"${family}", var(--font-display)` : "";
  applyLocation(stage, location);
  stage.classList.toggle("is-empty", !family);
  dom.libPreviewLabel.textContent = label || t("library.previewEmpty");
}

function placementsChanged() {
  clearResults();
  suggestAxes();
  updateLetter();
  prefillExport();
  drawLibrary();
  drawSpace();
  renderFontInfo();
  renderHeader();
  updateIdleStatus();
}

// When both ends of an axis come from the same variable font and differ on
// exactly one of its axes, propose that axis (unless the student edited it).
function suggestAxes() {
  for (let i = 0; i < state.axisCount; i++) {
    if (state.axes[i].edited) continue;
    const startRef = state.vertices.a;
    const endRef = state.vertices[KEYS[1 << i]];
    const start = resolve(state.library, startRef);
    const end = resolve(state.library, endRef);
    let suggestion = null;
    if (start?.location && end?.location && startRef.item === endRef.item) {
      const changed = Object.keys(start.location).filter((tag) => start.location[tag] !== end.location[tag]);
      if (changed.length === 1) {
        const tag = changed[0];
        const fvarAxis = start.info.axes.find((axis) => axis.tag === tag);
        const preset = presetForTag(tag);
        suggestion = {
          preset,
          tag,
          name: preset === "custom" ? fvarAxis?.name || tag : PRESETS[preset].name,
          start: start.location[tag],
          end: end.location[tag],
          edited: false,
          tagEdited: false,
          suggested: true,
        };
      }
    }
    state.axes[i] = suggestion ?? defaultAxis(i);
  }
}

// ---------------------------------------------------------------------------
// Design space
// ---------------------------------------------------------------------------

function spaceContext() {
  return {
    axisCount: state.axisCount,
    axes: state.axes,
    sources: sources(),
    selected: state.selected,
    letter: state.letters.matrix,
    variableLetter: state.letters.variable,
    refAt: (key) => state.vertices[key] ?? null,
    pointFont: isLive() ? { family: state.previewFace.family, location: locationAt() } : null,
    errorList: dom.axisErrors,
    failing: failingKeys(),
    isLive,
    positions: () => state.positions,
    onDropFiles: (key, files) => void dropFiles(key, files),
    onDropRef: dropRef,
    onClickVertex: clickVertex,
    onMove: (index, value) => {
      state.positions[index] = value;
      updateLive();
    },
    onMovePoint: ([x, y]) => {
      state.positions[0] = x;
      state.positions[1] = y;
      updateLive();
    },
    onPreset: (index, key) => {
      state.axes[index] = applyPreset(state.axes[index], key, index);
      axesChanged();
    },
    onAxisInput: (index, patch) => {
      const axis = { ...state.axes[index], ...patch, edited: true };
      if ("name" in patch && axis.preset === "custom" && !axis.tagEdited) {
        axis.tag = tagFromName(patch.name, AXIS_LETTERS[index]);
      }
      state.axes[index] = axis;
      axesChanged();
    },
  };
}

function drawSpace() {
  if (!dom.designSpace.querySelector(".space-svg") || dom.designSpace.dataset.axes !== String(state.axisCount)) {
    renderSpace(dom.designSpace, spaceContext());
  } else {
    updateSpace(dom.designSpace, spaceContext());
  }
}

function axesChanged() {
  updateSpace(dom.designSpace, spaceContext());
  if (state.build || state.result?.ok === false) scheduleRebuild();
}

function updateLive() {
  updateSpace(dom.designSpace, spaceContext());
  applyPreview();
  renderMatrix();
  renderHeader();
  renderMiniPreview();
}

function setAxisCount(count, { keepVertices = false } = {}) {
  if (state.axisCount === count) return;
  state.axisCount = count;
  dom.axisRadios.forEach((radio) => {
    radio.checked = Number(radio.value) === count;
  });
  if (!keepVertices) placementsChanged();
  else drawSpace();
}

function axisErrors() {
  return activeAxes().some((axis) => validateAxis(axis, activeAxes()).some((p) => p.level === "error"));
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

function setStatus(kind, key, params = {}) {
  state.status = { kind, key, params };
  renderStatus();
}

function renderStatus() {
  const { kind, key, params } = state.status;
  dom.statusBadge.textContent = t(`status.${kind}`);
  dom.statusBadge.className = `status-badge ${kind}`;
  dom.statusText.textContent = t(key, params);
}

function updateIdleStatus() {
  const keys = activeKeys();
  const missing = keys.filter((key) => !state.vertices[key]).length;
  if (state.building) return;
  if (missing) setStatus("idle", state.library.length ? "status.place" : "status.start", { count: keys.length });
  else setStatus("idle", "status.readyToBuild");
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

async function ensureEngine() {
  if (state.pyodide) return state.pyodide;
  setStatus("working", "status.loadingEngine");
  const [pyodide, source] = await Promise.all([
    loadPyodide({ indexURL: PYODIDE_URL }),
    fetch("./engine.py", { cache: "no-cache" }).then((response) => {
      if (!response.ok) throw new Error(`engine.py: HTTP ${response.status}`);
      return response.text();
    }),
  ]);
  await pyodide.loadPackage("fonttools");
  pyodide.runPython(source);
  state.pyodide = pyodide;
  return pyodide;
}

async function fsPath(pyodide, item) {
  if (state.fsPaths[item.id]) return state.fsPaths[item.id];
  const path = `/tmp/${item.id}-${item.file.name.replace(/[^a-z0-9._-]/gi, "_")}`;
  pyodide.FS.writeFile(path, new Uint8Array(await item.file.arrayBuffer()));
  state.fsPaths[item.id] = path;
  return path;
}

function scheduleRebuild() {
  clearTimeout(state.rebuildTimer);
  state.rebuildTimer = setTimeout(() => void handleBuild({ silent: true }), 700);
}

async function handleBuild({ silent = false } = {}) {
  if (state.building) {
    scheduleRebuild();
    return;
  }
  const keys = activeKeys();
  const missing = keys.filter((key) => !resolve(state.library, state.vertices[key]));
  if (missing.length) {
    setStatus("error", "status.missing", { list: missing.map((key) => key.toUpperCase()).join(", ") });
    return;
  }
  if (axisErrors()) {
    setStatus("error", "status.axisErrors");
    return;
  }

  if (!silent) clearResults();
  state.building = true;
  dom.buildButton.disabled = true;
  try {
    const pyodide = await ensureEngine();
    setStatus("working", silent ? "status.rebuilding" : "status.checking");
    await new Promise((resolveFrame) => requestAnimationFrame(() => setTimeout(resolveFrame, 20)));

    const resolved = keys.map((key) => resolve(state.library, state.vertices[key]));
    const requestSources = [];
    for (const source of resolved) {
      requestSources.push({
        path: await fsPath(pyodide, source.item),
        location: source.location,
        fileName: source.location ? `${source.file.name} (${source.shortLabel})` : source.file.name,
        styleName: source.styleName,
      });
    }
    const outputPath = `/tmp/varialo-${Date.now()}.ttf`;
    const request = {
      sources: requestSources,
      labels: keys.map((key) => key.toUpperCase()),
      axes: activeAxes().map((axis) => ({
        tag: axis.tag,
        name: axis.name.trim(),
        start: Number(axis.start),
        end: Number(axis.end),
      })),
      familyName: dom.familyName.value.trim() || null,
      designer: dom.designer.value.trim() || null,
    };
    const buildFn = pyodide.globals.get("build_variable_font");
    const result = JSON.parse(buildFn(JSON.stringify(request), outputPath));
    buildFn.destroy?.();
    state.result = result;
    renderReport(dom.reportPanel, dom.report, result, slotLabel);
    placeReport(result.ok);

    if (!result.ok) {
      state.build = null;
      dom.downloadButton.disabled = true;
      resetPreviewFont();
      dom.infoSources.open = true;
      drawSpace();
      setStatus("error", "status.notCompatible");
      if (!silent) dom.reportPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const bytes = pyodide.FS.readFile(result.outputPath);
    const fileBase = (result.familyName || "Varialo Variable").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    state.build = { bytes, axes: result.axes, fileName: `${fileBase || "Varialo-Variable"}.ttf` };
    await loadPreviewFont(bytes);
    dom.downloadButton.disabled = false;
    updateLive();
    drawSpace();
    setStatus("success", "status.ready");
  } catch (error) {
    console.error(error);
    state.result = { ok: false, issues: [], warnings: [], buildError: error.message || String(error) };
    renderReport(dom.reportPanel, dom.report, state.result, slotLabel);
    placeReport(false);
    setStatus("error", "status.engineFailed");
  } finally {
    state.building = false;
    dom.buildButton.disabled = false;
  }
}

// The report sits at the bottom of the page, unless the font could not be
// built: then it goes right under the design space.
function placeReport(ok) {
  if (ok) dom.workspace.append(dom.reportPanel);
  else dom.topRow.after(dom.reportPanel);
}

function saveBytes(bytes, fileName, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportEntry(source, path) {
  return {
    path,
    location: source.location,
    styleName: source.styleName,
    fileName: source.file.name,
  };
}

// Download a font of the library as a static font (a corner of a variable
// font is cut out with the engine, so it can be edited on its own).
async function downloadMaster(ref) {
  const source = resolve(state.library, ref);
  if (!source) return;
  if (!source.location) {
    saveBytes(await source.file.arrayBuffer(), source.file.name, "font/ttf");
    return;
  }
  try {
    const pyodide = await ensureEngine();
    setStatus("working", "status.exporting");
    const fn = pyodide.globals.get("export_master");
    const output = `/tmp/export-${Date.now()}`;
    const result = JSON.parse(fn(JSON.stringify(exportEntry(source, await fsPath(pyodide, source.item))), output));
    fn.destroy?.();
    if (!result.ok) throw new Error(result.error);
    saveBytes(pyodide.FS.readFile(output), result.fileName, "font/ttf");
    setStatus("success", "status.exported", { name: result.fileName });
  } catch (error) {
    console.error(error);
    setStatus("error", "status.exportFailed", { error: error.message || String(error) });
  }
}

async function downloadFolder(id) {
  const item = state.library.find((entry) => entry.id === id);
  if (!item) return;
  try {
    const pyodide = await ensureEngine();
    setStatus("working", "status.exporting");
    const path = await fsPath(pyodide, item);
    const entries = corners(item).map((corner) =>
      exportEntry(resolve(state.library, { item: id, child: corner.index }), path),
    );
    const folderName = itemName(item).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Varialo";
    const fn = pyodide.globals.get("export_folder");
    const output = `/tmp/export-${Date.now()}.zip`;
    const result = JSON.parse(fn(JSON.stringify({ folderName, entries }), output));
    fn.destroy?.();
    if (!result.ok) throw new Error(result.error);
    saveBytes(pyodide.FS.readFile(output), result.fileName, "application/zip");
    setStatus("success", "status.exported", { name: result.fileName });
  } catch (error) {
    console.error(error);
    setStatus("error", "status.exportFailed", { error: error.message || String(error) });
  }
}

function handleDownload() {
  if (!state.build) return;
  const url = URL.createObjectURL(new Blob([state.build.bytes], { type: "font/ttf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = state.build.fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

async function loadPreviewFont(bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "font/ttf" }));
  const face = variableFontFace(`VarialoPreview-${Date.now()}`, `url(${url})`);
  await face.load();
  resetPreviewFont();
  document.fonts.add(face);
  state.previewFace = face;
  state.previewUrl = url;
  if (!dom.previewStage.textContent.trim()) dom.previewStage.textContent = t("preview.sample");
  applyPreview();
}

function resetPreviewFont() {
  if (state.previewFace) document.fonts.delete(state.previewFace);
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewFace = null;
  state.previewUrl = null;
  dom.previewStage.style.fontFamily = "";
  applyLocation(dom.previewStage, null);
  renderPreviewPlaceholder();
}

function renderPreviewPlaceholder() {
  dom.previewStage.dataset.placeholder = t(state.previewFace ? "preview.placeholderAfter" : "preview.placeholderBefore");
  dom.previewStage.classList.toggle("is-live", Boolean(state.previewFace));
}

// Axis values of the built font at the given positions (0..1 per axis).
function locationAt(positions = state.positions) {
  const location = {};
  (state.build?.axes ?? []).forEach((axis, i) => {
    location[axis.tag] = valueAt(axis, positions[i] ?? 0);
  });
  return location;
}

function applyPreview() {
  dom.previewStage.style.fontSize = `${dom.sizeSlider.value}px`;
  dom.previewValues.textContent = "";
  if (!isLive()) return;
  const location = locationAt();
  dom.previewStage.style.fontFamily = `"${state.previewFace.family}", var(--font-display)`;
  applyLocation(dom.previewStage, location);
  dom.previewValues.textContent = Object.entries(location)
    .map(([tag, value]) => `"${tag}" ${formatNumber(value)}`)
    .join(", ");
  renderPreviewPlaceholder();
}

const STEPS = [0, 0.25, 0.5, 0.75, 1];
const STEPS_1D = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];

function renderMatrix() {
  dom.instanceGrid.innerHTML = "";
  if (!isLive()) {
    dom.matrixBlock.hidden = true;
    return;
  }
  dom.matrixBlock.hidden = false;
  const axes = state.build.axes;
  const twoD = axes.length >= 2;
  const columns = twoD ? STEPS : STEPS_1D;
  const rows = twoD ? STEPS : [null];
  dom.instanceGrid.style.setProperty("--cols", columns.length);
  dom.instanceGrid.classList.toggle("one-d", !twoD);
  dom.matrixNote.textContent = [
    t("preview.matrixHint"),
    axes.length === 3
      ? t("preview.matrixZ", { tag: axes[2].tag, value: formatNumber(valueAt(axes[2], state.positions[2])) })
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  dom.instanceGrid.append(el("span", "matrix-head corner", twoD ? `${axes[1].tag}↓ ${axes[0].tag}→` : `${axes[0].tag}→`));
  for (const column of columns) dom.instanceGrid.append(el("span", "matrix-head", formatNumber(valueAt(axes[0], column))));
  const near = (a, b) => Math.abs(a - b) < 0.004;
  for (const row of rows) {
    dom.instanceGrid.append(el("span", "matrix-head", row === null ? "" : formatNumber(valueAt(axes[1], row))));
    for (const column of columns) {
      const positions = [...state.positions];
      positions[0] = column;
      if (twoD) positions[1] = row;
      const cell = el("button", "instance-cell", state.letters.variable);
      cell.type = "button";
      cell.classList.toggle("is-current", near(state.positions[0], column) && (!twoD || near(state.positions[1], row)));
      cell.addEventListener("click", () => {
        state.positions[0] = column;
        if (twoD) state.positions[1] = row;
        updateLive();
      });
      const location = locationAt(positions);
      cell.style.fontFamily = `"${state.previewFace.family}", var(--font-display)`;
      applyLocation(cell, location);
      cell.title = Object.entries(location)
        .map(([tag, value]) => `${tag} ${formatNumber(value)}`)
        .join(" · ");
      dom.instanceGrid.append(cell);
    }
  }
}

// ---------------------------------------------------------------------------
// Font info
// ---------------------------------------------------------------------------

function prefillExport() {
  const info = resolve(state.library, state.vertices.a)?.info;
  if (!state.exportEdited.family) dom.familyName.value = info?.familyName ? `${info.familyName} Variable` : "";
  if (!state.exportEdited.designer) dom.designer.value = info?.designer || "";
}

const normalisedOutline = (info) => (info.outline === "CFF2" ? "CFF" : info.outline);

const INFO_ROWS = [
  ["info.source", (source) => source.shortLabel],
  ["info.family", (source) => source.info.familyName],
  ["info.style", (source) => (source.location ? source.styleName : source.info.styleName)],
  ["info.designerRow", (source) => source.info.designer],
  ["info.manufacturer", (source) => source.info.manufacturer],
  ["info.version", (source) => source.info.version],
  ["info.copyright", (source) => source.info.copyright],
  ["info.format", (source) => normalisedOutline(source.info), true],
  ["info.upm", (source) => source.info.unitsPerEm, true],
  ["info.glyphs", (source) => source.info.glyphCount, true],
  [
    "info.origin",
    (source) =>
      source.location
        ? t("info.originVariable", { location: Object.entries(source.location).map(([tag, v]) => `${tag} ${formatNumber(v)}`).join(" · ") })
        : t("info.static"),
  ],
];

function renderFontInfo() {
  const keys = activeKeys();
  const all = sources();
  dom.fontInfo.innerHTML = "";
  if (!keys.some((key) => all[key])) {
    dom.fontInfo.append(el("p", "empty", t("info.empty")));
    return;
  }
  const table = el("table", "info-table");
  const head = el("tr", "");
  head.append(el("th", "", ""));
  for (const key of keys) {
    const th = el("th", "info-col", key.toUpperCase());
    th.scope = "col";
    head.append(th);
  }
  const thead = el("thead", "");
  thead.append(head);
  table.append(thead);
  const body = el("tbody", "");
  const reference = all.a;
  for (const [key, read, mustMatch] of INFO_ROWS) {
    const row = el("tr", "");
    let mismatch = false;
    const th = el("th", "", t(key));
    th.scope = "row";
    row.append(th);
    for (const vertex of keys) {
      const source = all[vertex];
      const value = source ? read(source) ?? "" : "";
      const cell = el("td", "", value === "" ? (source ? "—" : "") : String(value));
      if (String(value).length > 28) cell.title = String(value);
      if (mustMatch && source && reference && vertex !== "a" && value !== "" && value !== read(reference)) {
        cell.classList.add("mismatch");
        cell.title = t("info.mismatch");
        mismatch = true;
      }
      row.append(cell);
    }
    if (mismatch) {
      row.classList.add("mismatch-row");
      dom.infoSources.open = true;
    }
    body.append(row);
  }
  table.append(body);
  dom.fontInfo.append(table);
}

// ---------------------------------------------------------------------------
// Reset / language / wiring
// ---------------------------------------------------------------------------

function clearResults() {
  clearTimeout(state.rebuildTimer);
  state.result = null;
  state.build = null;
  dom.downloadButton.disabled = true;
  resetPreviewFont();
  renderMatrix();
  applyPreview();
  renderReport(dom.reportPanel, dom.report, null, slotLabel);
  renderHeader();
  renderMiniPreview();
}

function clearVertices() {
  state.vertices = {};
  state.selected = null;
  state.positions = [0, 0, 0];
  state.axes = state.axes.map((axis, i) => (axis.edited ? axis : defaultAxis(i)));
  state.exportEdited = { family: false, designer: false };
  placementsChanged();
}

function renderLanguage() {
  applyStaticTexts();
  dom.langButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.lang === getLanguage())));
  document.querySelectorAll(".axis-option-count").forEach((node) => {
    node.textContent = t("space.fonts", { count: node.dataset.count });
  });
  renderStatus();
  drawLibrary();
  renderSpace(dom.designSpace, spaceContext());
  renderPreviewPlaceholder();
  renderFontInfo();
  renderReport(dom.reportPanel, dom.report, state.result, slotLabel);
  renderMatrix();
}

for (const radio of dom.axisRadios) {
  radio.addEventListener("change", () => radio.checked && setAxisCount(Number(radio.value)));
}
for (const button of dom.langButtons) {
  button.addEventListener("click", () => {
    setLanguage(button.dataset.lang);
    renderLanguage();
  });
}
dom.importButton.addEventListener("click", () => dom.importInput.click());
dom.importInput.addEventListener("change", async () => {
  const files = [...dom.importInput.files];
  dom.importInput.value = "";
  await importFiles(files);
  updateIdleStatus();
});
dom.libraryPanel.addEventListener("dragover", (event) => {
  if ([...event.dataTransfer.types].includes("Files")) {
    event.preventDefault();
    dom.libraryPanel.classList.add("dragover");
  }
});
dom.libraryPanel.addEventListener("dragleave", (event) => {
  if (!dom.libraryPanel.contains(event.relatedTarget)) dom.libraryPanel.classList.remove("dragover");
});
dom.libraryPanel.addEventListener("drop", async (event) => {
  if (!event.dataTransfer.files?.length) return;
  event.preventDefault();
  dom.libraryPanel.classList.remove("dragover");
  await importFiles([...event.dataTransfer.files]);
  updateIdleStatus();
});
dom.buildButton.addEventListener("click", () => void handleBuild());
dom.downloadButton.addEventListener("click", handleDownload);
dom.clearButton.addEventListener("click", clearVertices);
dom.sizeSlider.addEventListener("input", applyPreview);
dom.familyName.addEventListener("input", () => {
  state.exportEdited.family = dom.familyName.value.trim() !== "";
  if (state.build) scheduleRebuild();
});
dom.designer.addEventListener("input", () => {
  state.exportEdited.designer = dom.designer.value.trim() !== "";
  if (state.build) scheduleRebuild();
});

setLanguage(initialLanguage());
state.axisCount = Number(dom.axisRadios.find((radio) => radio.checked)?.value ?? 1);
clearResults();
renderLanguage();
updateIdleStatus();
applyPreview();

// Exposed for testing in the browser console.
window.varialo = { state, importFiles, dropRef, place, fillFromFolder, handleBuild, updateLive };
