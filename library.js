// The library: every imported font. Static fonts are single items, variable
// fonts become folders of "corners" (one static instance per combination of
// the min/max values of up to three of their axes).

import { el, formatNumber, variationCss } from "./dom.js";
import { pickLetter, readFontInfo } from "./fontinfo.js";
import { t } from "./i18n.js";

export const MAX_UNPACKED_AXES = 3;
export const DRAG_TYPE = "application/x-varialo";

let nextId = 1;

export async function importFile(file) {
  if (!/\.(ttf|otf)$/i.test(file.name)) {
    return { error: "status.badFile", params: { name: file.name } };
  }
  const buffer = await file.arrayBuffer();
  let info;
  try {
    info = readFontInfo(buffer);
  } catch (error) {
    console.warn("Could not read", file.name, error);
    return { error: "library.unreadable", params: { name: file.name } };
  }
  const item = {
    id: `f${nextId++}`,
    file,
    info,
    kind: info.axes.length ? "variable" : "static",
    family: null,
    face: null,
    open: true,
    axesUsed: info.axes.filter((axis) => !axis.hidden).slice(0, MAX_UNPACKED_AXES).map((axis) => axis.tag),
    pinned: Object.fromEntries(info.axes.map((axis) => [axis.tag, axis.default])),
  };
  if (item.axesUsed.length === 0 && info.axes.length) item.axesUsed = [info.axes[0].tag];
  try {
    const face = new FontFace(`Lib-${item.id}`, buffer);
    await face.load();
    document.fonts.add(face);
    item.face = face;
    item.family = face.family;
  } catch (error) {
    console.warn("Preview of", file.name, "failed", error);
  }
  return { item };
}

export function itemName(item) {
  const { familyName, styleName } = item.info;
  if (!familyName) return item.file.name;
  return item.kind === "variable" ? familyName : `${familyName} ${styleName}`.trim();
}

function axisLabel(tag, value) {
  return `${tag} ${formatNumber(value)}`;
}

// Corners of a variable font, in the same order as the vertices of the
// design space (first axis varies first).
export function corners(item) {
  if (item.kind !== "variable") return [];
  const axes = item.axesUsed.map((tag) => item.info.axes.find((axis) => axis.tag === tag));
  const out = [];
  for (let index = 0; index < 2 ** axes.length; index++) {
    const location = { ...item.pinned };
    axes.forEach((axis, i) => {
      location[axis.tag] = (index >> i) & 1 ? axis.max : axis.min;
    });
    const label = axes.map((axis) => axisLabel(axis.tag, location[axis.tag])).join(" · ");
    const named = item.info.instances.find((instance) =>
      Object.entries(location).every(([tag, value]) => Math.abs((instance.coordinates[tag] ?? value) - value) < 0.01),
    );
    out.push({ index, location, label, styleName: named?.name || label, namedInstance: named?.name || "" });
  }
  return out;
}

// Resolve {item, child} to what the rest of the app needs.
export function resolve(library, ref) {
  if (!ref) return null;
  const item = library.find((entry) => entry.id === ref.item);
  if (!item) return null;
  if (item.kind === "static") {
    return {
      ref,
      item,
      file: item.file,
      location: null,
      label: itemName(item),
      shortLabel: item.file.name,
      styleName: item.info.styleName,
      family: item.family,
      info: item.info,
    };
  }
  const corner = corners(item)[ref.child];
  if (!corner) return null;
  return {
    ref,
    item,
    file: item.file,
    location: corner.location,
    label: `${itemName(item)} · ${corner.namedInstance || corner.label}`,
    shortLabel: corner.namedInstance || corner.label,
    styleName: corner.styleName,
    family: item.family,
    info: item.info,
  };
}

// Notes shown in a folder: what is lost by unpacking only the corners.
export function folderNotes(item) {
  const notes = [];
  for (const tag of item.axesUsed) {
    const axis = item.info.axes.find((entry) => entry.tag === tag);
    if (axis && axis.default !== axis.min && axis.default !== axis.max) {
      notes.push(t("library.noteDefault", { tag, value: formatNumber(axis.default) }));
    }
  }
  const pinned = item.info.axes.filter((axis) => !item.axesUsed.includes(axis.tag));
  if (pinned.length) {
    notes.push(
      t("library.notePinned", {
        list: pinned.map((axis) => axisLabel(axis.tag, item.pinned[axis.tag])).join(", "),
      }),
    );
  }
  return notes;
}

// ---------------------------------------------------------------------------
// Rendering: icon tiles to drag onto the vertices
// ---------------------------------------------------------------------------

function sameRef(a, b) {
  return a && b && a.item === b.item && (a.child ?? null) === (b.child ?? null);
}

function details(info) {
  return [info.outline, info.unitsPerEm ? `${info.unitsPerEm} UPM` : "", t("summary.glyphs", { count: info.glyphCount })]
    .filter(Boolean)
    .join(" · ");
}

function dragData(event, payload) {
  event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
  event.dataTransfer.setData("text/plain", payload.folder ? "folder" : "font");
  event.dataTransfer.effectAllowed = "copy";
}

function actionButton(symbol, titleKey, handler) {
  const button = el("button", "tile-action", symbol);
  button.type = "button";
  button.title = t(titleKey);
  button.setAttribute("aria-label", t(titleKey));
  button.draggable = false;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    handler();
  });
  return button;
}

function tile({ ref, family, location, letter, label, title, placements, selected, actions, onSelect }) {
  const node = el("div", "lib-tile");
  node.draggable = true;
  node.tabIndex = 0;
  node.setAttribute("role", "button");
  node.setAttribute("aria-pressed", String(selected));
  node.classList.toggle("is-selected", selected);
  node.title = `${title}\n${t("library.dragHint")}`;
  const glyph = el("span", "tile-glyph", letter);
  if (family) glyph.style.fontFamily = `"${family}", var(--font-display)`;
  if (location) glyph.style.fontVariationSettings = variationCss(location);
  const caption = el("span", "tile-label", label);
  const badges = el("span", "tile-badges");
  for (const letterKey of placements) badges.append(el("span", "lib-badge", letterKey));
  const tools = el("span", "tile-actions");
  tools.append(...actions);
  node.append(glyph, caption, badges, tools);
  node.addEventListener("click", () => onSelect(ref));
  node.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(ref);
    }
  });
  node.addEventListener("dragstart", (event) => dragData(event, ref));
  return node;
}

export function renderLibrary(
  container,
  library,
  { selected, placementsOf, onSelect, onRemove, onToggle, onAxesChange, onDownload, onDownloadFolder },
) {
  container.innerHTML = "";
  if (!library.length) {
    container.append(el("p", "library-empty", t("library.empty")));
    return;
  }
  let looseGrid = null;
  for (const item of library) {
    const letter = pickLetter([item.info]);
    if (item.kind === "static") {
      if (!looseGrid) {
        looseGrid = el("div", "tile-grid");
        container.append(looseGrid);
      }
      const ref = { item: item.id, child: null };
      looseGrid.append(
        tile({
          ref,
          family: item.family,
          location: null,
          letter,
          label: item.info.styleName || item.file.name,
          title: `${itemName(item)}\n${item.file.name} · ${details(item.info)}`,
          placements: placementsOf(ref),
          selected: sameRef(selected, ref),
          actions: [
            actionButton("↓", "library.download", () => onDownload(ref)),
            actionButton("×", "library.remove", () => onRemove(item.id)),
          ],
          onSelect,
        }),
      );
      continue;
    }
    looseGrid = null;

    // Variable font: a folder of corner tiles
    const folder = el("section", "lib-folder");
    folder.classList.toggle("is-open", item.open);
    const head = el("div", "lib-folder-head");
    head.draggable = true;
    head.title = t("library.folderDragHint");
    head.addEventListener("dragstart", (event) => dragData(event, { item: item.id, folder: true }));
    const toggle = el("button", "lib-toggle", item.open ? "−" : "+");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", String(item.open));
    toggle.title = t(item.open ? "library.collapse" : "library.expand");
    toggle.addEventListener("click", () => onToggle(item.id));
    const glyph = el("span", "folder-glyph", letter);
    if (item.family) glyph.style.fontFamily = `"${item.family}", var(--font-display)`;
    const text = el("span", "lib-text");
    const axesText = item.info.axes.map((axis) => `${axis.tag} ${formatNumber(axis.min)}–${formatNumber(axis.max)}`).join(" · ");
    text.append(el("strong", "", itemName(item)), el("small", "", axesText));
    text.title = `${item.file.name} · ${details(item.info)} · ${t("library.cornerCount", { count: corners(item).length })}`;
    const tools = el("span", "folder-actions");
    tools.append(
      actionButton("↓", "library.downloadFolder", () => onDownloadFolder(item.id)),
      actionButton("×", "library.remove", () => onRemove(item.id)),
    );
    head.append(toggle, glyph, text, tools);
    folder.append(head);

    if (item.open) {
      if (item.info.axes.length > MAX_UNPACKED_AXES) folder.append(axisPicker(item, onAxesChange));
      const notes = folderNotes(item);
      if (notes.length) {
        const box = el("ul", "lib-notes");
        for (const note of notes) box.append(el("li", "", note));
        folder.append(box);
      }
      const grid = el("div", "tile-grid");
      for (const corner of corners(item)) {
        const ref = { item: item.id, child: corner.index };
        grid.append(
          tile({
            ref,
            family: item.family,
            location: corner.location,
            letter,
            label: corner.namedInstance || corner.label,
            title: `${itemName(item)} · ${corner.namedInstance ? `${corner.namedInstance} · ` : ""}${corner.label}`,
            placements: placementsOf(ref),
            selected: sameRef(selected, ref),
            actions: [actionButton("↓", "library.download", () => onDownload(ref))],
            onSelect,
          }),
        );
      }
      folder.append(grid);
    }
    container.append(folder);
  }
}

function axisPicker(item, onAxesChange) {
  const box = el("div", "lib-axis-picker");
  box.append(el("p", "", t("library.pickAxes", { max: MAX_UNPACKED_AXES })));
  for (const axis of item.info.axes) {
    const used = item.axesUsed.includes(axis.tag);
    const row = el("label", "lib-axis-row");
    const check = el("input");
    check.type = "checkbox";
    check.checked = used;
    check.disabled = !used && item.axesUsed.length >= MAX_UNPACKED_AXES;
    check.addEventListener("change", () => {
      const next = check.checked
        ? item.info.axes.map((a) => a.tag).filter((tag) => tag === axis.tag || item.axesUsed.includes(tag))
        : item.axesUsed.filter((tag) => tag !== axis.tag);
      if (next.length) onAxesChange(item.id, next, item.pinned);
    });
    row.append(check, el("span", "", `${axis.tag} · ${axis.name}`));
    if (!used) {
      const value = el("input", "lib-pin");
      value.type = "number";
      value.step = "any";
      value.min = axis.min;
      value.max = axis.max;
      value.value = item.pinned[axis.tag];
      value.title = t("library.pinValue");
      value.addEventListener("change", () => {
        const number = Math.min(axis.max, Math.max(axis.min, Number(value.value)));
        onAxesChange(item.id, item.axesUsed, { ...item.pinned, [axis.tag]: Number.isFinite(number) ? number : axis.default });
      });
      row.append(value);
    }
    box.append(row);
  }
  return box;
}
