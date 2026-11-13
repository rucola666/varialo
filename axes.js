// Axis definitions: presets for the OpenType registered axes, custom axes,
// and the rules that keep exported fonts readable by browsers and apps.
//
// Tested (Chromium + fontTools, see the axis test kit):
// - custom axes with UPPERCASE tags, accented names, negative / decimal /
//   very large ranges all load and interpolate;
// - registered axes (wght, wdth, slnt, opsz) also respond to plain CSS
//   (font-weight, font-stretch, font-style: oblique, optical sizing);
// - custom axes only respond to font-variation-settings;
// - fontTools happily writes a lowercase custom tag ("rond"): the spec reserves
//   lowercase tags for registered axes, so Varialo blocks it.

export const AXIS_LETTERS = ["X", "Y", "Z"];

// start = value at vertex A (the default font), end = value at the other end.
export const PRESETS = {
  custom: { tag: null, nameKey: null, start: 1, end: 1000 },
  wght: { tag: "wght", name: "Weight", start: 100, end: 900, min: 1, max: 1000 },
  wdth: { tag: "wdth", name: "Width", start: 100, end: 75, min: 1, max: 1000 },
  ital: { tag: "ital", name: "Italic", start: 0, end: 1, min: 0, max: 1 },
  slnt: { tag: "slnt", name: "Slant", start: 0, end: -12, min: -90, max: 90 },
  opsz: { tag: "opsz", name: "Optical size", start: 12, end: 72, min: 1, max: 1000 },
};

export const REGISTERED = ["wght", "wdth", "ital", "slnt", "opsz"];
const FIXED_LIMIT = 32767;

export function defaultAxis(index) {
  const letter = AXIS_LETTERS[index];
  return {
    preset: "custom",
    tag: `BLN${letter}`,
    name: `Blend ${letter}`,
    start: PRESETS.custom.start,
    end: PRESETS.custom.end,
    edited: false, // the student typed something: no automatic suggestions
    tagEdited: false,
  };
}

export function applyPreset(axis, presetKey, index) {
  const preset = PRESETS[presetKey];
  if (presetKey === "custom") {
    const fresh = defaultAxis(index);
    return { ...fresh, preset: "custom", edited: true };
  }
  return {
    ...axis,
    preset: presetKey,
    tag: preset.tag,
    name: preset.name,
    start: preset.start,
    end: preset.end,
    edited: true,
    tagEdited: false,
  };
}

// "Rotondità" -> "ROTO", "3D look" -> "X3DL"
export function tagFromName(name, letter = "X") {
  const clean = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  let tag = clean;
  if (!/^[A-Z]/.test(tag)) tag = letter + tag;
  return (tag + "XXXX").slice(0, 4);
}

export function presetForTag(tag) {
  return REGISTERED.includes(tag) ? tag : "custom";
}

// Returns a list of {key, params, level: "error"|"warning"} for one axis.
export function validateAxis(axis, allAxes) {
  const problems = [];
  const tag = axis.tag ?? "";
  if (tag.length !== 4) {
    problems.push({ key: "axis.err.tagLength", level: "error" });
  } else if (REGISTERED.includes(tag)) {
    // registered: fine
  } else if (/^[a-z0-9]{4}$/.test(tag) || /[a-z]/.test(tag)) {
    problems.push({ key: "axis.err.tagLowercase", params: { tag, upper: tag.toUpperCase() }, level: "error" });
  } else if (!/^[A-Z][A-Z0-9]{3}$/.test(tag)) {
    problems.push({ key: "axis.err.tagChars", level: "error" });
  }
  if (allAxes.filter((other) => other.tag === tag).length > 1) {
    problems.push({ key: "axis.err.tagDuplicate", params: { tag }, level: "error" });
  }
  const name = (axis.name ?? "").trim();
  if (!name) problems.push({ key: "axis.err.nameEmpty", level: "error" });
  else if (name.length > 32) problems.push({ key: "axis.warn.nameLong", level: "warning" });

  const start = Number(axis.start);
  const end = Number(axis.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || String(axis.start).trim() === "" || String(axis.end).trim() === "") {
    problems.push({ key: "axis.err.number", level: "error" });
    return problems;
  }
  if (start === end) problems.push({ key: "axis.err.sameValues", level: "error" });
  if (Math.abs(start) > FIXED_LIMIT || Math.abs(end) > FIXED_LIMIT) {
    problems.push({ key: "axis.err.tooBig", params: { limit: FIXED_LIMIT }, level: "error" });
  }
  const preset = PRESETS[tag];
  if (preset && REGISTERED.includes(tag)) {
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    if (low < preset.min || high > preset.max) {
      problems.push({ key: `axis.err.range.${tag}`, params: { min: preset.min, max: preset.max }, level: "error" });
    }
  }
  const decimals = (value) => (String(value).split(".")[1] || "").length;
  if (decimals(axis.start) > 3 || decimals(axis.end) > 3) {
    problems.push({ key: "axis.warn.decimals", level: "warning" });
  }
  return problems;
}

// Value <-> position (t from 0 at the start to 1 at the end).
export function valueAt(axis, t) {
  const value = Number(axis.start) + (Number(axis.end) - Number(axis.start)) * t;
  return roundForAxis(axis, value);
}

export function positionOf(axis, value) {
  const span = Number(axis.end) - Number(axis.start);
  return span === 0 ? 0 : Math.min(1, Math.max(0, (value - Number(axis.start)) / span));
}

export function roundForAxis(axis, value) {
  const span = Math.abs(Number(axis.end) - Number(axis.start));
  const step = span >= 50 ? 1 : span >= 5 ? 0.1 : 0.01;
  const rounded = Math.round(value / step) * step;
  return Number(rounded.toFixed(step === 1 ? 0 : step === 0.1 ? 1 : 2));
}
