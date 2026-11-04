"""Checks for engine.py (the Python code the app runs in the browser).

Usage:    python3 tests/test_engine.py
Requires: fonttools  (python3 -m pip install fonttools)
"""
import importlib.util
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

try:
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.t2CharStringPen import T2CharStringPen
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
except ImportError:
    sys.exit("fonttools is required: python3 -m pip install fonttools")


def load_engine():
    spec = importlib.util.spec_from_file_location("varialo_engine", ROOT / "engine.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# --- test font drawings ------------------------------------------------------

def draw_A(pen, weight, extra_point=False):
    """A simple slab: one rectangular contour (4 nodes, or 5 with extra_point)."""
    pen.moveTo((100, 0))
    pen.lineTo((100 + weight, 0))
    if extra_point:
        pen.lineTo((100 + weight + 20, 300))
    pen.lineTo((100 + weight, 700))
    pen.lineTo((100, 700))
    pen.closePath()


def draw_O(pen, weight, extra_node=False, straight_side=False, reverse_inner=False, extra_contour=False):
    """An O made of curves: outer + inner contour."""
    def ellipse(cx, cy, rx, ry, clockwise, extra=False, straight=False):
        k = 0.552
        pts = [(cx, cy - ry), (cx + rx, cy), (cx, cy + ry), (cx - rx, cy)]
        if clockwise:
            pts = [pts[0], pts[3], pts[2], pts[1]]
        pen.moveTo(pts[0])
        for i in range(4):
            a, b = pts[i], pts[(i + 1) % 4]
            if straight and i == 1:
                pen.lineTo(b)
                continue
            if extra and i == 2:
                mid = ((a[0] + b[0]) / 2 + 30, (a[1] + b[1]) / 2 + 30)
                pen.lineTo(mid)
                a = mid
            c1 = (a[0] + (b[0] - a[0]) * k if a[1] == cy else a[0], a[1] + (b[1] - a[1]) * k if a[0] == cx else a[1])
            c2 = (b[0] + (a[0] - b[0]) * k if b[1] == cy else b[0], b[1] + (a[1] - b[1]) * k if b[0] == cx else b[1])
            pen.curveTo(c1, c2, b)
        pen.closePath()

    ellipse(350, 350, 300, 350, clockwise=False, extra=extra_node, straight=straight_side)
    ellipse(350, 350, 300 - weight, 350 - weight, clockwise=not reverse_inner)
    if extra_contour:
        ellipse(350, 800, 40, 40, clockwise=False)


def make_font(path, family, weight=100, cff=False, **options):
    builder = FontBuilder(1000, isTTF=not cff)
    glyphs = [".notdef", "A", "O"]
    if options.pop("drop_O", False):
        glyphs = [".notdef", "A"]
    builder.setupGlyphOrder(glyphs)
    builder.setupCharacterMap({ord(g): g for g in glyphs if len(g) == 1})
    a_opts = {"extra_point": options.pop("extra_point", False)}

    if cff:
        outlines = {}
        for name in glyphs:
            pen = T2CharStringPen(700, None)
            if name == "A":
                draw_A(pen, weight, **a_opts)
            elif name == "O":
                draw_O(pen, weight, **options)
            outlines[name] = pen.getCharString()
        builder.setupCFF(family.replace(" ", ""), {"FullName": family}, outlines, {})
    else:
        outlines = {}
        for name in glyphs:
            pen = TTGlyphPen(None)
            if name == "A":
                draw_A(pen, weight, **a_opts)
            elif name == "O":
                # TrueType test fonts: draw O as polygons (cubic curves would need cu2qu)
                for (x0, y0, x1, y1) in ((50, 0, 650, 700), (50 + weight, weight, 650 - weight, 700 - weight)):
                    pen.moveTo((x0, y0)); pen.lineTo((x1, y0)); pen.lineTo((x1, y1)); pen.lineTo((x0, y1)); pen.closePath()
            outlines[name] = pen.glyph()
        builder.setupGlyf(outlines)
    builder.setupHorizontalMetrics({name: (700, 0) for name in glyphs})
    builder.setupHorizontalHeader(ascent=800, descent=-200)
    builder.setupNameTable({"familyName": family, "styleName": "Regular"})
    builder.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
    builder.setupPost()
    builder.save(str(path))
    return str(path)


def axes_for(count):
    letters = "ABCD"
    return [{"tag": f"BLN{letters[i]}", "name": f"blend_{letters[i].lower()}", "label": f"Blend {letters[i]}"} for i in range(count)]


def build(engine, paths, out):
    return json.loads(engine.build_variable_font(json.dumps({
        "paths": paths,
        "labels": [chr(65 + i) for i in range(len(paths))],
        "axes": axes_for({2: 1, 4: 2, 8: 3, 16: 4}[len(paths)]),
    }), str(out)))


def codes(messages):
    return [m["code"] for m in messages]


def main():
    engine = load_engine()
    tmp = Path(tempfile.mkdtemp(prefix="varialo-test-"))
    checks = 0

    # 1. TrueType sources, 1-4 axes
    tt = [make_font(tmp / f"tt{i}.ttf", f"Test {i}", weight=60 + 20 * i) for i in range(16)]
    for count in (2, 4, 8, 16):
        out = tmp / f"tt-{count}.ttf"
        result = build(engine, tt[:count], out)
        assert result["ok"], (result["issues"], result.get("buildError"))
        assert result["outputExt"] == ".ttf"
        vf = TTFont(str(out))
        assert "glyf" in vf and "gvar" in vf
        assert len(vf["fvar"].axes) == len(result["axes"])
        assert len(vf["fvar"].instances) == count
        checks += 1

    # 2. CFF (.otf) sources become a TrueType variable font
    otf = [make_font(tmp / f"cff{i}.otf", f"Cff {i}", weight=60 + 80 * i, cff=True) for i in range(4)]
    out = tmp / "cff-2axes.ttf"
    result = build(engine, otf, out)
    assert result["ok"], (result["issues"], result.get("buildError"))
    assert result["outputExt"] == ".ttf"
    assert "converted_to_ttf" in codes(result["warnings"])
    vf = TTFont(str(out))
    assert "glyf" in vf and "gvar" in vf and "CFF2" not in vf and "CFF " not in vf
    assert vf.sfntVersion == "\x00\x01\x00\x00"
    assert vf["name"].getDebugName(1) == "Cff 0 Variable", vf["name"].getDebugName(1)
    # the blend really varies: the A stem at the middle sits between the masters
    mid = instantiateVariableFont(TTFont(str(out)), {"BLNA": 500, "BLNB": 0})
    xs = sorted({x for x, _ in mid["glyf"]["A"].getCoordinates(mid["glyf"])[0]})
    assert xs == [100, 100 + 100], xs  # weights 60 and 140 -> 100
    checks += 1

    # 3. TrueType: extra point -> blocked, the extra point is highlighted
    broken = make_font(tmp / "broken.ttf", "Broken", weight=80, extra_point=True)
    result = build(engine, [tt[0], broken], tmp / "x.ttf")
    assert not result["ok"]
    assert "outlines_incompatible" in codes(result["issues"])
    report = result["glyphReports"][0]
    assert report["glyph"] == "A" and report["char"] == "A"
    other = report["masters"][1]
    assert codes(other["problems"]) == ["point_count"]
    assert other["visual"]["badPoints"] == [[0, 2]], other["visual"]["badPoints"]
    assert other["visual"]["path"].startswith("M")
    checks += 1

    # 4. CFF: extra node on the O -> blocked with node_count, the node is highlighted
    extra = make_font(tmp / "extra.otf", "Extra", weight=140, cff=True, extra_node=True)
    result = build(engine, [otf[0], extra], tmp / "x.ttf")
    assert not result["ok"]
    report = result["glyphReports"][0]
    assert report["glyph"] == "O"
    problems = report["masters"][1]["problems"]
    assert codes(problems) == ["node_count"], problems
    assert problems[0]["params"] == {"contour": 1, "base": 4, "other": 5}
    bad = report["masters"][1]["visual"]["badPoints"]
    assert len(bad) == 1 and bad[0][0] == 0, bad
    pts = report["masters"][1]["visual"]["contours"][0]["points"]
    assert pts[bad[0][1]][2] is True
    checks += 1

    # 5. CFF: a line where the other master has a curve -> fixed automatically
    straight = make_font(tmp / "straight.otf", "Straight", weight=140, cff=True, straight_side=True)
    out = tmp / "straight.ttf"
    result = build(engine, [otf[0], straight], out)
    assert result["ok"], (result["issues"], result.get("buildError"))
    assert any(r["glyph"] == "O" for r in result["glyphWarnings"])
    TTFont(str(out))["gvar"]
    checks += 1

    # 6. Different number of contours -> the extra contour is highlighted
    dot = make_font(tmp / "dot.otf", "Dot", weight=140, cff=True, extra_contour=True)
    result = build(engine, [otf[0], dot], tmp / "x.ttf")
    assert not result["ok"]
    master = result["glyphReports"][0]["masters"][1]
    assert codes(master["problems"]) == ["contour_count"]
    assert [c["highlight"] for c in master["visual"]["contours"]] == [False, False, True]
    checks += 1

    # 7. Missing glyph
    missing = make_font(tmp / "missing.otf", "Missing", weight=140, cff=True, drop_O=True)
    result = build(engine, [otf[0], missing], tmp / "x.ttf")
    assert not result["ok"] and "missing_glyphs" in codes(result["issues"])
    checks += 1

    # 8. Reversed contour direction -> warning (still builds)
    rev = make_font(tmp / "rev.otf", "Rev", weight=140, cff=True, reverse_inner=True)
    result = build(engine, [otf[0], rev], tmp / "rev.ttf")
    assert result["ok"], result["issues"]
    warn = result["glyphWarnings"][0]["masters"][1]["problems"]
    assert "direction" in codes(warn), warn
    checks += 1

    # 9. Mixed TrueType + CFF
    result = build(engine, [tt[0], otf[1]], tmp / "x.ttf")
    assert not result["ok"] and "mixed_outlines" in codes(result["issues"])
    checks += 1

    # 10. Export name and author are written into the font
    out = tmp / "named.ttf"
    result = json.loads(engine.build_variable_font(json.dumps({
        "paths": otf[:2], "labels": ["A", "B"], "axes": axes_for(1),
        "familyName": "Corso Sans", "designer": "Studente IED",
    }), str(out)))
    assert result["ok"], result
    names = TTFont(str(out))["name"]
    assert names.getDebugName(1) == "Corso Sans" and names.getDebugName(9) == "Studente IED"
    assert names.getDebugName(6) == "CorsoSans"
    checks += 1

    print(f"All {checks} engine checks passed.")


if __name__ == "__main__":
    main()
