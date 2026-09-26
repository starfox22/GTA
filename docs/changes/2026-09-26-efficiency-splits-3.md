# Efficiency pass 3: no source file over 1,000 lines, every file self-describing
- No player-visible change: the built page is the same apart from added comment lines.
- The 40 remaining `src/*.js` files over 1,000 lines were split by pure moves into 98
  `<parent>-<part>.js` files of 300-800 lines (the parent is now its include list); the
  largest source file is now under 1,000 lines.
- 173 files gain a one-line header saying what they hold and their main entry points;
  `tools/filemap.py` reads a file's own opening comment first, so most OVERRIDES are gone.
- `tools/filemap.py` lists src/shell.html's `src/ui/*.css` / `*.html` fragments in include
  order and flags any fragment nothing includes.
