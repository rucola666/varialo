// Compatibility report: verdict, how to fix, glyphs drawn with the problem
// points highlighted.

import { el, escapeHtml, svgEl } from "./dom.js";
import { t, tm } from "./i18n.js";

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

let slotLabel = (index) => String.fromCharCode(65 + index);

export function renderReport(panel, container, result, labeller) {
  if (labeller) slotLabel = labeller;
  container.innerHTML = "";
  if (!result) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  panel.classList.toggle("is-ok", Boolean(result.ok));

  const head = el("div", `report-verdict ${result.ok ? "ok" : "fail"}`);
  head.append(
    el("p", "verdict-title", t(result.ok ? "report.okTitle" : "report.failTitle")),
    el("p", "verdict-text", t(result.ok ? "report.okText" : "report.failText")),
  );
  container.append(head);

  // General issues (not tied to one glyph)
  const issues = (result.issues ?? []).filter((issue) => issue.code !== "outlines_incompatible");
  if (issues.length) {
    const list = el("ul", "issue-list");
    for (const issue of issues) list.append(el("li", "", tm(issue)));
    container.append(list);
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
      container.append(box);
    }
  }

  const frame = result.frame;
  if (result.glyphReports?.length) {
    container.append(renderGlyphSection(result.glyphReports, frame, "report.glyphsBlocking", true));
  }
  if (result.glyphWarnings?.length) {
    const section = renderGlyphSection(result.glyphWarnings, frame, "report.glyphsWarning", false);
    container.append(section);
  }

  const notes = (result.warnings ?? []).filter((w) => w.code !== "outlines_suspicious");
  if (notes.length) {
    const box = el("div", "notes");
    box.append(el("h3", "", t("report.notes")));
    const list = el("ul", "");
    for (const note of notes) list.append(el("li", "", tm(note)));
    box.append(list);
    container.append(box);
  }

  if (result.buildError) {
    const details = el("details", "technical");
    details.open = !result.issues?.length;
    details.append(el("summary", "", t("report.technical")), el("pre", "", result.buildError));
    container.append(details);
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

