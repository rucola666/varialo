import { applyStaticTexts, getLanguage, initialLanguage, setLanguage, t, tm } from "./i18n.js";
import { readFontInfo } from "./fontinfo.js";

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/";
const AXIS_LETTERS = ["X", "Y", "Z"];
const SVG_NS = "http://www.w3.org/2000/svg";

const state = {
  pyodide: null,
  axisCount: 1,
  files: {}, // vertex key -> File
  vertexFonts: {}, // vertex key -> {family, face}
  fontInfo: {}, // vertex key -> metadata read from the file
  exportEdited: { family: false, designer: false }, // user typed their own values
  status: { kind: "idle", key: "status.start", params: {} },
  result: null, // last engine result (inspection or build)
  build: null, // {bytes, fileName, axes}
  previewFace: null,
  previewUrl: null,
  axisValues: {},
};

const $ = (selector) => document.querySelector(selector);
const dom = {
  designSpace: $("#design-space"),
  axisRadios: Array.from(document.querySelectorAll('input[name="axis-count"]')),
  familyName: $("#family-name"),
  designer: $("#designer"),
  fontInfo: $("#font-info"),
  buildButton: $("#build-button"),
  downloadButton: $("#download-button"),
  clearButton: $("#clear-button"),
  statusBadge: $("#status-badge"),
  statusText: $("#status-text"),
  reportPanel: $("#report-panel"),
  report: $("#report"),
  previewStage: $("#preview-stage"),
  sizeSlider: $("#size-slider"),
  axisSliders: $("#axis-sliders"),
  matrixBlock: $("#matrix-block"),
  matrixNote: $("#matrix-note"),
  instanceGrid: $("#instance-grid"),
  langButtons: Array.from(document.querySelectorAll(".lang-button")),
};

// ---------------------------------------------------------------------------
// Design space model
// ---------------------------------------------------------------------------

function makeConfig(axisCount) {
  const axes = AXIS_LETTERS.slice(0, axisCount).map((letter) => ({
    letter,
    tag: `BLN${letter}`,
    name: `blend_${letter.toLowerCase()}`,
    label: `Blend ${letter}`,
  }));
  const slots = [];
  for (let index = 0; index < 2 ** axisCount; index++) {
    const coords = axes.map((_, axisIndex) => ((index >> axisIndex) & 1 ? 1000 : 0));
    const active = axes.filter((_, axisIndex) => coords[axisIndex] === 1000).map((a) => a.letter);
    slots.push({ key: String.fromCharCode(97 + index), coords, active });
  }
  return { axes, slots };
}

function slotTitle(slot) {
  if (slot.active.length === 0) return t("slot.base");
  if (slot.active.length === 1) return t("slot.end", { letters: slot.active[0] });
  return t("slot.corner", { letters: slot.active.join(" + ") });
}

function slotLabel(index) {
  const slot = makeConfig(state.axisCount).slots[index];
  return `${slot.key.toUpperCase()} · ${slotTitle(slot)}`;
}

// Geometry of the three diagrams (SVG user units).
const DIAGRAMS = {
  1: {
    viewBox: [400, 170],
    edges: [[60, 85, 340, 85, "X"]],
    vertices: { a: [60, 85, "above"], b: [340, 85, "above"] },
    labels: [[200, 128, "X"]],
  },
  2: {
    viewBox: [400, 360],
    edges: [
      [90, 70, 310, 70, "X"],
      [90, 290, 310, 290, "X"],
      [90, 70, 90, 290, "Y"],
      [310, 70, 310, 290, "Y"],
    ],
    vertices: { a: [90, 70, "above"], b: [310, 70, "above"], c: [90, 290, "below"], d: [310, 290, "below"] },
    labels: [[200, 330, "X"], [48, 150, "Y"]],
  },
  3: {
    // Front face = A B C D (axis Z = 0), back face = E F G H (axis Z = 1000).
    viewBox: [440, 400],
    edges: [
      [170, 60, 380, 60, "X", "back"],
      [380, 60, 380, 270, "Y", "back"],
      [380, 270, 170, 270, "X", "back"],
      [170, 270, 170, 60, "Y", "back"],
      [80, 130, 170, 60, "Z"],
      [290, 130, 380, 60, "Z"],
      [80, 340, 170, 270, "Z"],
      [290, 340, 380, 270, "Z"],
      [80, 130, 290, 130, "X"],
      [290, 130, 290, 340, "Y"],
      [290, 340, 80, 340, "X"],
      [80, 340, 80, 130, "Y"],
    ],
    vertices: {
      a: [80, 130, "above"],
      b: [290, 130, "above"],
      c: [80, 340, "below"],
      d: [290, 340, "below"],
      e: [170, 60, "above", "back"],
      f: [380, 60, "above", "back"],
      g: [170, 270, "above", "back"],
      h: [380, 270, "below", "back"],
    },
    labels: [[185, 378, "X"], [40, 205, "Y"], [108, 76, "Z"]],
  },
};

function renderDiagram() {
  const diagram = DIAGRAMS[state.axisCount];
  const [width, height] = diagram.viewBox;
  const { slots } = makeConfig(state.axisCount);

  dom.designSpace.innerHTML = "";
  dom.designSpace.style.aspectRatio = `${width} / ${height}`;
  dom.designSpace.dataset.axes = String(state.axisCount);

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("aria-hidden", "true");
  for (const [x1, y1, x2, y2, axis, depth] of diagram.edges) {
    const line = document.createElementNS(SVG_NS, "line");
    Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => line.setAttribute(k, v));
    line.setAttribute("class", `edge edge-${axis}${depth ? ` edge-${depth}` : ""}`);
    svg.append(line);
  }
  for (const [x, y, axis] of diagram.labels) {
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", "axis-label");
    group.setAttribute("transform", `translate(${x} ${y})`);
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("dy", "0.35em");
    text.textContent = axis;
    group.append(text);
    svg.append(group);
  }
  dom.designSpace.append(svg);

  for (const slot of slots) {
    const [x, y, side, depth] = diagram.vertices[slot.key];
    const vertex = document.createElement("div");
    vertex.className = `vertex label-${side}${depth ? ` is-${depth}` : ""}`;
    vertex.style.left = `${((x / width) * 100).toFixed(3)}%`;
    vertex.style.top = `${((y / height) * 100).toFixed(3)}%`;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ttf,.otf,font/ttf,font/otf";
    input.className = "vertex-input";
    input.tabIndex = -1;
    input.addEventListener("change", (event) => {
      void assignFile(slot.key, event.target.files?.[0] ?? null);
      event.target.value = "";
    });

    const node = document.createElement("button");
    node.type = "button";
    node.className = "vertex-node";
    node.dataset.key = slot.key;
    node.addEventListener("click", () => input.click());
    node.addEventListener("dragover", (event) => {
      event.preventDefault();
      node.classList.add("dragover");
    });
    node.addEventListener("dragleave", () => node.classList.remove("dragover"));
    node.addEventListener("drop", (event) => {
      event.preventDefault();
      node.classList.remove("dragover");
      void assignFile(slot.key, event.dataTransfer?.files?.[0] ?? null);
    });

    const caption = document.createElement("span");
    caption.className = "vertex-caption";
    const letter = document.createElement("strong");
    letter.textContent = slot.key.toUpperCase();
    const fileName = document.createElement("span");
    fileName.className = "vertex-file";
    caption.append(letter, fileName);

    vertex.append(input, node, caption);
    dom.designSpace.append(vertex);
  }
  refreshVertices();
}

function refreshVertices() {
  const { slots } = makeConfig(state.axisCount);
  const failing = failingMasters();
  for (const slot of slots) {
    const node = dom.designSpace.querySelector(`.vertex-node[data-key="${slot.key}"]`);
    if (!node) continue;
    const vertex = node.parentElement;
    const file = state.files[slot.key];
    const preview = state.vertexFonts[slot.key];
    const coords = slot.coords.map((value, i) => `${AXIS_LETTERS[i]} ${value}`).join(" · ");
    node.innerHTML = "";
    node.classList.toggle("filled", Boolean(file));
    node.classList.toggle("base", slot.key === "a");
    vertex.classList.toggle("has-error", failing.has(slots.indexOf(slot)));
    if (file && preview) {
      const glyph = document.createElement("span");
      glyph.className = "vertex-glyph";
      glyph.style.fontFamily = `"${preview.family}", var(--font-display)`;
      glyph.textContent = "A";
      node.append(glyph);
      node.title = `${t("slot.title", { vertex: slot.key.toUpperCase(), title: slotTitle(slot) })}\n${file.name}\n${coords}`;
    } else {
      node.textContent = "+";
      node.title = `${t("slot.empty", { vertex: slot.key.toUpperCase() })}\n${coords}`;
    }
    node.setAttribute("aria-label", node.title);
    const fileLabel = vertex.querySelector(".vertex-file");
    fileLabel.textContent = file ? file.name : "";
    fileLabel.title = file ? file.name : "";
  }
}

function failingMasters() {
  const failing = new Set();
  for (const report of state.result?.glyphReports ?? []) {
    for (const master of report.masters) {
      if (master.problems.length) failing.add(master.master);
    }
  }
  return failing;
}

async function assignFile(key, file) {
  if (!file) return;
  if (!/\.(ttf|otf)$/i.test(file.name)) {
    setStatus("error", "status.badFile", { name: file.name });
    return;
  }
  state.files[key] = file;
  const previous = state.vertexFonts[key];
  if (previous) document.fonts.delete(previous.face);
  delete state.vertexFonts[key];
  const buffer = await file.arrayBuffer();
  try {
    state.fontInfo[key] = readFontInfo(buffer);
  } catch (error) {
    console.warn("Could not read font info of", file.name, error);
    state.fontInfo[key] = null;
  }
  if (key === "a") prefillExport();
  try {
    const face = new FontFace(`Vertex-${key}-${Date.now()}`, buffer);
    await face.load();
    document.fonts.add(face);
    state.vertexFonts[key] = { family: face.family, face };
  } catch (error) {
    console.warn("Preview of", file.name, "failed", error);
  }
  clearResults();
  refreshVertices();
  updateIdleStatus();
}

function setAxisCount(count) {
  if (state.axisCount === count) return;
  state.axisCount = count;
  clearResults();
  renderDiagram();
  updateIdleStatus();
}

function updateIdleStatus() {
  const { slots } = makeConfig(state.axisCount);
  const missing = slots.filter((slot) => !state.files[slot.key]).length;
  if (missing) {
    setStatus("idle", "status.start", { count: slots.length });
  } else if (state.status.kind !== "working") {
    setStatus("idle", "status.readyToBuild");
  }
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

async function writeToFs(pyodide, file, key) {
  const path = `/tmp/${key}-${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, "_")}`;
  pyodide.FS.writeFile(path, new Uint8Array(await file.arrayBuffer()));
  return path;
}

async function handleBuild() {
  const config = makeConfig(state.axisCount);
  const missing = config.slots.filter((slot) => !state.files[slot.key]);
  if (missing.length) {
    setStatus("error", "status.missing", {
      list: missing.map((slot) => slot.key.toUpperCase()).join(", "),
    });
    return;
  }

  clearResults();
  dom.buildButton.disabled = true;
  try {
    const pyodide = await ensureEngine();
    setStatus("working", "status.checking");
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 20)));

    const paths = [];
    for (const slot of config.slots) paths.push(await writeToFs(pyodide, state.files[slot.key], slot.key));
    const outputPath = `/tmp/varialo-${Date.now()}.ttf`;
    const request = {
      paths,
      labels: config.slots.map((slot) => slot.key.toUpperCase()),
      fileNames: config.slots.map((slot) => state.files[slot.key].name),
      axes: config.axes.map(({ tag, name, label }) => ({ tag, name, label })),
      familyName: dom.familyName.value.trim() || null,
      designer: dom.designer.value.trim() || null,
    };
    const buildFn = pyodide.globals.get("build_variable_font");
    const result = JSON.parse(buildFn(JSON.stringify(request), outputPath));
    buildFn.destroy?.();
    state.result = result;

    renderReport();
    refreshVertices();

    if (!result.ok) {
      document.getElementById("info-sources").open = true;
      setStatus("error", "status.notCompatible");
      dom.reportPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const bytes = pyodide.FS.readFile(result.outputPath);
    const fileBase = (result.familyName || "Varialo Variable").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    state.build = { bytes, axes: result.axes, fileName: `${fileBase || "Varialo-Variable"}.ttf` };
    await loadPreviewFont(bytes);
    renderSliders();
    renderMatrix();
    dom.downloadButton.disabled = false;
    setStatus("success", "status.ready");
  } catch (error) {
    console.error(error);
    state.result = { ok: false, issues: [], warnings: [], buildError: error.message || String(error) };
    renderReport();
    setStatus("error", "status.engineFailed");
  } finally {
    dom.buildButton.disabled = false;
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
  resetPreviewFont();
  const url = URL.createObjectURL(new Blob([bytes], { type: "font/ttf" }));
  const face = new FontFace(`VarialoPreview-${Date.now()}`, `url(${url})`);
  await face.load();
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
  dom.previewStage.style.fontVariationSettings = "";
  renderPreviewPlaceholder();
}

function renderPreviewPlaceholder() {
  dom.previewStage.dataset.placeholder = t(state.previewFace ? "preview.placeholderAfter" : "preview.placeholderBefore");
  dom.previewStage.classList.toggle("is-live", Boolean(state.previewFace));
}

function variationSettings(overrides = {}) {
  return Object.entries({ ...state.axisValues, ...overrides })
    .map(([tag, value]) => `"${tag}" ${value}`)
    .join(", ");
}

function applyPreview() {
  dom.previewStage.style.fontSize = `${dom.sizeSlider.value}px`;
  if (!state.previewFace) return;
  dom.previewStage.style.fontFamily = `"${state.previewFace.family}", var(--font-display)`;
  dom.previewStage.style.fontVariationSettings = variationSettings();
  renderPreviewPlaceholder();
}

function renderSliders() {
  dom.axisSliders.innerHTML = "";
  state.axisValues = {};
  if (!state.build) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = t("preview.empty");
    dom.axisSliders.append(empty);
    return;
  }
  for (const axis of state.build.axes) {
    const letter = axis.tag.slice(-1);
    state.axisValues[axis.tag] = axis.minimum;
    const row = document.createElement("label");
    row.className = "slider-row";
    const name = document.createElement("span");
    name.className = "slider-name";
    name.innerHTML = `<b>${letter}</b> ${escapeHtml(t("axis.name", { letter }))} <code>${axis.tag}</code>`;
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = axis.minimum;
    slider.max = axis.maximum;
    slider.value = axis.minimum;
    const value = document.createElement("output");
    value.textContent = axis.minimum;
    slider.dataset.tag = axis.tag;
    slider.addEventListener("input", () => {
      state.axisValues[axis.tag] = Number(slider.value);
      value.textContent = slider.value;
      applyPreview();
      renderMatrix();
    });
    row.append(name, slider, value);
    dom.axisSliders.append(row);
  }
}

// Move the sliders (and the preview) to the values of a matrix cell.
function setAxisValues(values) {
  for (const [tag, value] of Object.entries(values)) {
    state.axisValues[tag] = value;
    const slider = dom.axisSliders.querySelector(`input[data-tag="${tag}"]`);
    if (slider) {
      slider.value = value;
      slider.nextElementSibling.textContent = value;
    }
  }
  applyPreview();
  renderMatrix();
}

const MATRIX_STEPS = [0, 250, 500, 750, 1000];

function renderMatrix() {
  dom.instanceGrid.innerHTML = "";
  if (!state.build || !state.previewFace) {
    dom.matrixBlock.hidden = true;
    return;
  }
  dom.matrixBlock.hidden = false;
  const tags = state.build.axes.map((axis) => axis.tag);
  const twoD = tags.length >= 2;
  const rows = twoD ? MATRIX_STEPS : [null];
  const columns = twoD ? MATRIX_STEPS : [0, 125, 250, 375, 500, 625, 750, 875, 1000];
  dom.instanceGrid.style.setProperty("--cols", columns.length);
  dom.instanceGrid.classList.toggle("one-d", !twoD);
  dom.matrixNote.textContent = [
    t("preview.matrixHint"),
    tags.length === 3 ? t("preview.matrixZ", { value: state.axisValues.BLNZ ?? 0 }) : "",
  ].filter(Boolean).join(" ");

  const corner = document.createElement("span");
  corner.className = "matrix-head corner";
  corner.textContent = twoD ? "Y↓ X→" : "X→";
  dom.instanceGrid.append(corner);
  for (const column of columns) {
    const head = document.createElement("span");
    head.className = "matrix-head";
    head.textContent = column;
    dom.instanceGrid.append(head);
  }
  for (const row of rows) {
    const head = document.createElement("span");
    head.className = "matrix-head";
    head.textContent = row ?? "";
    dom.instanceGrid.append(head);
    for (const column of columns) {
      const overrides = { [tags[0]]: column };
      if (twoD) overrides[tags[1]] = row;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "instance-cell";
      cell.classList.toggle(
        "is-current",
        Object.entries(overrides).every(([tag, v]) => state.axisValues[tag] === v),
      );
      cell.addEventListener("click", () => setAxisValues(overrides));
      cell.style.fontFamily = `"${state.previewFace.family}", var(--font-display)`;
      cell.style.fontVariationSettings = variationSettings(overrides);
      cell.title = Object.entries(overrides).map(([tag, v]) => `${tag} ${v}`).join(" · ");
      cell.textContent = "A";
      dom.instanceGrid.append(cell);
    }
  }
}

// ---------------------------------------------------------------------------
// Font summary
// ---------------------------------------------------------------------------

// Values for the exported font, taken from font A until the user edits them.
function prefillExport() {
  const info = state.fontInfo.a;
  if (!state.exportEdited.family) {
    dom.familyName.value = info?.familyName ? `${info.familyName} Variable` : "";
  }
  if (!state.exportEdited.designer) {
    dom.designer.value = info?.designer || "";
  }
}

const INFO_ROWS = [
  ["info.file", (info, file) => file?.name ?? ""],
  ["info.family", (info) => info.familyName],
  ["info.style", (info) => info.styleName],
  ["info.designerRow", (info) => info.designer],
  ["info.manufacturer", (info) => info.manufacturer],
  ["info.version", (info) => info.version],
  ["info.copyright", (info) => info.copyright],
  ["info.format", (info) => info.outline, true],
  ["info.upm", (info) => info.unitsPerEm, true],
  ["info.glyphs", (info) => info.glyphCount, true],
  ["info.weight", (info) => info.weightClass],
  [
    "info.axes",
    (info) =>
      info.axes.length
        ? info.axes.map((axis) => `${axis.tag} ${axis.min}–${axis.max}`).join(", ")
        : t("info.static"),
    true,
  ],
];

function renderFontInfo() {
  const { slots } = makeConfig(state.axisCount);
  const loaded = slots.filter((slot) => state.files[slot.key]);
  dom.fontInfo.innerHTML = "";
  if (!loaded.length) {
    dom.fontInfo.append(el("p", "empty", t("info.empty")));
    return;
  }
  const table = el("table", "info-table");
  const head = el("tr", "");
  head.append(el("th", "", ""));
  for (const slot of slots) {
    const th = el("th", "info-col", slot.key.toUpperCase());
    th.scope = "col";
    head.append(th);
  }
  const thead = el("thead", "");
  thead.append(head);
  table.append(thead);
  const body = el("tbody", "");
  const reference = state.fontInfo.a;
  for (const [key, read, mustMatch] of INFO_ROWS) {
    const row = el("tr", "");
    let rowMismatch = false;
    const th = el("th", "", t(key));
    th.scope = "row";
    row.append(th);
    for (const slot of slots) {
      const info = state.fontInfo[slot.key];
      const file = state.files[slot.key];
      let value = "";
      if (file && info && !info.error) value = read(info, file) ?? "";
      else if (file && key === "info.file") value = file.name;
      else if (file) value = "?";
      const cell = el("td", "", value === "" ? (file ? "—" : "") : String(value));
      if (String(value).length > 28) cell.title = String(value);
      if (mustMatch && file && reference && slot.key !== "a" && value !== "" && value !== read(reference, state.files.a)) {
        cell.classList.add("mismatch");
        cell.title = t("info.mismatch");
        rowMismatch = true;
      }
      row.append(cell);
    }
    if (rowMismatch) {
      row.classList.add("mismatch-row");
      document.getElementById("info-sources").open = true;
    }
    body.append(row);
  }
  table.append(body);
  dom.fontInfo.append(table);
}

// ---------------------------------------------------------------------------
// Compatibility report
// ---------------------------------------------------------------------------

const FIX_FOR_CODE = {
  node_count: "fix.nodes",
  point_count: "fix.nodes",
  point_types: "fix.nodes",
  contour_count: "fix.contours",
  missing_glyphs: "fix.glyphs",
  extra_glyphs: "fix.glyphs",
  mixed_outlines: "fix.outlines",
  unknown_outlines: "fix.outlines",
  upm: "fix.upm",
  composite_mismatch: "fix.composite",
  component_mismatch: "fix.composite",
};

function renderReport() {
  const result = state.result;
  dom.report.innerHTML = "";
  if (!result) {
    dom.reportPanel.hidden = true;
    return;
  }
  dom.reportPanel.hidden = false;
  dom.reportPanel.classList.toggle("is-ok", Boolean(result.ok));

  const head = el("div", `report-verdict ${result.ok ? "ok" : "fail"}`);
  head.append(
    el("p", "verdict-title", t(result.ok ? "report.okTitle" : "report.failTitle")),
    el("p", "verdict-text", t(result.ok ? "report.okText" : "report.failText")),
  );
  dom.report.append(head);

  // General issues (not tied to one glyph)
  const issues = (result.issues ?? []).filter((issue) => issue.code !== "outlines_incompatible");
  if (issues.length) {
    const list = el("ul", "issue-list");
    for (const issue of issues) list.append(el("li", "", tm(issue)));
    dom.report.append(list);
  }

  // How to fix
  if (!result.ok) {
    const codes = new Set((result.issues ?? []).map((issue) => issue.code));
    for (const report of result.glyphReports ?? []) {
      for (const master of report.masters) for (const p of master.problems) codes.add(p.code);
    }
    const fixes = [...new Set([...codes].map((code) => FIX_FOR_CODE[code]).filter(Boolean))];
    if (fixes.length) {
      if (fixes.includes("fix.nodes") || fixes.includes("fix.contours")) fixes.push("fix.order");
      fixes.push("fix.editor");
      const box = el("details", "fix-box fold");
      box.append(el("summary", "", t("report.howToFix")));
      const list = el("ol", "fix-list");
      for (const fix of fixes) list.append(el("li", "", t(fix)));
      box.append(list);
      dom.report.append(box);
    }
  }

  const frame = result.frame;
  if (result.glyphReports?.length) {
    dom.report.append(renderGlyphSection(result.glyphReports, frame, "report.glyphsBlocking", true));
  }
  if (result.glyphWarnings?.length) {
    const section = renderGlyphSection(result.glyphWarnings, frame, "report.glyphsWarning", false);
    dom.report.append(section);
  }

  const notes = (result.warnings ?? []).filter((w) => w.code !== "outlines_suspicious");
  if (notes.length) {
    const box = el("div", "notes");
    box.append(el("h3", "", t("report.notes")));
    const list = el("ul", "");
    for (const note of notes) list.append(el("li", "", tm(note)));
    box.append(list);
    dom.report.append(box);
  }

  if (result.buildError) {
    const details = el("details", "technical");
    details.open = !result.issues?.length;
    details.append(el("summary", "", t("report.technical")), el("pre", "", result.buildError));
    dom.report.append(details);
  }
}

function renderGlyphSection(reports, frame, titleKey, blocking) {
  const section = el("details", `glyph-section ${blocking ? "blocking" : "warning"}`);
  section.open = blocking;
  const summary = el("summary", "");
  summary.append(el("span", "", t(titleKey, { count: reports.length })));
  section.append(summary);
  if (!blocking) section.append(el("p", "section-note", t("report.glyphsWarningText")));

  section.append(legend());

  const visual = reports.filter((report) => report.masters.every((m) => m.visual));
  const rest = reports.filter((report) => !report.masters.every((m) => m.visual));
  for (const report of visual) section.append(renderGlyphCard(report, frame));
  if (rest.length) {
    section.append(el("p", "more-glyphs", t("report.moreGlyphs", { list: rest.map((r) => r.glyph).join(", ") })));
  }
  return section;
}

function legend() {
  const box = el("div", "legend");
  box.innerHTML = `
    <span><i class="key key-bad"></i>${escapeHtml(t("report.legendBad"))}</span>
    <span><i class="key key-contour"></i>${escapeHtml(t("report.legendContour"))}</span>
    <span><i class="key key-start"></i>${escapeHtml(t("report.legendStart"))}</span>`;
  return box;
}

function renderGlyphCard(report, frame) {
  const card = el("article", "glyph-card");
  const name = report.char && report.char !== report.glyph ? `${report.glyph} · “${report.char}”` : report.glyph;
  card.append(el("h4", "glyph-card-title", t("report.glyph", { name })));
  const row = el("div", "glyph-row");
  const bounds = sharedBounds(report.masters, frame);
  for (const master of report.masters) {
    const figure = el("figure", `glyph-figure ${master.master === 0 ? "reference" : ""}`);
    figure.append(glyphSvg(master.visual, bounds, frame));
    const caption = el("figcaption", "");
    const label = slotLabel(master.master) + (master.master === 0 ? ` (${t("report.reference")})` : "");
    caption.append(el("strong", "", label));
    const lines = master.master === 0 ? referenceLines(report) : master.problems.map(shortProblem);
    if (lines.length) {
      const list = el("ul", "");
      for (const line of lines) list.append(el("li", "", line));
      caption.append(list);
    }
    figure.append(caption);
    row.append(figure);
  }
  card.append(row);
  return card;
}

// Problems that compare counts: the reference value is shown once, under the
// reference glyph; the other glyphs only show their own value.
const COUNT_CODES = new Set(["contour_count", "node_count", "point_count"]);

function shortProblem(problem) {
  if (!COUNT_CODES.has(problem.code)) return tm(problem);
  return t(`short.${problem.code}`, { ...problem.params, value: problem.params.other });
}

function referenceLines(report) {
  const lines = [];
  for (const master of report.masters) {
    for (const problem of master.problems) {
      if (!COUNT_CODES.has(problem.code)) continue;
      const line = t(`short.${problem.code}`, { ...problem.params, value: problem.params.base });
      if (!lines.includes(line)) lines.push(line);
    }
  }
  return lines;
}

function sharedBounds(masters, frame) {
  let xMin = 0;
  let xMax = 0;
  let yMin = frame.descender;
  let yMax = frame.ascender;
  for (const master of masters) {
    xMax = Math.max(xMax, master.visual.advance || 0);
    for (const contour of master.visual.contours) {
      for (const [x, y] of contour.points) {
        xMin = Math.min(xMin, x);
        xMax = Math.max(xMax, x);
        yMin = Math.min(yMin, y);
        yMax = Math.max(yMax, y);
      }
    }
  }
  const pad = frame.upm * 0.08;
  return { xMin: xMin - pad, xMax: xMax + pad, yMin: yMin - pad, yMax: yMax + pad };
}

function svgEl(name, attributes = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  parent?.append(node);
  return node;
}

function glyphSvg(visual, bounds, frame) {
  const width = bounds.xMax - bounds.xMin;
  const height = bounds.yMax - bounds.yMin;
  const unit = frame.upm / 1000;
  const svg = svgEl("svg", {
    viewBox: `${bounds.xMin} ${-bounds.yMax} ${width} ${height}`,
    class: "glyph-svg",
    role: "img",
  });
  // metrics
  const metrics = svgEl("g", { class: "metrics" }, svg);
  for (const y of [0, frame.ascender, frame.descender]) {
    svgEl("line", { x1: bounds.xMin, x2: bounds.xMax, y1: -y, y2: -y }, metrics);
  }
  for (const x of [0, visual.advance]) {
    svgEl("line", { x1: x, x2: x, y1: -bounds.yMax, y2: -bounds.yMin }, metrics);
  }

  const glyph = svgEl("g", { transform: "scale(1 -1)" }, svg);
  svgEl("path", { d: visual.path, class: "glyph-fill" }, glyph);
  visual.contours.forEach((contour) => {
    svgEl("path", { d: contour.path, class: contour.highlight ? "contour bad" : "contour" }, glyph);
  });

  const bad = new Set(visual.badPoints.map(([c, p]) => `${c}:${p}`));
  const overlay = svgEl("g", { class: "points" }, svg);
  const r = 9 * unit;
  visual.contours.forEach((contour, ci) => {
    const pts = contour.points;
    // handles: off-curve points connect to neighbouring on-curve points
    pts.forEach(([x, y, on], pi) => {
      if (on) return;
      for (const neighbour of [pts[(pi - 1 + pts.length) % pts.length], pts[(pi + 1) % pts.length]]) {
        if (neighbour[2]) {
          svgEl("line", { x1: x, y1: -y, x2: neighbour[0], y2: -neighbour[1], class: "handle" }, overlay);
        }
      }
    });
    pts.forEach(([x, y, on], pi) => {
      if (on) {
        svgEl("rect", { x: x - r * 0.8, y: -y - r * 0.8, width: r * 1.6, height: r * 1.6, class: "node" }, overlay);
      } else {
        svgEl("circle", { cx: x, cy: -y, r: r * 0.7, class: "offcurve" }, overlay);
      }
      if (pi === 0) svgEl("circle", { cx: x, cy: -y, r: r * 2, class: "start" }, overlay);
    });
    pts.forEach(([x, y], pi) => {
      if (!bad.has(`${ci}:${pi}`)) return;
      svgEl("circle", { cx: x, cy: -y, r: r * 2.6, class: "bad-point" }, overlay);
    });
  });
  return svg;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(tag, className = "", text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = text;
  return node;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clearResults() {
  state.result = null;
  state.build = null;
  dom.downloadButton.disabled = true;
  resetPreviewFont();
  renderSliders();
  renderMatrix();
  renderReport();
  renderFontInfo();
  refreshVertices();
}

function clearAll() {
  for (const { face } of Object.values(state.vertexFonts)) document.fonts.delete(face);
  state.files = {};
  state.vertexFonts = {};
  state.fontInfo = {};
  state.exportEdited = { family: false, designer: false };
  prefillExport();
  clearResults();
  updateIdleStatus();
}

function renderLanguage() {
  applyStaticTexts();
  dom.langButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.lang === getLanguage())));
  document.querySelectorAll(".axis-option-count").forEach((node) => {
    node.textContent = t("space.fonts", { count: node.dataset.count });
  });
  renderStatus();
  refreshVertices();
  renderPreviewPlaceholder();
  renderFontInfo();
  renderReport();
  if (state.build) {
    // keep slider values while relabelling
    const values = { ...state.axisValues };
    renderSliders();
    dom.axisSliders.querySelectorAll("input").forEach((slider, index) => {
      const tag = state.build.axes[index].tag;
      slider.value = values[tag] ?? 0;
      slider.nextElementSibling.textContent = slider.value;
      state.axisValues[tag] = Number(slider.value);
    });
    applyPreview();
    renderMatrix();
  } else {
    renderSliders();
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

for (const radio of dom.axisRadios) {
  radio.addEventListener("change", () => radio.checked && setAxisCount(Number(radio.value)));
}
for (const button of dom.langButtons) {
  button.addEventListener("click", () => {
    setLanguage(button.dataset.lang);
    renderLanguage();
  });
}
dom.buildButton.addEventListener("click", handleBuild);
dom.downloadButton.addEventListener("click", handleDownload);
dom.clearButton.addEventListener("click", clearAll);
dom.sizeSlider.addEventListener("input", applyPreview);
dom.familyName.addEventListener("input", () => {
  state.exportEdited.family = dom.familyName.value.trim() !== "";
});
dom.designer.addEventListener("input", () => {
  state.exportEdited.designer = dom.designer.value.trim() !== "";
});

setLanguage(initialLanguage());
state.axisCount = Number(dom.axisRadios.find((radio) => radio.checked)?.value ?? 1);
renderDiagram();
clearResults();
updateIdleStatus();
renderLanguage();
applyPreview();

// Exposed for testing in the browser console.
window.varialo = { state, renderReport, renderFontInfo, refreshVertices };
