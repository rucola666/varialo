"""VARIALO font engine.

Runs inside the browser through Pyodide (loaded by app.js) and can also be
imported by plain CPython for the tests in tests/test_engine.py.

Public entry points (both take and return JSON strings):

    inspect_fonts(payload_json)
    build_variable_font(request_json, output_path)

Every message for the user is returned as a {"code": ..., "params": {...}}
object; app.js translates the codes (Italian / English).
"""

import json
import math
import os
from io import BytesIO

from fontTools.cu2qu import curves_to_quadratic
from fontTools.designspaceLib import (
    AxisDescriptor,
    DesignSpaceDocument,
    InstanceDescriptor,
    SourceDescriptor,
)
from fontTools.pens.basePen import decomposeQuadraticSegment, decomposeSuperBezierSegment
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.reverseContourPen import ReverseContourPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont, newTable
from fontTools.varLib import build as varlib_build
from fontTools.varLib import instancer

MAX_VISUAL_GLYPHS = 12
MAX_LISTED_GLYPHS = 40


def _msg(code, **params):
    return {"code": code, "params": params}


# ---------------------------------------------------------------------------
# Font metadata
# ---------------------------------------------------------------------------


def _name(font, *name_ids):
    if "name" not in font:
        return None
    for name_id in name_ids:
        value = font["name"].getDebugName(name_id)
        if value:
            return value
    return None


def _outline_kind(font):
    if "glyf" in font:
        return "TrueType"
    if "CFF2" in font:
        # A static CFF2 font (e.g. an instance unpacked from a variable .otf)
        # has cubic outlines exactly like CFF.
        return "CFF2" if "fvar" in font else "CFF"
    if "CFF " in font:
        return "CFF"
    return "Unknown"


def _font_summary(font, path, label, file_name=None):
    file_name = file_name or os.path.basename(path)
    return {
        "displayName": _name(font, 4, 1, 6) or file_name,
        "styleName": _name(font, 17, 2) or "",
        "fileName": file_name,
        "glyphCount": len(font.getGlyphOrder()),
        "unitsPerEm": font["head"].unitsPerEm if "head" in font else None,
        "outlineKind": _outline_kind(font),
        "slotLabel": label,
    }


# ---------------------------------------------------------------------------
# Outline recording
#
# Every glyph of every master is drawn into a RecordingPen and normalised into
# contours made of single segments, so TrueType and CFF fonts are compared the
# same way, using the points the designer actually drew.
# ---------------------------------------------------------------------------


class _Glyph:
    __slots__ = ("contours", "components", "advance", "error")

    def __init__(self):
        self.contours = []  # list of contours; contour = list of (op, points)
        self.components = []  # list of component glyph names (TrueType)
        self.advance = 0
        self.error = None


def _record_glyph(glyph_set, name):
    glyph = _Glyph()
    recorder = RecordingPen()
    try:
        glyph_set[name].draw(recorder)
        glyph.advance = getattr(glyph_set[name], "width", 0) or 0
    except Exception as exc:  # broken glyph data
        glyph.error = str(exc) or exc.__class__.__name__
        return glyph

    contour = None
    current = None
    for op, args in recorder.value:
        if op == "moveTo":
            contour = [("moveTo", [tuple(args[0])])]
            glyph.contours.append(contour)
            current = tuple(args[0])
        elif op == "lineTo":
            contour.append(("lineTo", [tuple(args[0])]))
            current = tuple(args[0])
        elif op == "curveTo":
            points = [tuple(p) for p in args]
            if len(points) == 3:
                contour.append(("curveTo", points))
            else:
                for segment in decomposeSuperBezierSegment(points):
                    contour.append(("curveTo", [tuple(p) for p in segment]))
            current = points[-1]
        elif op == "qCurveTo":
            points = [tuple(p) if p is not None else None for p in args]
            if contour is None:  # TrueType contour made only of off-curve points
                contour = [("qCurveTo", points)]
                glyph.contours.append(contour)
            else:
                contour.append(("qCurveTo", points))
            if points[-1] is not None:
                current = points[-1]
        elif op in ("closePath", "endPath"):
            if contour is not None:
                start = contour[0][1][0] if contour[0][0] == "moveTo" else None
                if op == "closePath" and start is not None and current is not None and len(contour) > 1:
                    if tuple(current) != tuple(start):
                        # Make the closing segment explicit, so every closed
                        # contour ends exactly on its start point.
                        contour.append(("lineTo", [tuple(start)]))
                contour.append((op, []))
            contour = None
        elif op == "addComponent":
            glyph.components.append(args[0])
    return glyph


def _record_font(font):
    glyph_set = font.getGlyphSet()
    return {name: _record_glyph(glyph_set, name) for name in font.getGlyphOrder()}


def _contour_points(contour):
    """Flat list of [x, y, on_curve] for a recorded contour."""
    points = []
    for op, args in contour:
        if op in ("moveTo", "lineTo"):
            points.append([args[0][0], args[0][1], True])
        elif op == "curveTo":
            points.append([args[0][0], args[0][1], False])
            points.append([args[1][0], args[1][1], False])
            points.append([args[2][0], args[2][1], True])
        elif op == "qCurveTo":
            for index, point in enumerate(args):
                if point is None:
                    continue
                points.append([point[0], point[1], index == len(args) - 1])
    # Closed contours end on their start point (see _record_glyph): drop the duplicate.
    if (
        len(points) > 1
        and contour[0][0] == "moveTo"
        and contour[-1][0] == "closePath"
        and points[-1][0] == points[0][0]
        and points[-1][1] == points[0][1]
    ):
        points.pop()
    return points


def _segment_signature(contour):
    signature = []
    for op, args in contour:
        if op == "curveTo":
            signature.append("C")
        elif op == "qCurveTo":
            signature.append("Q%d" % len(args))
        elif op == "lineTo":
            signature.append("L")
    return signature


def _signed_area(points):
    on = [p for p in points if p[2]] or points
    area = 0.0
    for index in range(len(on)):
        x1, y1 = on[index][0], on[index][1]
        x2, y2 = on[(index + 1) % len(on)][0], on[(index + 1) % len(on)][1]
        area += x1 * y2 - x2 * y1
    return area / 2.0


def _bbox(point_lists):
    xs = [p[0] for points in point_lists for p in points]
    ys = [p[1] for points in point_lists for p in points]
    if not xs:
        return (0, 0, 1, 1)
    return (min(xs), min(ys), max(xs), max(ys))


def _normalise(points, box):
    x0, y0, x1, y1 = box
    w = max(x1 - x0, 1)
    h = max(y1 - y0, 1)
    return [((p[0] - x0) / w, (p[1] - y0) / h, p[2]) for p in points]


# ---------------------------------------------------------------------------
# Finding *which* points do not match
# ---------------------------------------------------------------------------


def _align_points(points_a, points_b):
    """Align two point sequences (Needleman-Wunsch on normalised positions).

    Returns (unmatched_a, unmatched_b): indices of points that have no partner
    in the other contour. These are the points we highlight for the student.
    """
    na = _normalise(points_a, _bbox([points_a]))
    nb = _normalise(points_b, _bbox([points_b]))
    gap = 0.35
    rows, cols = len(na), len(nb)
    cost = [[0.0] * (cols + 1) for _ in range(rows + 1)]
    move = [[0] * (cols + 1) for _ in range(rows + 1)]
    for i in range(1, rows + 1):
        cost[i][0] = i * gap
        move[i][0] = 1
    for j in range(1, cols + 1):
        cost[0][j] = j * gap
        move[0][j] = 2
    for i in range(1, rows + 1):
        for j in range(1, cols + 1):
            pa, pb = na[i - 1], nb[j - 1]
            distance = math.hypot(pa[0] - pb[0], pa[1] - pb[1])
            if pa[2] != pb[2]:
                distance += 0.4
            options = (
                (cost[i - 1][j - 1] + distance, 0),
                (cost[i - 1][j] + gap, 1),
                (cost[i][j - 1] + gap, 2),
            )
            cost[i][j], move[i][j] = min(options)
    unmatched_a, unmatched_b = [], []
    i, j = rows, cols
    while i > 0 or j > 0:
        direction = move[i][j]
        if i > 0 and j > 0 and direction == 0:
            i -= 1
            j -= 1
        elif i > 0 and (j == 0 or direction == 1):
            unmatched_a.append(i - 1)
            i -= 1
        else:
            unmatched_b.append(j - 1)
            j -= 1
    return sorted(unmatched_a), sorted(unmatched_b)


def _match_contours(contours_a, contours_b, box_a, box_b):
    """Pair contours of two masters by position; returns (pairs, extra_a, extra_b)."""

    def centre(points, box):
        bx0, by0, bx1, by1 = _bbox([points])
        n = _normalise([[(bx0 + bx1) / 2, (by0 + by1) / 2, True]], box)[0]
        return n[0], n[1]

    centres_a = [centre(points, box_a) for points in contours_a]
    centres_b = [centre(points, box_b) for points in contours_b]
    candidates = []
    for i, ca in enumerate(centres_a):
        for j, cb in enumerate(centres_b):
            candidates.append((math.hypot(ca[0] - cb[0], ca[1] - cb[1]) + 0.02 * abs(i - j), i, j))
    candidates.sort()
    used_a, used_b, pairs = set(), set(), []
    for _, i, j in candidates:
        if i in used_a or j in used_b:
            continue
        used_a.add(i)
        used_b.add(j)
        pairs.append((i, j))
    extra_a = [i for i in range(len(contours_a)) if i not in used_a]
    extra_b = [j for j in range(len(contours_b)) if j not in used_b]
    return sorted(pairs), extra_a, extra_b


# ---------------------------------------------------------------------------
# Glyph compatibility
# ---------------------------------------------------------------------------


def _compare_glyph(base, other, cubic):
    """Compare one glyph of the base master against another master.

    Returns (problems, highlights_base, highlights_other).
    Problems are message dicts. Highlights are {"points": set((c, p)),
    "contours": set(c)} used for drawing.
    """
    problems = []
    hl_base = {"points": set(), "contours": set()}
    hl_other = {"points": set(), "contours": set()}

    if base.error or other.error:
        problems.append(_msg("glyph_unreadable"))
        return problems, hl_base, hl_other

    if bool(base.components) != bool(other.components) and (base.contours or other.contours):
        problems.append(_msg("composite_mismatch"))
        return problems, hl_base, hl_other
    if base.components != other.components:
        problems.append(
            _msg("component_mismatch", base=", ".join(base.components) or "-", other=", ".join(other.components) or "-")
        )

    points_base = [_contour_points(c) for c in base.contours]
    points_other = [_contour_points(c) for c in other.contours]
    box_base = _bbox(points_base)
    box_other = _bbox(points_other)

    if len(points_base) != len(points_other):
        problems.append(_msg("contour_count", base=len(points_base), other=len(points_other)))
        pairs, extra_base, extra_other = _match_contours(points_base, points_other, box_base, box_other)
        hl_base["contours"].update(extra_base)
        hl_other["contours"].update(extra_other)
    else:
        pairs = [(i, i) for i in range(len(points_base))]

    for ci, cj in pairs:
        pa, pb = points_base[ci], points_other[cj]
        if cubic:
            # PostScript/CFF: what matters is the number of nodes (on-curve
            # points). Line-vs-curve differences are fixed automatically.
            nodes_a = [k for k, p in enumerate(pa) if p[2]]
            nodes_b = [k for k, p in enumerate(pb) if p[2]]
            if len(nodes_a) != len(nodes_b):
                problems.append(_msg("node_count", contour=ci + 1, base=len(nodes_a), other=len(nodes_b)))
                ua, ub = _align_points([pa[k] for k in nodes_a], [pb[k] for k in nodes_b])
                hl_base["points"].update((ci, nodes_a[k]) for k in ua)
                hl_other["points"].update((cj, nodes_b[k]) for k in ub)
                hl_base["contours"].add(ci)
                hl_other["contours"].add(cj)
            continue
        if len(pa) != len(pb):
            problems.append(_msg("point_count", contour=ci + 1, base=len(pa), other=len(pb)))
            ua, ub = _align_points(pa, pb)
            hl_base["points"].update((ci, k) for k in ua)
            hl_other["points"].update((cj, k) for k in ub)
            hl_base["contours"].add(ci)
            hl_other["contours"].add(cj)
            continue
        if [p[2] for p in pa] != [p[2] for p in pb]:
            # Same number of points, different on/off-curve pattern.
            problems.append(_msg("point_types", contour=ci + 1))
            for k, (p, q) in enumerate(zip(pa, pb)):
                if p[2] != q[2]:
                    hl_base["points"].add((ci, k))
                    hl_other["points"].add((cj, k))
            hl_base["contours"].add(ci)
            hl_other["contours"].add(cj)

    return problems, hl_base, hl_other


def _compare_glyph_warnings(base, other, cubic):
    """Problems that do not block the build but make the blend look wrong."""
    warnings = []
    hl_base = {"points": set(), "contours": set()}
    hl_other = {"points": set(), "contours": set()}
    points_base = [_contour_points(c) for c in base.contours]
    points_other = [_contour_points(c) for c in other.contours]
    if len(points_base) != len(points_other):
        return warnings, hl_base, hl_other
    box_base = _bbox(points_base)
    box_other = _bbox(points_other)
    for ci, (pa, pb) in enumerate(zip(points_base, points_other)):
        if cubic and _segment_signature(base.contours[ci]) != _segment_signature(other.contours[ci]):
            warnings.append(_msg("line_vs_curve", contour=ci + 1))
            hl_base["contours"].add(ci)
            hl_other["contours"].add(ci)
            continue
        if len(pa) != len(pb) or len(pa) < 3:
            continue
        area_a, area_b = _signed_area(pa), _signed_area(pb)
        if area_a * area_b < 0:
            warnings.append(_msg("direction", contour=ci + 1))
            hl_base["contours"].add(ci)
            hl_other["contours"].add(ci)
            continue
        # Start point: compare where the first point sits in its contour.
        na = _normalise(pa, _bbox([pa]))
        nb = _normalise(pb, _bbox([pb]))
        start_distance = math.hypot(na[0][0] - nb[0][0], na[0][1] - nb[0][1])
        best_distance = min(math.hypot(na[0][0] - q[0], na[0][1] - q[1]) for q in nb)
        if start_distance > 0.45 and start_distance - best_distance > 0.3:
            warnings.append(_msg("start_point", contour=ci + 1))
            hl_base["points"].add((ci, 0))
            hl_other["points"].add((ci, 0))
    # Contour order: matching by position disagrees with the order in the file.
    if len(points_base) > 1:
        pairs, _, _ = _match_contours(points_base, points_other, box_base, box_other)
        if any(i != j for i, j in pairs):
            warnings.append(_msg("contour_order"))
    return warnings, hl_base, hl_other


def _glyph_visual(glyph, highlights, font):
    pen = SVGPathPen(None)
    path_pen = RecordingPen()
    for contour in glyph.contours:
        for op, args in contour:
            getattr(path_pen, op)(*args)
    path_pen.replay(pen)
    contours = []
    for index, contour in enumerate(glyph.contours):
        contour_pen = SVGPathPen(None)
        for op, args in contour:
            getattr(contour_pen, op)(*args)
        contours.append(
            {
                "path": contour_pen.getCommands(),
                "points": [[round(p[0], 1), round(p[1], 1), p[2]] for p in _contour_points(contour)],
                "highlight": index in highlights["contours"],
            }
        )
    return {
        "path": pen.getCommands(),
        "contours": contours,
        "badPoints": sorted([c, p] for c, p in highlights["points"]),
        "components": glyph.components,
        "advance": glyph.advance,
    }


def _merge_highlights(target, source):
    target["points"].update(source["points"])
    target["contours"].update(source["contours"])


def _check_outlines(fonts, recordings, labels, common_glyphs):
    """Return (glyph_reports, warning_reports)."""
    cubic = _outline_kind(fonts[0]) == "CFF"
    reports = []
    warning_reports = []
    cmap = fonts[0].getBestCmap() or {}
    chars = {}
    for code, name in cmap.items():
        chars.setdefault(name, chr(code))

    # Real glyphs first; .notdef and other technical glyphs at the end.
    for name in sorted(common_glyphs, key=lambda n: n.startswith(".")):
        base = recordings[0][name]
        blocking = []
        soft = []
        hl_base = {"points": set(), "contours": set()}
        hl_base_soft = {"points": set(), "contours": set()}
        for index in range(1, len(fonts)):
            other = recordings[index][name]
            problems, hb, ho = _compare_glyph(base, other, cubic)
            if problems:
                _merge_highlights(hl_base, hb)
                blocking.append({"master": index, "problems": problems, "highlights": ho})
                continue
            warns, hb, ho = _compare_glyph_warnings(base, other, cubic)
            if warns:
                _merge_highlights(hl_base_soft, hb)
                soft.append({"master": index, "problems": warns, "highlights": ho})

        for collection, entries, base_hl in ((reports, blocking, hl_base), (warning_reports, soft, hl_base_soft)):
            if not entries:
                continue
            collection.append(
                {
                    "glyph": name,
                    "char": chars.get(name, ""),
                    "base": base_hl,
                    "entries": entries,
                }
            )

    def materialise(items):
        out = []
        for position, item in enumerate(items):
            entry = {
                "glyph": item["glyph"],
                "char": item["char"],
                "masters": [],
            }
            visual = position < MAX_VISUAL_GLYPHS
            masters = [(0, [], item["base"])] + [
                (e["master"], e["problems"], e["highlights"]) for e in item["entries"]
            ]
            for master_index, problems, highlights in masters:
                block = {"master": master_index, "label": labels[master_index], "problems": problems}
                if visual:
                    block["visual"] = _glyph_visual(recordings[master_index][item["glyph"]], highlights, fonts[master_index])
                entry["masters"].append(block)
            out.append(entry)
        return out

    return materialise(reports), materialise(warning_reports)


def _font_frame(font):
    upm = font["head"].unitsPerEm
    ascender, descender = upm * 0.8, -upm * 0.2
    if "OS/2" in font and font["OS/2"].sTypoAscender:
        ascender = font["OS/2"].sTypoAscender
        descender = font["OS/2"].sTypoDescender
    elif "hhea" in font:
        ascender = font["hhea"].ascent
        descender = font["hhea"].descent
    return {"upm": upm, "ascender": ascender, "descender": descender}


# ---------------------------------------------------------------------------
# Inspection
# ---------------------------------------------------------------------------


def _variable_font_notes(font, label):
    """Things that get lost when a variable font is unpacked at its corners."""
    notes = []
    if "avar" in font:
        segments = font["avar"].segments
        if any(any(abs(k - v) > 1e-3 for k, v in mapping.items()) for mapping in segments.values()):
            notes.append(_msg("vf_avar", font=label))
    peaks = set()
    if "gvar" in font:
        for variations in font["gvar"].variations.values():
            for variation in variations:
                for tag, (start, peak, end) in variation.axes.items():
                    peaks.add(round(peak, 3))
    if "CFF2" in font:
        try:
            store = font["CFF2"].cff.topDictIndex[0].VarStore.otVarStore
            for region in store.VarRegionList.Region:
                for axis in region.VarRegionAxis:
                    if axis.PeakCoord:
                        peaks.add(round(axis.PeakCoord, 3))
        except Exception:
            pass
    if any(p not in (-1.0, 0.0, 1.0) for p in peaks):
        notes.append(_msg("vf_intermediate", font=label))
    return notes


def _instantiate(font, location):
    """Cut a static font out of a variable font at `location` ({tag: value})."""
    full = {}
    for axis in font["fvar"].axes:
        value = location.get(axis.axisTag, axis.defaultValue)
        full[axis.axisTag] = min(max(float(value), axis.minValue), axis.maxValue)
    static = instancer.instantiateVariableFont(font, full, inplace=False)
    buffer = BytesIO()
    static.save(buffer)
    buffer.seek(0)
    return TTFont(buffer, recalcBBoxes=False, recalcTimestamp=False)


def _load(sources, labels, notes=None):
    """Load the source fonts. A source is a path, or {"path", "location"} for
    an instance to cut out of a variable font."""
    fonts = []
    seen = set()
    for index, source in enumerate(sources):
        if isinstance(source, str):
            source = {"path": source}
        font = TTFont(source["path"], recalcBBoxes=False, recalcTimestamp=False)
        location = source.get("location")
        if location is not None and "fvar" in font:
            if notes is not None and source["path"] not in seen:
                seen.add(source["path"])
                notes.extend(_variable_font_notes(font, source.get("fileName") or labels[index]))
            font = _instantiate(font, location)
        fonts.append(font)
    return fonts


def _inspect(fonts, paths, labels, file_names=None):
    issues = []
    warnings = []
    glyph_reports = []
    glyph_warnings = []

    outlines = [_outline_kind(font) for font in fonts]
    for index, kind in enumerate(outlines):
        if kind in ("Unknown", "CFF2") or "fvar" in fonts[index]:
            issues.append(_msg("already_variable" if "fvar" in fonts[index] else "unknown_outlines", font=labels[index]))
    if not issues:
        mixed = [labels[i] for i in range(1, len(fonts)) if outlines[i] != outlines[0]]
        if mixed:
            issues.append(_msg("mixed_outlines", base=outlines[0], fonts=", ".join(mixed)))

    upms = [font["head"].unitsPerEm for font in fonts]
    for index in range(1, len(fonts)):
        if upms[index] != upms[0]:
            issues.append(_msg("upm", font=labels[index], value=upms[index], base=upms[0]))

    glyph_sets = [set(font.getGlyphOrder()) for font in fonts]
    common = [name for name in fonts[0].getGlyphOrder() if all(name in s for s in glyph_sets)]
    for index in range(1, len(fonts)):
        missing = [g for g in fonts[0].getGlyphOrder() if g not in glyph_sets[index]]
        extra = [g for g in fonts[index].getGlyphOrder() if g not in glyph_sets[0]]
        if missing:
            issues.append(
                _msg("missing_glyphs", font=labels[index], count=len(missing), glyphs=", ".join(missing[:MAX_LISTED_GLYPHS]))
            )
        if extra:
            issues.append(
                _msg("extra_glyphs", font=labels[index], count=len(extra), glyphs=", ".join(extra[:MAX_LISTED_GLYPHS]))
            )

    recordings = None
    if not any(i["code"] in ("unknown_outlines", "already_variable", "mixed_outlines") for i in issues):
        recordings = [_record_font(font) for font in fonts]
        glyph_reports, glyph_warnings = _check_outlines(fonts, recordings, labels, common)
        if glyph_reports:
            issues.append(
                _msg(
                    "outlines_incompatible",
                    count=len(glyph_reports),
                    glyphs=", ".join(r["glyph"] for r in glyph_reports[:MAX_LISTED_GLYPHS]),
                )
            )
        if glyph_warnings:
            warnings.append(
                _msg(
                    "outlines_suspicious",
                    count=len(glyph_warnings),
                    glyphs=", ".join(r["glyph"] for r in glyph_warnings[:MAX_LISTED_GLYPHS]),
                )
            )

    return {
        "ok": not issues,
        "summaries": [
            _font_summary(f, p, l, (file_names or [None] * len(fonts))[i])
            for i, (f, p, l) in enumerate(zip(fonts, paths, labels))
        ],
        "issues": issues,
        "warnings": warnings,
        "glyphReports": glyph_reports,
        "glyphWarnings": glyph_warnings,
        "frame": _font_frame(fonts[0]),
    }, recordings


def inspect_fonts(payload_json):
    payload = json.loads(payload_json)
    fonts = _load(payload.get("sources") or payload["paths"], payload["labels"])
    result, _ = _inspect(fonts, payload["paths"], payload["labels"], payload.get("fileNames"))
    return json.dumps(result)


# ---------------------------------------------------------------------------
# CFF -> TrueType (all masters together, so they stay compatible)
# ---------------------------------------------------------------------------


def _promote_line(start, end):
    (x0, y0), (x1, y1) = start, end
    return [
        (x0 + (x1 - x0) / 3.0, y0 + (y1 - y0) / 3.0),
        (x0 + 2 * (x1 - x0) / 3.0, y0 + 2 * (y1 - y0) / 3.0),
        (x1, y1),
    ]


def _cubic_masters_to_quadratic(fonts, recordings, glyph_order):
    """Convert the cubic outlines of every master into compatible quadratic ones.

    Curves are converted with cu2qu across all masters at once, so every master
    gets the same number of off-curve points. Returns {glyph: [TTGlyph per master]}.
    """
    upm = fonts[0]["head"].unitsPerEm
    max_err = upm / 1000.0
    count = len(fonts)
    result = {}
    for name in glyph_order:
        pens = [TTGlyphPen(None) for _ in range(count)]
        reversers = [ReverseContourPen(pen) for pen in pens]
        glyphs = [recordings[m][name] for m in range(count)]
        for contour_index in range(len(glyphs[0].contours)):
            contours = [g.contours[contour_index] for g in glyphs]
            current = [None] * count
            for seg_index in range(len(contours[0])):
                ops = [c[seg_index] for c in contours]
                kinds = {op for op, _ in ops}
                if kinds == {"moveTo"}:
                    for m in range(count):
                        reversers[m].moveTo(ops[m][1][0])
                        current[m] = ops[m][1][0]
                elif kinds == {"lineTo"}:
                    for m in range(count):
                        reversers[m].lineTo(ops[m][1][0])
                        current[m] = ops[m][1][0]
                elif kinds <= {"lineTo", "curveTo"}:
                    curves = []
                    for m in range(count):
                        op, args = ops[m]
                        points = args if op == "curveTo" else _promote_line(current[m], args[0])
                        curves.append([current[m]] + [tuple(p) for p in points])
                    splines = curves_to_quadratic(curves, [max_err] * count)
                    for m in range(count):
                        reversers[m].qCurveTo(*[tuple(p) for p in splines[m][1:]])
                        current[m] = splines[m][-1]
                elif kinds == {"closePath"}:
                    for m in range(count):
                        reversers[m].closePath()
                elif kinds == {"endPath"}:
                    for m in range(count):
                        reversers[m].endPath()
                else:
                    raise ValueError("Incompatible segments in glyph %s" % name)
        result[name] = [pen.glyph() for pen in pens]
    return result


def _cff_to_truetype(fonts, recordings):
    glyph_order = fonts[0].getGlyphOrder()
    converted = _cubic_masters_to_quadratic(fonts, recordings, glyph_order)
    out = []
    for m, font in enumerate(fonts):
        order = font.getGlyphOrder()
        glyf = newTable("glyf")
        glyf.glyphOrder = order
        glyf.glyphs = {name: converted[name][m] for name in order}
        font["loca"] = newTable("loca")
        font["glyf"] = glyf
        for table in ("CFF ", "CFF2", "HVAR", "MVAR", "VVAR"):
            if table in font:
                del font[table]
        if "VORG" in font:
            del font["VORG"]
        for glyph in glyf.glyphs.values():
            if glyph.numberOfContours:
                glyph.recalcBounds(glyf)
        glyf.compile(font)
        hmtx = font["hmtx"]
        for name, glyph in glyf.glyphs.items():
            if hasattr(glyph, "xMin"):
                width = hmtx[name][0]
                hmtx[name] = (width, glyph.xMin)
        maxp = newTable("maxp")
        maxp.tableVersion = 0x00010000
        maxp.maxZones = 1
        maxp.maxTwilightPoints = 0
        maxp.maxStorage = 0
        maxp.maxFunctionDefs = 0
        maxp.maxInstructionDefs = 0
        maxp.maxStackElements = 0
        maxp.maxSizeOfInstructions = 0
        maxp.maxComponentElements = 0
        font["maxp"] = maxp
        maxp.recalc(font)
        font.recalcBBoxes = True
        post = font["post"]
        post.formatType = 2.0
        post.extraNames = []
        post.mapping = {}
        post.glyphOrder = order
        font.sfntVersion = "\x00\x01\x00\x00"
        buffer = BytesIO()
        font.save(buffer)
        buffer.seek(0)
        out.append(TTFont(buffer))
    return out


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------


def _corner_location(index, axes):
    return {axis["name"]: (1000 if (index >> i) & 1 else 0) for i, axis in enumerate(axes)}


def _ps_name(text):
    return "".join(ch for ch in text if ch.isalnum() or ch == "-")[:60] or "VarialoFont"


def _rename_family(font, family_name, designer=None):
    """Give the variable font its own family name.

    Installing a variable font with the same family name as the static fonts it
    came from makes many apps pick one of the statics instead.
    """
    name_table = font["name"]
    style = _name(font, 17, 2) or "Regular"
    for name_id, value in (
        (1, family_name),
        (2, "Regular"),
        (3, "Varialo;%s" % _ps_name(family_name)),
        (4, "%s %s" % (family_name, style) if style != "Regular" else family_name),
        (6, _ps_name(family_name)),
        (16, family_name),
        (17, style),
        (25, _ps_name(family_name)),
    ):
        name_table.setName(value, name_id, 3, 1, 0x409)
        name_table.removeNames(nameID=name_id, platformID=1)
    if designer:
        name_table.removeNames(nameID=9)
        name_table.setName(designer, 9, 3, 1, 0x409)


def _axis_definitions(axes):
    """Normalise the axes from the interface.

    Each axis has a tag, a name and the values at the start (vertex A side)
    and at the end of the axis. The start value is the default of the font.
    Old requests without start/end use 0 -> 1000.
    """
    out = []
    for axis in axes:
        start = float(axis.get("start", 0))
        end = float(axis.get("end", 1000))
        out.append(
            {
                "tag": axis["tag"],
                "name": axis.get("name") or axis.get("label") or axis["tag"],
                "start": start,
                "end": end,
                "minimum": min(start, end),
                "maximum": max(start, end),
            }
        )
    return out


def _clean_number(value):
    return int(value) if float(value).is_integer() else round(value, 3)


def build_variable_font(request_json, output_path):
    request = json.loads(request_json)
    sources = request.get("sources") or request["paths"]
    labels = request["labels"]
    axes = _axis_definitions(request["axes"])
    family_name = (request.get("familyName") or "").strip() or None
    designer = (request.get("designer") or "").strip() or None
    style_names = [
        (s.get("styleName") if isinstance(s, dict) else None) for s in sources
    ]
    paths = [s["path"] if isinstance(s, dict) else s for s in sources]
    file_names = request.get("fileNames") or [
        (s.get("fileName") if isinstance(s, dict) else None) for s in sources
    ]

    source_notes = []
    fonts = _load(sources, labels, source_notes)
    inspection, recordings = _inspect(fonts, paths, labels, file_names)
    inspection["warnings"].extend(source_notes)
    if not inspection["ok"]:
        return json.dumps(inspection)

    try:
        converted = False
        if _outline_kind(fonts[0]) == "CFF":
            fonts = _cff_to_truetype(fonts, recordings)
            converted = True

        designspace = DesignSpaceDocument()
        for axis in axes:
            designspace.addAxis(
                AxisDescriptor(
                    tag=axis["tag"],
                    name=axis["tag"],
                    labelNames={"en": axis["name"]},
                    minimum=axis["minimum"],
                    default=axis["start"],
                    maximum=axis["maximum"],
                )
            )
        used_names = set()
        for index, font in enumerate(fonts):
            location = {
                axis["tag"]: (axis["end"] if (index >> i) & 1 else axis["start"])
                for i, axis in enumerate(axes)
            }
            designspace.addSource(SourceDescriptor(name="master.%d" % index, font=font, location=location))
            style = style_names[index] or _name(font, 17, 2) or labels[index]
            if style in used_names:
                style = "%s %s" % (style, labels[index])
            used_names.add(style)
            designspace.addInstance(InstanceDescriptor(styleName=style, location=location))

        variable_font, _, _ = varlib_build(designspace)
        base_family = _name(fonts[0], 16, 1) or "Varialo"
        _rename_family(variable_font, family_name or "%s Variable" % base_family, designer)
        variable_font.save(output_path)

        inspection["outputPath"] = output_path
        inspection["outputExt"] = ".ttf"
        inspection["familyName"] = family_name or "%s Variable" % base_family
        inspection["axes"] = [
            {
                "tag": a["tag"],
                "label": a["name"],
                "start": _clean_number(a["start"]),
                "end": _clean_number(a["end"]),
                "minimum": _clean_number(a["minimum"]),
                "maximum": _clean_number(a["maximum"]),
            }
            for a in axes
        ]
        if converted:
            inspection["warnings"].append(_msg("converted_to_ttf"))
        return json.dumps(inspection)
    except Exception as exc:
        inspection["ok"] = False
        inspection["issues"].append(_msg("build_failed"))
        inspection["buildError"] = str(exc).strip() or exc.__class__.__name__
        return json.dumps(inspection)
