export const SVG_NS = "http://www.w3.org/2000/svg";

export function el(tag, className = "", text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = text;
  return node;
}

export function svgEl(name, attributes = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  parent?.append(node);
  return node;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function variationCss(location) {
  if (!location) return "";
  return Object.entries(location)
    .map(([tag, value]) => `"${tag}" ${value}`)
    .join(", ");
}

export function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
}

// Apply an axis location to an element. Besides font-variation-settings, the
// registered axes are also set with the regular CSS properties, which every
// browser (Safari included) applies to variable fonts.
export function applyLocation(node, location) {
  node.style.fontVariationSettings = location ? variationCss(location) : "";
  const wght = location?.wght;
  const wdth = location?.wdth;
  const slnt = location?.slnt;
  node.style.fontWeight = wght !== undefined && wght >= 1 && wght <= 1000 ? String(wght) : "";
  node.style.fontStretch = wdth !== undefined && wdth > 0 ? `${wdth}%` : "";
  node.style.fontStyle = slnt !== undefined && slnt !== 0 ? `oblique ${-slnt}deg` : "";
}

// FontFace that accepts the full weight / width / slant ranges, so the CSS
// properties above can reach every value of a variable font.
export function variableFontFace(name, source) {
  try {
    return new FontFace(name, source, { weight: "1 1000", stretch: "1% 1000%", style: "oblique -90deg 90deg" });
  } catch {
    return new FontFace(name, source);
  }
}
