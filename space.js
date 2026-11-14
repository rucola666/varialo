// The design space: line / square / cube with the vertices where the fonts go.
// It is also the interface of the axes: every axis has a track (same length as
// the edges) with a handle, its values typed at the two ends, and a chip to
// name it. After building, a letter in the variable font shows where you are,
// with dashed guides coming from each handle.

import { AXIS_LETTERS, PRESETS, validateAxis, valueAt } from "./axes.js";
import { el, formatNumber, svgEl, variationCss } from "./dom.js";
import { DRAG_TYPE } from "./library.js";
import { t } from "./i18n.js";

// ---------------------------------------------------------------------------
// Geometry (SVG user units)
// ---------------------------------------------------------------------------

const DEPTH_ANGLE = (38 * Math.PI) / 180;
const DEPTH = [Math.cos(DEPTH_ANGLE), -Math.sin(DEPTH_ANGLE)];
const DEPTH_NORMAL = [Math.sin(DEPTH_ANGLE), Math.cos(DEPTH_ANGLE)]; // points down-right

function add(p, q, k = 1) {
  return [p[0] + q[0] * k, p[1] + q[1] * k];
}

function horizontalRuler(from, to) {
  return {
    from,
    to,
    start: [from[0], from[1] + 24, "middle"],
    end: [to[0], to[1] + 24, "middle"],
    chip: [(from[0] + to[0]) / 2, from[1] + 50, "middle"],
  };
}

function verticalRuler(from, to) {
  return {
    from,
    to,
    start: [from[0] - 12, from[1], "end"],
    end: [to[0] - 12, to[1], "end"],
    chip: [from[0] - 30, (from[1] + to[1]) / 2, "vertical"],
  };
}

function depthRuler(from, to) {
  const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  return {
    from,
    to,
    start: [from[0] + DEPTH_NORMAL[0] * 22, from[1] + DEPTH_NORMAL[1] * 22, "start"],
    end: [to[0] + DEPTH_NORMAL[0] * 22, to[1] + DEPTH_NORMAL[1] * 22, "start"],
    chip: [mid[0] + DEPTH_NORMAL[0] * 30, mid[1] + DEPTH_NORMAL[1] * 30, "start"],
  };
}

export function geometry(count) {
  if (count === 1) {
    const L = 320;
    const A = [80, 90];
    return {
      count,
      L,
      viewBox: [480, 260],
      basis: [[1, 0]],
      origin: A,
      vertices: { a: [...A, "above"], b: [...add(A, [L, 0]), "above"] },
      edges: [[A, add(A, [L, 0]), "X"]],
      rulers: [horizontalRuler([A[0], A[1] + 76], [A[0] + L, A[1] + 76])],
    };
  }
  if (count === 2) {
    const L = 260;
    const A = [170, 80];
    const B = add(A, [L, 0]);
    const C = add(A, [0, L]);
    const D = add(C, [L, 0]);
    return {
      count,
      L,
      viewBox: [500, 530],
      basis: [[1, 0], [0, 1]],
      origin: A,
      vertices: { a: [...A, "above"], b: [...B, "above"], c: [...C, "below"], d: [...D, "below"] },
      edges: [
        [A, B, "X"],
        [C, D, "X"],
        [A, C, "Y"],
        [B, D, "Y"],
      ],
      rulers: [horizontalRuler([C[0], C[1] + 82], [D[0], D[1] + 82]), verticalRuler([A[0] - 58, A[1]], [C[0] - 58, C[1]])],
    };
  }
  // Cube, oblique projection: X, Y and the depth Z have the same length.
  const L = 210;
  const A = [170, 210];
  const Z = [DEPTH[0] * L, DEPTH[1] * L];
  const B = add(A, [L, 0]);
  const C = add(A, [0, L]);
  const D = add(C, [L, 0]);
  const E = add(A, Z);
  const F = add(B, Z);
  const G = add(C, Z);
  const H = add(D, Z);
  return {
    count,
    L,
    viewBox: [690, 600],
    basis: [[1, 0], [0, 1], DEPTH],
    origin: A,
    vertices: {
      a: [...A, "above"],
      b: [...B, "above"],
      c: [...C, "below"],
      d: [...D, "below"],
      e: [...E, "above", "back"],
      f: [...F, "above", "back"],
      g: [...G, "below", "back"],
      h: [...H, "below", "back"],
    },
    edges: [
      [E, F, "X", "back"],
      [F, H, "Y", "back"],
      [G, H, "X", "back"],
      [E, G, "Y", "back"],
      [A, E, "Z"],
      [B, F, "Z"],
      [C, G, "Z", "back"],
      [D, H, "Z", "axis"],
      [A, B, "X"],
      [B, D, "Y"],
      [C, D, "X"],
      [A, C, "Y"],
    ],
    rulers: [
      horizontalRuler([C[0], C[1] + 82], [D[0], D[1] + 82]),
      verticalRuler([A[0] - 58, A[1]], [C[0] - 58, C[1]]),
      // Z runs outside the cube, to the right of D–H
      depthRuler(add(D, DEPTH_NORMAL, 54), add(H, DEPTH_NORMAL, 54)),
    ],
  };
}

function pointAt(geo, positions) {
  let p = geo.origin;
  positions.slice(0, geo.count).forEach((value, i) => {
    p = add(p, geo.basis[i], value * geo.L);
  });
  return p;
}

// Dashed projections of the point onto the figure: Y from edge A–C, X from
// edge C–D, Z from edge D–H. The line (1 axis) needs none.
function projectionStarts(geo, positions) {
  if (geo.count === 1) return [];
  const [x, y, z] = positions;
  const A = geo.origin;
  const C = add(A, geo.basis[1], geo.L);
  const starts = [add(C, geo.basis[0], x * geo.L), add(A, geo.basis[1], y * geo.L)];
  if (geo.count === 3) {
    const D = add(C, geo.basis[0], geo.L);
    starts.push(add(D, geo.basis[2], z * geo.L));
  }
  return starts;
}

function handleAt(ruler, value) {
  return [ruler.from[0] + (ruler.to[0] - ruler.from[0]) * value, ruler.from[1] + (ruler.to[1] - ruler.from[1]) * value];
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function percent(container, [x, y]) {
  const [width, height] = geometry(Number(container.dataset.axes)).viewBox;
  return [`${((x / width) * 100).toFixed(3)}%`, `${((y / height) * 100).toFixed(3)}%`];
}

function placeAt(node, container, position, anchor = "middle") {
  const [left, top] = percent(container, position);
  node.style.left = left;
  node.style.top = top;
  node.dataset.anchor = anchor;
}

export function renderSpace(container, ctx) {
  const geo = geometry(ctx.axisCount);
  const [width, height] = geo.viewBox;
  container.innerHTML = "";
  container.dataset.axes = String(ctx.axisCount);
  container.style.aspectRatio = `${width} / ${height}`;

  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, class: "space-svg" });
  const edges = svgEl("g", { class: "edges" }, svg);
  for (const [p, q, axis, kind] of geo.edges) {
    svgEl("line", { x1: p[0], y1: p[1], x2: q[0], y2: q[1], class: `edge edge-${axis}${kind ? ` edge-${kind}` : ""}` }, edges);
  }
  const plane =
    ctx.axisCount === 2
      ? svgEl("rect", { class: "plane", x: geo.origin[0], y: geo.origin[1], width: geo.L, height: geo.L }, svg)
      : null;
  const guides = svgEl("g", { class: "guides" }, svg);
  if (geo.count > 1) geo.rulers.forEach((_, i) => svgEl("line", { class: "guide", "data-axis": i }, guides));

  geo.rulers.forEach((ruler, i) => {
    const group = svgEl("g", { class: "ruler", "data-axis": i }, svg);
    const [fx, fy] = ruler.from;
    const [tx, ty] = ruler.to;
    svgEl("line", { x1: fx, y1: fy, x2: tx, y2: ty, class: "ruler-hit" }, group);
    svgEl("line", { x1: fx, y1: fy, x2: tx, y2: ty, class: "ruler-line" }, group);
    const len = Math.hypot(tx - fx, ty - fy);
    const nx = (-(ty - fy) / len) * 6;
    const ny = ((tx - fx) / len) * 6;
    for (const [x, y] of [ruler.from, ruler.to]) {
      svgEl("line", { x1: x - nx, y1: y - ny, x2: x + nx, y2: y + ny, class: "ruler-tick" }, group);
    }
    svgEl("circle", { class: "handle", r: 10, cx: fx, cy: fy, tabindex: 0, role: "slider", "data-axis": i }, group);
    wireRuler(svg, group, ruler, i, ctx);
  });
  container.append(svg);
  if (plane) wirePlane(svg, plane, geo, ctx);

  // Vertices: just the letter, no frame
  for (const [key, [x, y, side, depth]] of Object.entries(geo.vertices)) {
    const vertex = el("div", `vertex label-${side}${depth ? ` is-${depth}` : ""}`);
    placeAt(vertex, container, [x, y]);
    vertex.dataset.key = key;
    const node = el("div", "vertex-node");
    node.dataset.key = key;
    node.tabIndex = 0;
    node.addEventListener("click", () => ctx.onClickVertex(key));
    // A filled vertex can be dragged onto another vertex to move its font.
    node.addEventListener("dragstart", (event) => {
      const ref = ctx.refAt(key);
      if (!ref) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ ...ref, fromVertex: key }));
      event.dataTransfer.effectAllowed = "move";
      node.classList.add("is-dragging");
    });
    node.addEventListener("dragend", () => node.classList.remove("is-dragging"));
    node.addEventListener("dragover", (event) => {
      event.preventDefault();
      // Must match what the dragged element allows: icons from the library
      // are copied, a font dragged from another vertex is moved.
      event.dataTransfer.dropEffect = /move/i.test(event.dataTransfer.effectAllowed) ? "move" : "copy";
      node.classList.add("dragover");
    });
    node.addEventListener("dragleave", () => node.classList.remove("dragover"));
    node.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      node.classList.remove("dragover");
      const payload = event.dataTransfer.getData(DRAG_TYPE);
      if (payload) ctx.onDropRef(key, JSON.parse(payload));
      else if (event.dataTransfer.files?.length) ctx.onDropFiles(key, [...event.dataTransfer.files]);
    });
    const caption = el("span", "vertex-caption");
    caption.append(el("strong", "", key.toUpperCase()), el("span", "vertex-file"));
    vertex.append(node, caption);
    container.append(vertex);
  }

  // The point: a letter in the variable font
  const point = el("span", "space-point", "");
  point.setAttribute("aria-hidden", "true");
  container.append(point);

  // Axis editing, directly on the tracks
  geo.rulers.forEach((ruler, i) => {
    for (const end of ["start", "end"]) {
      const input = el("input", `ruler-input ruler-${end}`);
      input.type = "text";
      input.inputMode = "decimal";
      input.dataset.axis = i;
      input.dataset.end = end;
      input.setAttribute("aria-label", `${AXIS_LETTERS[i]} · ${t(end === "start" ? "axis.start" : "axis.end")}`);
      input.title = t(end === "start" ? "axis.start" : "axis.end");
      input.addEventListener("input", () => {
        const clean = input.value.replace(",", ".");
        ctx.onAxisInput(i, { [end]: clean });
      });
      placeAt(input, container, ruler[end].slice(0, 2), ruler[end][2]);
      container.append(input);
    }
    const chip = el("button", "axis-chip");
    chip.type = "button";
    chip.dataset.axis = i;
    chip.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleEditor(container, ctx, i, chip);
    });
    placeAt(chip, container, ruler.chip.slice(0, 2), ruler.chip[2]);
    container.append(chip);
  });

  container.addEventListener("dragover", (event) => {
    if ([...event.dataTransfer.types].includes(DRAG_TYPE)) event.preventDefault();
  });
  container.addEventListener("drop", (event) => {
    const payload = event.dataTransfer.getData(DRAG_TYPE);
    if (!payload) return;
    event.preventDefault();
    const data = JSON.parse(payload);
    if (data.folder) ctx.onDropRef(null, data);
  });

  updateSpace(container, ctx);
}

// ---------------------------------------------------------------------------
// Axis editor (popover next to the chip)
// ---------------------------------------------------------------------------

const PRESET_ORDER = ["custom", "wght", "wdth", "ital", "slnt", "opsz"];

function closeEditor(container) {
  container.querySelector(".axis-editor")?.remove();
  container.querySelectorAll(".axis-chip.is-open").forEach((chip) => chip.classList.remove("is-open"));
}

function toggleEditor(container, ctx, index, chip) {
  const open = container.querySelector(`.axis-editor[data-axis="${index}"]`);
  closeEditor(container);
  if (open) return;
  chip.classList.add("is-open");
  const axis = ctx.axes[index];
  const editor = el("div", "axis-editor");
  editor.dataset.axis = index;
  editor.addEventListener("click", (event) => event.stopPropagation());

  const head = el("div", "axis-editor-head");
  head.append(el("strong", "", `${t("axis.title")} ${AXIS_LETTERS[index]}`));
  const close = el("button", "axis-editor-close", "×");
  close.type = "button";
  close.title = t("axis.close");
  close.addEventListener("click", () => closeEditor(container));
  head.append(close);

  const preset = el("select", "axis-preset");
  preset.setAttribute("aria-label", t("axis.preset"));
  for (const key of PRESET_ORDER) {
    const option = el("option", "", key === "custom" ? t("axis.custom") : `${PRESETS[key].name} · ${key}`);
    option.value = key;
    option.selected = axis.preset === key;
    preset.append(option);
  }
  preset.addEventListener("change", () => {
    ctx.onPreset(index, preset.value);
    closeEditor(container);
    toggleEditor(container, ctx, index, container.querySelector(`.axis-chip[data-axis="${index}"]`));
  });

  const field = (labelKey, input) => {
    const wrap = el("label", "axis-field");
    wrap.append(el("span", "", t(labelKey)), input);
    return wrap;
  };
  const tag = el("input", "axis-tag");
  tag.value = axis.tag;
  tag.maxLength = 4;
  tag.spellcheck = false;
  tag.autocomplete = "off";
  tag.readOnly = axis.preset !== "custom";
  tag.addEventListener("input", () => {
    const clean = tag.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4);
    if (clean !== tag.value) tag.value = clean;
    ctx.onAxisInput(index, { tag: clean, tagEdited: true });
  });
  const name = el("input", "axis-name");
  name.value = axis.name;
  name.maxLength = 64;
  name.autocomplete = "off";
  name.addEventListener("input", () => {
    ctx.onAxisInput(index, { name: name.value });
    if (!ctx.axes[index].tagEdited && ctx.axes[index].preset === "custom") tag.value = ctx.axes[index].tag;
  });
  const fields = el("div", "axis-editor-fields");
  fields.append(field("axis.preset", preset), field("axis.tag", tag), field("axis.name", name));

  const info = el("ul", "axis-problems");
  editor.append(head, fields, info);
  container.append(editor);

  // Position: under the chip, kept inside the drawing
  const chipBox = chip.getBoundingClientRect();
  const box = container.getBoundingClientRect();
  const left = Math.min(Math.max(chipBox.left - box.left, 0), Math.max(0, box.width - editor.offsetWidth));
  editor.style.left = `${left}px`;
  editor.style.top = `${chipBox.bottom - box.top + 6}px`;
  updateEditor(container, ctx);
  name.focus();
}

function updateEditor(container, ctx) {
  const editor = container.querySelector(".axis-editor");
  if (!editor) return;
  const index = Number(editor.dataset.axis);
  const axes = ctx.axes.slice(0, ctx.axisCount);
  const axis = axes[index];
  const list = editor.querySelector(".axis-problems");
  list.innerHTML = "";
  const problems = validateAxis(axis, axes);
  for (const problem of problems) list.append(el("li", `axis-problem ${problem.level}`, t(problem.key, problem.params)));
  if (!problems.length) {
    list.append(
      el(
        "li",
        "axis-problem info",
        axis.preset === "custom" ? t("axis.info.custom", { tag: axis.tag }) : t(`axis.info.${axis.preset}`),
      ),
    );
  }
}

// Close the editor when clicking elsewhere / pressing Escape.
document.addEventListener("click", () => document.querySelectorAll(".design-space").forEach(closeEditor));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") document.querySelectorAll(".design-space").forEach(closeEditor);
});

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------

function svgPoint(svg, event) {
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function projectOnRuler(ruler, p) {
  const [fx, fy] = ruler.from;
  const dx = ruler.to[0] - fx;
  const dy = ruler.to[1] - fy;
  const value = ((p.x - fx) * dx + (p.y - fy) * dy) / (dx * dx + dy * dy);
  return Math.min(1, Math.max(0, value));
}

function wireRuler(svg, group, ruler, index, ctx) {
  let dragging = false;
  const move = (event) => ctx.onMove(index, projectOnRuler(ruler, svgPoint(svg, event)));
  group.addEventListener("pointerdown", (event) => {
    if (!ctx.isLive()) return;
    dragging = true;
    group.setPointerCapture(event.pointerId);
    group.classList.add("is-dragging");
    move(event);
  });
  group.addEventListener("pointermove", (event) => dragging && move(event));
  const stop = () => {
    dragging = false;
    group.classList.remove("is-dragging");
  };
  group.addEventListener("pointerup", stop);
  group.addEventListener("pointercancel", stop);
  group.querySelector(".handle").addEventListener("keydown", (event) => {
    if (!ctx.isLive()) return;
    const step = event.shiftKey ? 0.1 : 0.01;
    const current = ctx.positions()[index];
    if (["ArrowRight", "ArrowUp"].includes(event.key)) ctx.onMove(index, Math.min(1, current + step));
    else if (["ArrowLeft", "ArrowDown"].includes(event.key)) ctx.onMove(index, Math.max(0, current - step));
    else if (event.key === "Home") ctx.onMove(index, 0);
    else if (event.key === "End") ctx.onMove(index, 1);
    else return;
    event.preventDefault();
  });
}

// In the square the whole surface is a 2D slider.
function wirePlane(svg, plane, geo, ctx) {
  let dragging = false;
  const move = (event) => {
    const p = svgPoint(svg, event);
    ctx.onMovePoint([
      Math.min(1, Math.max(0, (p.x - geo.origin[0]) / geo.L)),
      Math.min(1, Math.max(0, (p.y - geo.origin[1]) / geo.L)),
    ]);
  };
  plane.addEventListener("pointerdown", (event) => {
    if (!ctx.isLive()) return;
    dragging = true;
    plane.setPointerCapture(event.pointerId);
    move(event);
  });
  plane.addEventListener("pointermove", (event) => dragging && move(event));
  plane.addEventListener("pointerup", () => (dragging = false));
  plane.addEventListener("pointercancel", () => (dragging = false));
}

// ---------------------------------------------------------------------------
// Update (cheap: called while dragging)
// ---------------------------------------------------------------------------

export function updateSpace(container, ctx) {
  const svg = container.querySelector(".space-svg");
  if (!svg) return;
  const geo = geometry(ctx.axisCount);
  const live = ctx.isLive();
  const positions = ctx.positions();
  const axes = ctx.axes.slice(0, ctx.axisCount);
  container.classList.toggle("is-live", live);

  const [px, py] = pointAt(geo, positions);
  geo.rulers.forEach((ruler, i) => {
    const axis = axes[i];
    const [hx, hy] = handleAt(ruler, positions[i] ?? 0);
    const handle = svg.querySelector(`.handle[data-axis="${i}"]`);
    handle.setAttribute("cx", hx);
    handle.setAttribute("cy", hy);
    handle.setAttribute("aria-label", `${AXIS_LETTERS[i]} · ${axis.name}`);
    handle.setAttribute("aria-valuetext", `${axis.tag} ${formatNumber(valueAt(axis, positions[i] ?? 0))}`);
    const guide = svg.querySelector(`.guide[data-axis="${i}"]`);
    const from = projectionStarts(geo, positions)[i];
    if (guide && from) {
      guide.setAttribute("x1", from[0]);
      guide.setAttribute("y1", from[1]);
      guide.setAttribute("x2", px);
      guide.setAttribute("y2", py);
    }

    for (const end of ["start", "end"]) {
      const input = container.querySelector(`.ruler-input[data-axis="${i}"][data-end="${end}"]`);
      if (document.activeElement !== input) input.value = axis[end];
      input.style.width = `${Math.max(2, String(input.value).length) + 1.5}ch`;
    }
    const chip = container.querySelector(`.axis-chip[data-axis="${i}"]`);
    const errors = validateAxis(axis, axes).filter((p) => p.level === "error");
    chip.classList.toggle("has-error", errors.length > 0);
    chip.innerHTML = "";
    chip.append(el("b", "", AXIS_LETTERS[i]), el("span", "chip-tag", axis.tag), el("span", "chip-name", axis.name));
    chip.title = t("axis.edit");
    if (live) chip.append(el("span", "chip-value", formatNumber(valueAt(axis, positions[i] ?? 0))));
  });

  const point = container.querySelector(".space-point");
  placeAt(point, container, [px, py]);
  if (live && ctx.pointFont) {
    point.style.fontFamily = `"${ctx.pointFont.family}", var(--font-display)`;
    point.style.fontVariationSettings = ctx.pointFont.variation;
  }
  // A fresh text node makes every browser redraw the glyph with the new
  // variation (some engines skip the repaint when only the variation changes).
  point.replaceChildren(document.createTextNode(ctx.variableLetter));

  for (const vertex of container.querySelectorAll(".vertex")) {
    const key = vertex.dataset.key;
    const node = vertex.querySelector(".vertex-node");
    const source = ctx.sources[key];
    node.innerHTML = "";
    node.classList.toggle("filled", Boolean(source));
    node.draggable = Boolean(source);
    vertex.classList.toggle("is-base", key === "a");
    vertex.classList.toggle("has-error", ctx.failing.has(key));
    const index = key.charCodeAt(0) - 97;
    const coords = axes
      .map((axis, i) => `${axis.tag} ${formatNumber((index >> i) & 1 ? Number(axis.end) : Number(axis.start))}`)
      .join(" · ");
    if (source) {
      const glyph = el("span", "vertex-glyph", ctx.letter);
      glyph.draggable = false;
      if (source.family) glyph.style.fontFamily = `"${source.family}", var(--font-display)`;
      if (source.location) glyph.style.fontVariationSettings = variationCss(source.location);
      node.append(glyph);
      node.title = `${key.toUpperCase()} · ${source.label}\n${coords}`;
    } else {
      node.append(el("span", "vertex-plus", "+"));
      node.title = `${t("slot.empty", { vertex: key.toUpperCase() })}\n${coords}`;
    }
    node.setAttribute("aria-label", node.title);
    const label = vertex.querySelector(".vertex-file");
    label.textContent = source ? source.shortLabel : "";
    label.title = source ? source.label : "";
  }

  updateEditor(container, ctx);
  renderAxisErrors(ctx);
}

// Errors are listed under the drawing (the chip of the axis is marked too).
function renderAxisErrors(ctx) {
  const list = ctx.errorList;
  if (!list) return;
  list.innerHTML = "";
  const axes = ctx.axes.slice(0, ctx.axisCount);
  axes.forEach((axis, i) => {
    for (const problem of validateAxis(axis, axes)) {
      if (problem.level !== "error") continue;
      list.append(el("li", "axis-problem error", `${AXIS_LETTERS[i]} · ${t(problem.key, problem.params)}`));
    }
  });
}
