// The design space: line / square / cube with the vertices where the fonts go,
// one slider track per axis (same length as the edges) and the point that
// shows where the preview is inside the space.

import { AXIS_LETTERS, PRESETS, positionOf, valueAt, validateAxis } from "./axes.js";
import { el, formatNumber, svgEl, variationCss } from "./dom.js";
import { DRAG_TYPE } from "./library.js";
import { t } from "./i18n.js";

// ---------------------------------------------------------------------------
// Geometry (SVG user units)
// ---------------------------------------------------------------------------

const DEPTH_ANGLE = (38 * Math.PI) / 180;

function add(p, q, k = 1) {
  return [p[0] + q[0] * k, p[1] + q[1] * k];
}

export function geometry(count) {
  if (count === 1) {
    const L = 300;
    const A = [70, 70];
    const X = [L, 0];
    return {
      count,
      L,
      viewBox: [440, 205],
      basis: [[1, 0]],
      origin: A,
      vertices: { a: [...A, "above"], b: [...add(A, X), "above"] },
      edges: [[A, add(A, X), "X"]],
      rulers: [horizontalRuler([70, 142], [370, 142])],
    };
  }
  if (count === 2) {
    const L = 240;
    const A = [150, 80];
    const X = [L, 0];
    const Y = [0, L];
    const B = add(A, X);
    const C = add(A, Y);
    const D = add(C, X);
    return {
      count,
      L,
      viewBox: [470, 470],
      basis: [[1, 0], [0, 1]],
      origin: A,
      vertices: { a: [...A, "above"], b: [...B, "above"], c: [...C, "below"], d: [...D, "below"] },
      edges: [
        [A, B, "X"],
        [C, D, "X"],
        [A, C, "Y"],
        [B, D, "Y"],
      ],
      rulers: [horizontalRuler([C[0], C[1] + 86], [D[0], D[1] + 86]), verticalRuler([A[0] - 62, A[1]], [C[0] - 62, C[1]])],
    };
  }
  // Cube, oblique projection: X, Y and the depth Z have the same length.
  const L = 200;
  const depth = [Math.cos(DEPTH_ANGLE), -Math.sin(DEPTH_ANGLE)];
  const A = [150, 196];
  const X = [L, 0];
  const Y = [0, L];
  const Z = [depth[0] * L, depth[1] * L];
  const B = add(A, X);
  const C = add(A, Y);
  const D = add(C, X);
  const E = add(A, Z);
  const F = add(B, Z);
  const G = add(C, Z);
  const H = add(D, Z);
  const zShift = [46, 0]; // the Z track runs parallel to C–G, a bit to the right
  return {
    count,
    L,
    viewBox: [570, 540],
    basis: [[1, 0], [0, 1], depth],
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
      [D, H, "Z"],
      [C, G, "Z", "axis"],
      [A, B, "X"],
      [B, D, "Y"],
      [C, D, "X"],
      [A, C, "Y"],
    ],
    rulers: [
      horizontalRuler([C[0], C[1] + 86], [D[0], D[1] + 86]),
      verticalRuler([A[0] - 62, A[1]], [C[0] - 62, C[1]]),
      depthRuler(add(C, zShift), add(G, zShift), depth),
    ],
  };
}

// Each track knows where its labels go: values at the two ends, axis letter.
function horizontalRuler(from, to) {
  return {
    from,
    to,
    labels: {
      start: [from[0], from[1] + 22, "middle"],
      end: [to[0], to[1] + 22, "middle"],
      letter: [(from[0] + to[0]) / 2, from[1] + 30, "middle"],
    },
  };
}

function verticalRuler(from, to) {
  return {
    from,
    to,
    labels: {
      start: [from[0] - 14, from[1], "end"],
      end: [to[0] - 14, to[1], "end"],
      letter: [from[0] - 14, from[1] + 64, "end"],
    },
  };
}

function depthRuler(from, to, direction) {
  const normal = [Math.sin(DEPTH_ANGLE), Math.cos(DEPTH_ANGLE)];
  const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  return {
    from,
    to,
    labels: {
      start: [from[0], from[1] + 22, "middle"],
      end: [to[0] + direction[0] * 16, to[1] + direction[1] * 16, "start"],
      letter: [mid[0] + normal[0] * 22, mid[1] + normal[1] * 22, "start"],
    },
  };
}

function pointAt(geo, positions) {
  let p = geo.origin;
  positions.slice(0, geo.count).forEach((tValue, i) => {
    p = add(p, geo.basis[i], tValue * geo.L);
  });
  return p;
}

function pathTo(geo, positions) {
  const points = [geo.origin];
  let p = geo.origin;
  positions.slice(0, geo.count).forEach((tValue, i) => {
    p = add(p, geo.basis[i], tValue * geo.L);
    points.push(p);
  });
  return points;
}

// ---------------------------------------------------------------------------
// Diagram
// ---------------------------------------------------------------------------

export function renderSpace(container, ctx) {
  const geo = geometry(ctx.axisCount);
  const [width, height] = geo.viewBox;
  container.innerHTML = "";
  container.style.aspectRatio = `${width} / ${height}`;
  container.dataset.axes = String(ctx.axisCount);

  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, class: "space-svg" });
  const edges = svgEl("g", { class: "edges" }, svg);
  for (const [p, q, axis, kind] of geo.edges) {
    svgEl("line", { x1: p[0], y1: p[1], x2: q[0], y2: q[1], class: `edge edge-${axis}${kind ? ` edge-${kind}` : ""}` }, edges);
  }
  svgEl("polyline", { class: "point-path", points: "" }, svg);

  // Tracks
  geo.rulers.forEach((ruler, i) => {
    const group = svgEl("g", { class: "ruler", "data-axis": i }, svg);
    const [fx, fy] = ruler.from;
    const [tx, ty] = ruler.to;
    svgEl("line", { x1: fx, y1: fy, x2: tx, y2: ty, class: "ruler-hit" }, group);
    svgEl("line", { x1: fx, y1: fy, x2: tx, y2: ty, class: "ruler-line" }, group);
    const dx = tx - fx;
    const dy = ty - fy;
    const len = Math.hypot(dx, dy);
    const nx = (-dy / len) * 6;
    const ny = (dx / len) * 6;
    for (const [x, y] of [ruler.from, ruler.to]) {
      svgEl("line", { x1: x - nx, y1: y - ny, x2: x + nx, y2: y + ny, class: "ruler-tick" }, group);
    }
    const label = (role, className) => {
      const [x, y, anchor] = ruler.labels[role];
      const text = svgEl("text", { class: className, x, y, "text-anchor": anchor }, group);
      text.dataset.role = role;
      return text;
    };
    label("start", "ruler-value");
    label("end", "ruler-value");
    const letter = label("letter", "ruler-letter");
    letter.textContent = AXIS_LETTERS[i];
    const [lx, ly, anchor] = ruler.labels.letter;
    svgEl("text", { class: "ruler-tag", x: lx, y: ly + 17, "text-anchor": anchor }, group);
    svgEl("circle", { class: "handle", r: 10, cx: fx, cy: fy, tabindex: 0, role: "slider", "data-axis": i }, group);
    wireRuler(svg, group, ruler, i, ctx);
  });

  // In the square the whole surface is a 2D slider: press anywhere inside.
  const plane =
    ctx.axisCount === 2
      ? svgEl("rect", { class: "plane", x: geo.origin[0], y: geo.origin[1], width: geo.L, height: geo.L }, svg)
      : null;
  const point = svgEl("circle", { class: "space-point", r: 8 }, svg);
  if (plane) wirePoint(svg, [plane, point], geo, ctx);
  container.append(svg);

  for (const [key, [x, y, side, depth]] of Object.entries(geo.vertices)) {
    const vertex = el("div", `vertex label-${side}${depth ? ` is-${depth}` : ""}`);
    vertex.style.left = `${((x / width) * 100).toFixed(3)}%`;
    vertex.style.top = `${((y / height) * 100).toFixed(3)}%`;
    vertex.dataset.key = key;
    const input = el("input", "vertex-input");
    input.type = "file";
    input.accept = ".ttf,.otf,font/ttf,font/otf";
    input.tabIndex = -1;
    input.addEventListener("change", (event) => {
      const files = [...(event.target.files ?? [])];
      event.target.value = "";
      if (files.length) ctx.onDropFiles(key, files);
    });
    const node = el("button", "vertex-node");
    node.type = "button";
    node.dataset.key = key;
    node.addEventListener("click", () => {
      if (!ctx.onClickVertex(key)) input.click();
    });
    node.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
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
    vertex.append(input, node, caption);
    container.append(vertex);
  }

  // Dropping a whole folder anywhere on the diagram fills every vertex.
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
  const tValue = ((p.x - fx) * dx + (p.y - fy) * dy) / (dx * dx + dy * dy);
  return Math.min(1, Math.max(0, tValue));
}

function wireRuler(svg, group, ruler, index, ctx) {
  let dragging = false;
  const move = (event) => {
    if (!ctx.isLive()) return;
    ctx.onMove(index, projectOnRuler(ruler, svgPoint(svg, event)));
  };
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
  const handle = group.querySelector(".handle");
  handle.addEventListener("keydown", (event) => {
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

function wirePoint(svg, targets, geo, ctx) {
  const point = targets[targets.length - 1];
  let dragging = null;
  const move = (event) => {
    const p = svgPoint(svg, event);
    const tx = Math.min(1, Math.max(0, (p.x - geo.origin[0]) / geo.L));
    const ty = Math.min(1, Math.max(0, (p.y - geo.origin[1]) / geo.L));
    ctx.onMovePoint([tx, ty]);
  };
  for (const target of targets) {
    target.addEventListener("pointerdown", (event) => {
      if (!ctx.isLive()) return;
      dragging = target;
      target.setPointerCapture(event.pointerId);
      point.classList.add("is-dragging");
      move(event);
    });
    target.addEventListener("pointermove", (event) => dragging === target && move(event));
    const stop = () => {
      dragging = null;
      point.classList.remove("is-dragging");
    };
    target.addEventListener("pointerup", stop);
    target.addEventListener("pointercancel", stop);
  }
}

export function updateSpace(container, ctx) {
  const svg = container.querySelector(".space-svg");
  if (!svg) return;
  const geo = geometry(ctx.axisCount);
  const live = ctx.isLive();
  const positions = ctx.positions();
  container.classList.toggle("is-live", live);

  geo.rulers.forEach((ruler, i) => {
    const group = svg.querySelector(`.ruler[data-axis="${i}"]`);
    const axis = ctx.axes[i];
    group.querySelector('[data-role="start"]').textContent = formatNumber(Number(axis.start));
    group.querySelector('[data-role="end"]').textContent = formatNumber(Number(axis.end));
    group.querySelector(".ruler-tag").textContent = axis.tag;
    const handle = group.querySelector(".handle");
    const tValue = positions[i] ?? 0;
    handle.setAttribute("cx", ruler.from[0] + (ruler.to[0] - ruler.from[0]) * tValue);
    handle.setAttribute("cy", ruler.from[1] + (ruler.to[1] - ruler.from[1]) * tValue);
    handle.setAttribute("aria-valuetext", `${axis.tag} ${formatNumber(valueAt(axis, tValue))}`);
    handle.setAttribute("aria-label", `${AXIS_LETTERS[i]} · ${axis.name}`);
  });

  const point = svg.querySelector(".space-point");
  const [px, py] = pointAt(geo, positions);
  point.setAttribute("cx", px);
  point.setAttribute("cy", py);
  point.classList.toggle("is-draggable", ctx.axisCount === 2);
  svg.querySelector(".point-path").setAttribute("points", pathTo(geo, positions).map((p) => p.join(",")).join(" "));

  for (const vertex of container.querySelectorAll(".vertex")) {
    const key = vertex.dataset.key;
    const node = vertex.querySelector(".vertex-node");
    const source = ctx.sources[key];
    node.innerHTML = "";
    node.classList.toggle("filled", Boolean(source));
    node.classList.toggle("base", key === "a");
    node.classList.toggle("can-place", Boolean(ctx.selected));
    vertex.classList.toggle("has-error", ctx.failing.has(key));
    const index = key.charCodeAt(0) - 97;
    const coords = ctx.axes
      .slice(0, ctx.axisCount)
      .map((axis, i) => `${axis.tag} ${formatNumber((index >> i) & 1 ? Number(axis.end) : Number(axis.start))}`)
      .join(" · ");
    if (source) {
      const glyph = el("span", "vertex-glyph", "A");
      if (source.family) glyph.style.fontFamily = `"${source.family}", var(--font-display)`;
      if (source.location) glyph.style.fontVariationSettings = variationCss(source.location);
      node.append(glyph);
      node.title = `${key.toUpperCase()} · ${source.label}\n${coords}`;
    } else {
      node.textContent = "+";
      node.title = `${t("slot.empty", { vertex: key.toUpperCase() })}\n${coords}`;
    }
    node.setAttribute("aria-label", node.title);
    const label = vertex.querySelector(".vertex-file");
    label.textContent = source ? source.shortLabel : "";
    label.title = source ? source.label : "";
  }
}

// ---------------------------------------------------------------------------
// Axis rows (under the diagram)
// ---------------------------------------------------------------------------

const PRESET_ORDER = ["custom", "wght", "wdth", "ital", "slnt", "opsz"];

export function renderAxisRows(container, ctx) {
  container.innerHTML = "";
  ctx.axes.slice(0, ctx.axisCount).forEach((axis, i) => {
    const row = el("div", "axis-row");
    row.dataset.axis = i;

    const head = el("div", "axis-row-head");
    head.append(el("span", "axis-badge", AXIS_LETTERS[i]));
    const preset = el("select", "axis-preset");
    preset.setAttribute("aria-label", t("axis.preset"));
    for (const key of PRESET_ORDER) {
      const option = el("option", "", key === "custom" ? t("axis.custom") : `${PRESETS[key].name} · ${key}`);
      option.value = key;
      option.selected = axis.preset === key;
      preset.append(option);
    }
    preset.addEventListener("change", () => ctx.onPreset(i, preset.value));
    head.append(preset);

    const fields = el("div", "axis-fields");
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
      ctx.onAxisInput(i, { tag: clean, tagEdited: true });
    });
    const name = el("input", "axis-name");
    name.value = axis.name;
    name.maxLength = 64;
    name.autocomplete = "off";
    name.addEventListener("input", () => ctx.onAxisInput(i, { name: name.value }));
    const start = el("input", "axis-start");
    start.type = "number";
    start.step = "any";
    start.value = axis.start;
    start.addEventListener("input", () => ctx.onAxisInput(i, { start: start.value }));
    const end = el("input", "axis-end");
    end.type = "number";
    end.step = "any";
    end.value = axis.end;
    end.addEventListener("input", () => ctx.onAxisInput(i, { end: end.value }));
    fields.append(field("axis.tag", tag), field("axis.name", name), field("axis.start", start), field("axis.end", end));

    const slide = el("div", "axis-slide");
    const slider = el("input", "axis-slider");
    slider.type = "range";
    slider.min = 0;
    slider.max = 1000;
    slider.step = 1;
    slider.setAttribute("aria-label", `${AXIS_LETTERS[i]} · ${axis.name}`);
    slider.addEventListener("input", () => ctx.onMove(i, Number(slider.value) / 1000));
    const output = el("output", "axis-value");
    slide.append(el("span", "axis-end-label axis-end-start"), slider, el("span", "axis-end-label axis-end-end"), output);

    const problems = el("ul", "axis-problems");
    row.append(head, fields, slide, problems);
    container.append(row);
  });
  updateAxisRows(container, ctx);
}

export function updateAxisRows(container, ctx) {
  const live = ctx.isLive();
  const positions = ctx.positions();
  const axes = ctx.axes.slice(0, ctx.axisCount);
  for (const row of container.querySelectorAll(".axis-row")) {
    const i = Number(row.dataset.axis);
    const axis = axes[i];
    if (!axis) continue;
    const tag = row.querySelector(".axis-tag");
    if (document.activeElement !== tag && tag.value !== axis.tag) tag.value = axis.tag;
    const slider = row.querySelector(".axis-slider");
    slider.disabled = !live;
    slider.value = Math.round((positions[i] ?? 0) * 1000);
    row.querySelector(".axis-end-start").textContent = formatNumber(Number(axis.start));
    row.querySelector(".axis-end-end").textContent = formatNumber(Number(axis.end));
    row.querySelector(".axis-value").textContent = live ? formatNumber(valueAt(axis, positions[i] ?? 0)) : "—";
    const problems = row.querySelector(".axis-problems");
    problems.innerHTML = "";
    for (const problem of validateAxis(axis, axes)) {
      problems.append(el("li", `axis-problem ${problem.level}`, t(problem.key, problem.params)));
    }
    if (axis.preset === "custom" && !problems.children.length) {
      problems.append(el("li", "axis-problem info", t("axis.info.custom", { tag: axis.tag })));
    } else if (axis.preset !== "custom" && !problems.children.length) {
      problems.append(el("li", "axis-problem info", t(`axis.info.${axis.preset}`)));
    }
    row.classList.toggle("has-error", validateAxis(axis, axes).some((p) => p.level === "error"));
  }
}

export { positionOf };
