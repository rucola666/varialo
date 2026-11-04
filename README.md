# VARIALO

**→ Live: <https://rucola666.github.io/varialo/>**

A web app for type design students: put static fonts on the vertices of a
design space (a line, a square or a cube) and get a **variable `.ttf`** font
back. Everything runs in the browser; fonts are never uploaded anywhere.

The interface is in Italian by default, with an English switch (IT / EN, top right).

The first version of Varialo was developed by Rocco Modugno for the
Sabotaggio Tipografico workshop by Edoardo Pensieri at IED Torino.

## What it does

- 1, 2 or 3 axes (X, Y, Z) → 2, 4 or 8 source fonts, placed on a line, square or cube.
- Accepts `.otf` (CFF) and `.ttf` sources; all sources must use the same format.
- Always exports a **TrueType variable font (`.ttf`)**. `.otf` sources are
  converted to quadratic curves for all masters together, so they stay compatible.
- Font info panel: details of every source font (name, author, version, UPM,
  glyphs, axes…), with mismatches framed in bold. Family name and author of the
  exported font are editable and written into the `.ttf`. The variable font gets
  its own family name, so it doesn't clash with the installed static fonts.
- Named instances for every vertex, axes `BLNX` / `BLNY` / `BLNZ` from 0 to 1000.
- Visual compatibility report: when masters don't match, the glyphs are drawn
  side by side with the extra / unmatched nodes and contours highlighted, plus
  advice on how to fix them. Line-vs-curve differences in `.otf` sources are
  fixed automatically. Direction / start-point / contour-order differences are
  shown as warnings.
- Live preview with one slider per axis and a clickable interpolation matrix.

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
| `app.js` | Interface logic, diagram, preview, report drawing |
| `i18n.js` | Italian and English texts |
| `fontinfo.js` | Reads name, author, UPM, axes… from the loaded fonts |
| `engine.py` | Font engine run by Pyodide: checks, CFF→TrueType, build |
| `tests/test_engine.py` | Engine tests (run with plain Python) |
| `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` | Icons: the Space Grotesk Bold “V” |
| `.nojekyll` | Tells GitHub Pages not to process the site with Jekyll |

## Tests

```bash
python3 -m pip install fonttools
python3 tests/test_engine.py
```
