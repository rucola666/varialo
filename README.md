# VARIALO

**→ Live: <https://rucola666.github.io/varialo/>**

A web app for type design students: put static fonts on the vertices of a
design space (a line, a square or a cube) and get a **variable `.ttf`** font
back. Everything runs in the browser; fonts are never uploaded anywhere.

The interface is in Italian by default, with an English switch (IT / EN, top right).

The first version of Varialo was developed by Rocco Modugno for the
Sabotaggio Tipografico workshop by Edoardo Pensieri at IED Torino.

## What it does

- **Library** (left): import `.ttf` / `.otf` fonts, static or variable, shown as
  icon tiles with a big letter. Variable fonts are unpacked into folders of
  corner tiles (min/max of each axis, up to 3 axes; with more axes you choose
  which ones and fix the others). Every tile can be downloaded as a **static
  font** (corners of variable fonts are cut out; CFF2 corners become classic
  CFF `.otf`), and a whole folder as a `.zip`, so single masters can be edited.
- **Design space** (right): 1, 2 or 3 axes (line, square, cube). Drag tiles or a
  whole folder onto the vertices, or click a tile and then a vertex. Vertices
  show only the letter (no frames).
- **Axes are edited on the drawing**: type the values at the two ends of each
  track; click the axis chip to choose the type (registered `wght`, `wdth`,
  `ital`, `slnt`, `opsz` or custom), tag and name. Axes coming from a variable
  font are suggested automatically. Invalid tags/ranges are blocked.
- After building, the yellow handles move along the tracks (same length as the
  edges; in the cube Z runs outside, next to D–H). A letter of the variable font
  shows the current point, with dashed guides from every handle; in the square
  you can drag anywhere. Renaming an axis rebuilds the font automatically.
- The **VARIALO** wordmark is set in the fonts you load (the variable font once
  built, following the sliders). The letter shown everywhere is "V", or the
  first glyph available from "a".
- Always exports a **TrueType variable font (`.ttf`)**; `.otf` (CFF / CFF2)
  sources are converted to quadratic curves for all masters together.
- Visual compatibility report: at the bottom of the page, or right under the
  design space when the font cannot be built.

### Axis naming: what was tested

12 fonts with different axes were built with the engine and loaded in Chromium
(`tests` + the axis test kit): accented / long names, degrees (0 → −45),
decimals (0.5 → 2.25) and very large ranges (0 → 10000) all load and
interpolate. Registered axes also respond to plain CSS (`font-weight`,
`font-stretch`, `font-style: oblique`, optical sizing); custom axes only to
`font-variation-settings`. Lowercase custom tags are technically accepted by the
tools but reserved by the OpenType spec, so Varialo blocks them.

## How it works

Plain static files, no build step and no backend. `app.js` loads
[Pyodide](https://pyodide.org/) (Python in the browser) from a CDN, and Pyodide
runs [fontTools](https://github.com/fonttools/fonttools) with `engine.py` to
check the fonts and build the variable font. An internet connection is needed
the first time you build.

## Run it locally

The page must be served by a web server (not opened by double-clicking
`index.html`), because it loads `engine.py` with `fetch`:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Publish on GitHub Pages

Settings → Pages → Build and deployment → Source: **Deploy from a branch**,
branch **main**, folder **/ (root)**. The site appears at
`https://<user>.github.io/<repo>/` after a minute or two. `.nojekyll` tells
GitHub to serve the files as they are.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page structure |
| `styles.css` | Layout and colours (warm grey, black, warm yellow) |
| `app.js` | State, build, preview, matrix, font info, wiring |
| `library.js` | Library: import, icon tiles, unpacking variable fonts into corners |
| `space.js` | Design space: vertices, slider tracks, point, axis editing |
| `axes.js` | Axis presets and validation rules |
| `report.js` | Visual compatibility report |
| `dom.js` | Small DOM helpers |
| `i18n.js` | Italian and English texts |
| `fontinfo.js` | Reads names, axes, instances, UPM… from font files |
| `engine.py` | Font engine run by Pyodide: checks, CFF→TrueType, build |
| `tests/test_engine.py` | Engine tests (run with plain Python) |
| `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` | Icons: the Space Grotesk Bold “V” |
| `.nojekyll` | Tells GitHub Pages not to process the site with Jekyll |

## Tests

```bash
python3 -m pip install fonttools
python3 tests/test_engine.py
```
