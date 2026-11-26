# Sowers Field Paint

Field Paint is a browser-only pixel editor at `/sowers/paint/`. It uses the original
28-color Paint palette and Canvas 2D; ordinary documents can contain text and imported
images, while memorial export is limited to unmodified freehand strokes.

## Tools and files

The workspace includes rectangular and free-form lasso selection, pencil, brush, airbrush,
magnifier, eraser, flood fill, eyedropper, text, line, three-click quadratic curve,
rectangle, rounded rectangle, ellipse and click-to-build polygon. Shape options set outline, fill or both. Selection
supports move, copy, cut, paste and crop. Lasso masks remain clipped through those actions.
Opaque selection mode fills cut or pasted transparent pixels with the background color; turn
it off to preserve alpha. Canvas resize, horizontal/vertical flip, quarter-turn rotation,
invert, stretch/skew, print, undo/redo, click-to-focus magnifier zoom, pixel grid and
space/middle-button panning are available. Ctrl/Cmd-wheel zooms. Pointer, mouse and touch use the same canvas surface.

Open supports PNG, JPEG, GIF, WebP and Field Paint `.sfp.json` files. A document file
embeds a PNG data URL, so it opens locally without fetching remote content. Export offers
PNG, JPEG and BMP; Save produces the JSON document. JPEG and BMP flatten transparency onto
the selected background color. Print hides editor controls and prints the canvas. Image and canvas dimensions are bounded
to 2048 pixels per side and 4,194,304 pixels total. Image import is limited to 20 MiB;
document input is limited to 25 MiB. History is bounded by 20 states and 48 MiB of
pixel data; if it fills, the oldest undo states are discarded.

Keyboard shortcuts include Ctrl/Cmd+Z and Y for undo/redo, Ctrl/Cmd+O/S for open/save,
Ctrl/Cmd+C/X/V for selection operations, P/B/A/E/F/I/T/L/C/R/O/M/G/Z for tools, Ctrl/Cmd+A to select all, Delete/Backspace to
clear the selection, Escape to cancel/deselect, X to swap colors, and brackets to change brush
width. Space-drag or middle-drag pans.

## Memorial drawing and private archive

The shared pure functions are in `sowers/paint/core.mjs`: `PAINT_COLORS`,
`validateMemorial`, `drawMemorial`, `memorialSymbolKey` and `memorialVisualKey`.
Memorial strokes use normalized coordinates and the archive rejects glyphs, nonpalette
colors, duplicate symbol names and duplicate normalized images. The CLI at
`tools/sowers-memorial.mjs` writes to the ignored private archive
`data/sowers-memorials.json` (or the absolute `SOWERS_MEMORIAL_FILE` path). It never
controls protocol scheduling or writes through a browser endpoint.

```sh
node tools/sowers-memorial.mjs --preview draft.json
# Inspect draft.preview.png, then attest that the complete image was inspected:
node tools/sowers-memorial.mjs --approve-preview draft.json
node tools/sowers-memorial.mjs --commit draft.json
```

Preview rendering uses optional installed Playwright only in this CLI. Set
`SOWERS_PLAYWRIGHT_MODULE` to its module path if it is not resolvable by Node. The receipt
binds the exact draft, current drawing source and PNG. Any change requires a new
preview/approval. Commit requires the private archive lock, refuses a stale lock or
damaged/inconsistent archive, assigns the next sequential iteration, and treats an
identical retry for the same completion ID as idempotent. The ignored working draft
does not itself represent an archive commit.

## Limits

Curve control uses three canvas clicks (start, end, bend). Polygon vertices are clicked
and closed with a double-click. GIF import opens a single decoded frame. Memorial export
does not vectorize shapes, text, fills or imported pixels; it refuses export unless
freehand strokes are available, and other edits/undo invalidate its stroke history.
There is no layered editing, transparency-preserving eraser, operating-system clipboard
integration, or animated GIF export.
