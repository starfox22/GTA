# Change fragments

One file per change: `docs/changes/<yyyy-mm-dd>-<topic>.md` (start one with
`python3 tools/changelog.py --new <topic> "<Title>"`). Never edit docs/CHANGELOG.md
directly; `python3 tools/changelog.py --release <version> "<Title>"` folds these in.

```markdown
# Sea life: dolphins, gulls and a great white
- Dolphin pods follow boats in open water; gulls circle the piers (sealife.js).
- The great white hunts swimmers off Palm Keys at night.
- Console: `DeadEndCity.sealife()` reports every animal.
```

A title, then a few bullets: what a player notices first, then notable internals
and new console methods or tools. Keep it under ~15 lines; the details belong in
the area doc (docs/areas/) or in source comments.
