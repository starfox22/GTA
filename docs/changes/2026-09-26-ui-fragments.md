# Page CSS and markup split into src/ui fragments

- No player-visible change: the built page is byte-identical.
- `src/shell.html` (8,200 lines) is now a ~70-line skeleton; its CSS and markup moved by
  pure contiguous moves into 25 files under `src/ui/` (19 `.css`, 6 `.html`).
- `tools/build.py` expands `/* @include src/ui/x.css */` (in `.css` files and inside
  `<style>`) and `<!-- @include src/ui/x.html -->` (in `.html` files) as it already did
  `// @include src/x.js`: recursive, verbatim, missing file = build error.
