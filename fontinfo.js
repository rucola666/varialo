// Reads basic metadata from a .ttf/.otf file directly in the browser,
// so the font info can be shown as soon as a font is loaded.

const NAME_IDS = {
  copyright: 0,
  family: 1,
  style: 2,
  fullName: 4,
  version: 5,
  manufacturer: 8,
  designer: 9,
  license: 13,
  typoFamily: 16,
  typoStyle: 17,
};

function tag(view, offset) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function decodeUtf16(view, offset, length) {
  let text = "";
  for (let i = 0; i + 1 < length; i += 2) text += String.fromCharCode(view.getUint16(offset + i));
  return text;
}

function decodeLatin1(view, offset, length) {
  let text = "";
  for (let i = 0; i < length; i++) text += String.fromCharCode(view.getUint8(offset + i));
  return text;
}

function readNames(view, start) {
  const count = view.getUint16(start + 2);
  const storage = start + view.getUint16(start + 4);
  const best = {}; // nameID -> {score, value}
  for (let i = 0; i < count; i++) {
    const record = start + 6 + i * 12;
    const platform = view.getUint16(record);
    const encoding = view.getUint16(record + 2);
    const language = view.getUint16(record + 4);
    const nameId = view.getUint16(record + 6);
    const length = view.getUint16(record + 8);
    const offset = storage + view.getUint16(record + 10);
    let score;
    let value;
    if (platform === 3 && (encoding === 1 || encoding === 10)) {
      score = language === 0x409 ? 3 : 2;
      value = decodeUtf16(view, offset, length);
    } else if (platform === 0) {
      score = 2;
      value = decodeUtf16(view, offset, length);
    } else if (platform === 1 && encoding === 0) {
      score = language === 0 ? 1 : 0;
      value = decodeLatin1(view, offset, length);
    } else {
      continue;
    }
    if (!best[nameId] || best[nameId].score < score) best[nameId] = { score, value: value.trim() };
  }
  const names = {};
  for (const [key, id] of Object.entries(NAME_IDS)) names[key] = best[id]?.value || "";
  names.byId = Object.fromEntries(Object.entries(best).map(([id, entry]) => [id, entry.value]));
  return names;
}

// Character map: returns a function telling whether a code point has a glyph.
function readCmap(view, start) {
  const count = view.getUint16(start + 2);
  let best = null;
  let bestScore = -1;
  for (let i = 0; i < count; i++) {
    const record = start + 4 + i * 8;
    const platform = view.getUint16(record);
    const encoding = view.getUint16(record + 2);
    const offset = start + view.getUint32(record + 4);
    const format = view.getUint16(offset);
    let score = -1;
    if (format === 12 && (platform === 3 || platform === 0)) score = 3;
    else if (format === 4 && ((platform === 3 && encoding === 1) || platform === 0)) score = 2;
    if (score > bestScore) {
      bestScore = score;
      best = { offset, format };
    }
  }
  if (!best) return () => false;
  const { offset, format } = best;
  if (format === 12) {
    const groups = view.getUint32(offset + 12);
    return (cp) => {
      for (let g = 0; g < groups; g++) {
        const base = offset + 16 + g * 12;
        if (cp >= view.getUint32(base) && cp <= view.getUint32(base + 4)) {
          return view.getUint32(base + 8) + (cp - view.getUint32(base)) !== 0;
        }
      }
      return false;
    };
  }
  const segX2 = view.getUint16(offset + 6);
  const ends = offset + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const rangeOffsets = deltas + segX2;
  return (cp) => {
    if (cp > 0xffff) return false;
    for (let s = 0; s < segX2; s += 2) {
      if (cp > view.getUint16(ends + s)) continue;
      const first = view.getUint16(starts + s);
      if (cp < first) return false;
      const delta = view.getInt16(deltas + s);
      const rangeOffset = view.getUint16(rangeOffsets + s);
      if (rangeOffset === 0) return ((cp + delta) & 0xffff) !== 0;
      const glyphAt = rangeOffsets + s + rangeOffset + (cp - first) * 2;
      const glyph = view.getUint16(glyphAt);
      return glyph !== 0 && ((glyph + delta) & 0xffff) !== 0;
    }
    return false;
  };
}

// Letters shown in the interface: "M" for a matrix (a master / static font),
// "V" for a variable font. When a font lacks them, the first glyph available
// from "a" is used, keeping the two letters different when possible.
const FALLBACK_ORDER = [..."abcdefghijklmnopqrstuvwxyz", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", ..."0123456789"];

export function pickLetter(infos, preferred = "M", avoid = null) {
  const list = infos.filter((info) => info?.hasChar);
  if (!list.length) return preferred;
  const order = [preferred, ...FALLBACK_ORDER.filter((letter) => letter !== preferred)];
  const has = (info, letter) => info.hasChar(letter.codePointAt(0));
  for (const letter of order) {
    if (letter !== avoid && list.every((info) => has(info, letter))) return letter;
  }
  for (const letter of order) {
    if (list.every((info) => has(info, letter))) return letter;
  }
  for (const letter of order) {
    if (has(list[0], letter)) return letter;
  }
  return preferred;
}

export function pickLetters(infos) {
  const matrix = pickLetter(infos, "M");
  const variable = pickLetter(infos, "V", matrix);
  return { matrix, variable };
}

export function readFontInfo(buffer) {
  const view = new DataView(buffer);
  const signature = tag(view, 0);
  if (signature === "wOFF" || signature === "wOF2") {
    return { error: "woff" };
  }
  const tables = {};
  const numTables = view.getUint16(4);
  for (let i = 0; i < numTables; i++) {
    const record = 12 + i * 16;
    tables[tag(view, record)] = view.getUint32(record + 8);
  }
  const info = {
    outline: signature === "OTTO" ? "CFF" : "TrueType",
    unitsPerEm: tables.head !== undefined ? view.getUint16(tables.head + 18) : null,
    glyphCount: tables.maxp !== undefined ? view.getUint16(tables.maxp + 4) : null,
    weightClass: tables["OS/2"] !== undefined ? view.getUint16(tables["OS/2"] + 4) : null,
    axes: [],
    ...(tables.name !== undefined ? readNames(view, tables.name) : {}),
  };
  info.instances = [];
  if (tables.fvar !== undefined) {
    const start = tables.fvar;
    const axesOffset = view.getUint16(start + 4);
    const axisCount = view.getUint16(start + 8);
    const axisSize = view.getUint16(start + 10);
    const instanceCount = view.getUint16(start + 12);
    const instanceSize = view.getUint16(start + 14);
    const fixed = (offset) => Math.round((view.getInt32(offset) / 65536) * 1000) / 1000;
    for (let i = 0; i < axisCount; i++) {
      const axis = start + axesOffset + i * axisSize;
      const axisTag = tag(view, axis);
      const nameId = view.getUint16(axis + 18);
      info.axes.push({
        tag: axisTag,
        min: fixed(axis + 4),
        default: fixed(axis + 8),
        max: fixed(axis + 12),
        name: info.byId?.[nameId] || axisTag,
        hidden: Boolean(view.getUint16(axis + 16) & 1),
      });
    }
    const instancesStart = start + axesOffset + axisCount * axisSize;
    for (let i = 0; i < instanceCount; i++) {
      const record = instancesStart + i * instanceSize;
      const nameId = view.getUint16(record);
      const coordinates = {};
      info.axes.forEach((axis, a) => {
        coordinates[axis.tag] = fixed(record + 4 + a * 4);
      });
      info.instances.push({ name: info.byId?.[nameId] || "", coordinates });
    }
  }
  if (tables.CFF2 !== undefined) info.outline = "CFF2";
  try {
    info.hasChar = tables.cmap !== undefined ? readCmap(view, tables.cmap) : () => false;
  } catch {
    info.hasChar = () => false;
  }
  info.familyName = info.typoFamily || info.family || "";
  info.styleName = info.typoStyle || info.style || "";
  return info;
}
