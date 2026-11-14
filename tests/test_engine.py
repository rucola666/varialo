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

    # 11. Custom axes: tag, name, start/end values (start = default, may be > end)
    out = tmp / "custom.ttf"
    result = json.loads(engine.build_variable_font(json.dumps({
        "paths": otf[:4], "labels": list("ABCD"),
        "axes": [{"tag": "ROND", "name": "Rotondità", "start": 1, "end": 1000},
                 {"tag": "slnt", "name": "Slant", "start": 0, "end": -12}],
    }), str(out)))
    assert result["ok"], (result["issues"], result.get("buildError"))
    vf = TTFont(str(out))
    rond, slnt = vf["fvar"].axes
    assert (rond.axisTag, rond.minValue, rond.defaultValue, rond.maxValue) == ("ROND", 1, 1, 1000)
    assert (slnt.axisTag, slnt.minValue, slnt.defaultValue, slnt.maxValue) == ("slnt", -12, 0, 0)
    assert vf["name"].getDebugName(rond.axisNameID) == "Rotondità"
    assert result["axes"][1] == {"tag": "slnt", "label": "Slant", "start": 0, "end": -12, "minimum": -12, "maximum": 0}
    checks += 1

    # helpers: a 1-axis and a 2-axis variable font made by Varialo itself
    def make_vf(name, fonts, axes, family):
        path = tmp / name
        res = json.loads(engine.build_variable_font(json.dumps({
            "paths": fonts, "labels": [chr(65 + i) for i in range(len(fonts))],
            "axes": axes, "familyName": family}), str(path)))
        assert res["ok"], res
        return str(path)

    upright = make_vf("upright-vf.ttf", tt[:2], [{"tag": "wght", "name": "Weight", "start": 100, "end": 900}], "Up")
    italic = make_vf("italic-vf.ttf", tt[2:4], [{"tag": "wght", "name": "Weight", "start": 100, "end": 900}], "It")

    # 12. Unpack a variable font at its corners and rebuild it
    out = tmp / "unpacked.ttf"
    result = json.loads(engine.build_variable_font(json.dumps({
        "sources": [{"path": upright, "location": {"wght": 100}, "fileName": "upright-vf.ttf"},
                    {"path": upright, "location": {"wght": 900}, "fileName": "upright-vf.ttf"}],
        "labels": ["A", "B"], "axes": [{"tag": "wght", "name": "Weight", "start": 100, "end": 900}],
    }), str(out)))
    assert result["ok"], (result["issues"], result.get("buildError"))
    rebuilt = instantiateVariableFont(TTFont(str(out)), {"wght": 500})
    original = instantiateVariableFont(TTFont(upright), {"wght": 500})
    assert rebuilt["glyf"]["A"].getCoordinates(rebuilt["glyf"])[0] == original["glyf"]["A"].getCoordinates(original["glyf"])[0]
    assert not [w for w in result["warnings"] if w["code"].startswith("vf_")]
    checks += 1

    # 13. Two 1-axis variable fonts on the two edges of a square
    out = tmp / "square-from-vfs.ttf"
    result = json.loads(engine.build_variable_font(json.dumps({
        "sources": [{"path": upright, "location": {"wght": 100}}, {"path": upright, "location": {"wght": 900}},
                    {"path": italic, "location": {"wght": 100}}, {"path": italic, "location": {"wght": 900}}],
        "labels": list("ABCD"),
        "axes": [{"tag": "wght", "name": "Weight", "start": 100, "end": 900},
                 {"tag": "ital", "name": "Italic", "start": 0, "end": 1}],
    }), str(out)))
    assert result["ok"], (result["issues"], result.get("buildError"))
    assert [a.axisTag for a in TTFont(str(out))["fvar"].axes] == ["wght", "ital"]
    checks += 1

    # 14. CFF2 variable font (.otf) is unpacked and converted
    from fontTools.designspaceLib import DesignSpaceDocument, AxisDescriptor, SourceDescriptor
    from fontTools.varLib import build as vbuild
    ds = DesignSpaceDocument()
    ds.addAxis(AxisDescriptor(tag="wght", name="wght", minimum=100, default=100, maximum=900))
    ds.addSource(SourceDescriptor(font=TTFont(otf[0]), location={"wght": 100}))
    ds.addSource(SourceDescriptor(font=TTFont(otf[1]), location={"wght": 900}))
    cff2 = vbuild(ds)[0]
    assert "CFF2" in cff2
    cff2_path = tmp / "cff2-vf.otf"
    cff2.save(str(cff2_path))
    out = tmp / "from-cff2.ttf"
    result = json.loads(engine.build_variable_font(json.dumps({
        "sources": [{"path": str(cff2_path), "location": {"wght": 100}}, {"path": str(cff2_path), "location": {"wght": 900}}],
        "labels": ["A", "B"], "axes": [{"tag": "wght", "name": "Weight", "start": 100, "end": 900}],
    }), str(out)))
    assert result["ok"], (result["issues"], result.get("buildError"))
    assert "glyf" in TTFont(str(out))
    checks += 1

    # 15. A variable font with an intermediate master gets a note
    ds = DesignSpaceDocument()
    ds.addAxis(AxisDescriptor(tag="wght", name="wght", minimum=100, default=100, maximum=900))
    for path, value in ((tt[0], 100), (tt[5], 500), (tt[1], 900)):
        ds.addSource(SourceDescriptor(font=TTFont(path), location={"wght": value}))
    three = tmp / "three-masters.ttf"
    vbuild(ds)[0].save(str(three))
    result = json.loads(engine.build_variable_font(json.dumps({
        "sources": [{"path": str(three), "location": {"wght": 100}, "fileName": "three-masters.ttf"},
                    {"path": str(three), "location": {"wght": 900}, "fileName": "three-masters.ttf"}],
        "labels": ["A", "B"], "axes": [{"tag": "wght", "name": "Weight", "start": 100, "end": 900}],
    }), str(tmp / "x.ttf")))
    assert result["ok"]
    notes = [w for w in result["warnings"] if w["code"] == "vf_intermediate"]
    assert len(notes) == 1 and notes[0]["params"]["font"] == "three-masters.ttf", result["warnings"]
    checks += 1

    # 16. CFF -> TrueType keeps the shapes: same area, TrueType direction (clockwise)
    from fontTools.pens.areaPen import AreaPen
    out = tmp / "area.ttf"
    result = build(engine, otf[:2], out)
    assert result["ok"]
    source = TTFont(otf[0])
    converted = instantiateVariableFont(TTFont(str(out)), {"BLNA": 0})
    for glyph in ("A", "O"):
        cff_pen, tt_pen = AreaPen(source.getGlyphSet()), AreaPen(converted.getGlyphSet())
        source.getGlyphSet()[glyph].draw(cff_pen)
        converted.getGlyphSet()[glyph].draw(tt_pen)
        assert cff_pen.value > 0 and tt_pen.value < 0, (glyph, cff_pen.value, tt_pen.value)
        assert abs(abs(tt_pen.value) - cff_pen.value) / cff_pen.value < 0.01, (glyph, cff_pen.value, tt_pen.value)
    checks += 1

    # 17. Points that coincide in one corner only (e.g. collapsed at Thin) are
    #     not an incompatibility: corners of one variable font always rebuild.
    def closing_master(path, closing, cff):
        builder = FontBuilder(1000, isTTF=not cff)
        builder.setupGlyphOrder([".notdef", "A"])
        builder.setupCharacterMap({65: "A"})
        def draw(pen):
            pen.moveTo((0, 0))
            pen.lineTo((300, 0))
            if cff:
                pen.curveTo((300, 150), (150, 300), (0, 300))
            else:
                pen.qCurveTo((300, 300), (0, 300))
            pen.lineTo(closing)
            pen.closePath()
        if cff:
            charstrings = {}
            for name in (".notdef", "A"):
                pen = T2CharStringPen(500, None)
                if name == "A":
                    draw(pen)
                charstrings[name] = pen.getCharString()
            builder.setupCFF("T", {}, charstrings, {})
        else:
            glyphs = {}
            for name in (".notdef", "A"):
                pen = TTGlyphPen(None)
                if name == "A":
                    draw(pen)
                glyphs[name] = pen.glyph()
            builder.setupGlyf(glyphs)
        builder.setupHorizontalMetrics({".notdef": (500, 0), "A": (500, 0)})
        builder.setupHorizontalHeader(ascent=800, descent=-200)
        builder.setupNameTable({"familyName": "T", "styleName": "R"})
        builder.setupOS2()
        builder.setupPost()
        builder.save(str(path))
        return str(path)

    ds = DesignSpaceDocument()
    ds.addAxis(AxisDescriptor(tag="wght", name="wght", minimum=100, default=100, maximum=900))
    ds.addSource(SourceDescriptor(font=TTFont(closing_master(tmp / "c1.otf", (0, 0), True)), location={"wght": 100}))
    ds.addSource(SourceDescriptor(font=TTFont(closing_master(tmp / "c2.otf", (0, 40), True)), location={"wght": 900}))
    collapsed = tmp / "collapsed-cff2.otf"
    vbuild(ds)[0].save(str(collapsed))
    result = json.loads(engine.build_variable_font(json.dumps({
        "sources": [{"path": str(collapsed), "location": {"wght": v}} for v in (100, 900)],
        "labels": ["A", "B"], "axes": [{"tag": "wght", "name": "Weight", "start": 100, "end": 900}],
    }), str(tmp / "collapsed.ttf")))
    assert result["ok"], (result["issues"], result.get("glyphReports"))
    # same situation with two separate static .otf masters
    result = json.loads(engine.build_variable_font(json.dumps({
        "paths": [str(tmp / "c1.otf"), str(tmp / "c2.otf")], "labels": ["A", "B"], "axes": axes_for(1),
    }), str(tmp / "collapsed-static.ttf")))
    assert result["ok"], (result["issues"], result.get("glyphReports"))
    checks += 1

    # 18. Export corners of variable fonts as editable static fonts
    for vf_path, location, expected_ext in ((upright, {"wght": 900}, ".ttf"), (str(cff2_path), {"wght": 900}, ".otf")):
        out = tmp / "export.bin"
        res = json.loads(engine.export_master(json.dumps({
            "path": vf_path, "location": location, "styleName": "Black", "fileName": "x"}), str(out)))
        assert res["ok"], res
        assert res["fileName"].endswith(expected_ext), res["fileName"]
        static = TTFont(str(out))
        assert "fvar" not in static and "gvar" not in static
        assert static["name"].getDebugName(17) == "Black"
        if expected_ext == ".otf":
            assert "CFF " in static or "CFF2" in static
    zip_path = tmp / "corners.zip"
    res = json.loads(engine.export_folder(json.dumps({"folderName": "Up", "entries": [
        {"path": upright, "location": {"wght": 100}, "styleName": "Thin"},
        {"path": upright, "location": {"wght": 900}, "styleName": "Black"}]}), str(zip_path)))
    assert res["ok"], res
    import zipfile
    assert len(zipfile.ZipFile(zip_path).namelist()) == 2
    # an exported corner can be used again as a master
    result = json.loads(engine.build_variable_font(json.dumps({
        "paths": [str(tmp / "export.bin"), otf[1]], "labels": ["A", "B"], "axes": axes_for(1)}), str(tmp / "re.ttf")))
    checks += 1

    print(f"All {checks} engine checks passed.")


if __name__ == "__main__":
    main()
