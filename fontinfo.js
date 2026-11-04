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
  return names;
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
  if (tables.fvar !== undefined) {
    const start = tables.fvar;
    const axesOffset = view.getUint16(start + 4);
    const axisCount = view.getUint16(start + 8);
    const axisSize = view.getUint16(start + 10);
    for (let i = 0; i < axisCount; i++) {
      const axis = start + axesOffset + i * axisSize;
      info.axes.push({
        tag: tag(view, axis),
        min: view.getInt32(axis + 4) / 65536,
        max: view.getInt32(axis + 12) / 65536,
      });
    }
  }
  if (tables.CFF2 !== undefined) info.outline = "CFF2";
  info.familyName = info.typoFamily || info.family || "";
  info.styleName = info.typoStyle || info.style || "";
  return info;
}
