# Monarch downloaded collection and selected names

The remaining eleven Monarch Prestige entries now use ten downloaded real-car
sources, with explicit family/class alternatives and model-level CC BY 4.0
credits. The existing Brutini SVJ and ordinary Chevette source packs are retained.
Chrynser Sebing and Chorley 72 use the owner's selected names; other displayed
names, stable types, handling, prices and saves stay in their existing tables.

The separate source pack preserves every included near face, split normal,
colour, map UV and source material flag. Wheels/brakes, glass, source-backed
doors, fitted adult occupants, resprays, damage, burn and repair use the game's
existing vehicle contracts. Clean paint no longer multiplies source ORM by a
second generic finish. High texture residency follows one driven/nearest source
family; other collection maps use <=1024 atlases. The source downloads and close
geometry are preserved, with far-only reduction and lossless storage aliases.
Source-tile sampling now guards the minification footprint with a conservative
inset, correcting the observed neighbouring-tile mip bleed while retaining the
byte-identical native 128-pixel carbon texture. The guard uses shared atlas
mipmaps; it does not build a periodic mipmap chain for each source tile.
A source-specific dark rubber tint also corrects the downloaded Roadster’s pale
Sidewall/Thread materials without changing other tyre families or source data.

See the [collection audit](../audit/monarch-collection-review-2026-10-17/README.md)
for actual source identities, source-corner/cockpit proofs, material lifecycle
checks, the independent 1,938-case atlas filtering oracle and the thirteen-entry
native before/after comparisons. All thirteen exact camera/status comparisons
and 223 final native lifecycle/showroom assertions pass with zero rendering
errors. The Pages workflow verifies the published files against the checked
artifact; the collection audit records its deployment receipt.
The [source workflow](../sources/monarch-vehicles/README.md) pins downloads,
licenses and editable recipes; the [pipeline contract](../areas/vehicles-and-driving-models-monarch-pipeline.md)
describes conversion and runtime boundaries.
