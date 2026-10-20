# Military combat rendering

- All vehicle stain fitting and painting share one 3 ms cooperative allowance per
  rendered frame. A slow frame cannot reopen that allowance for each damaged car.
- Repeated ammo/health HUD refreshes reuse equipped weapon artwork, including
  mounted weapons and Apache icons. Atlas loading, resizing and weapon changes
  still invalidate the bitmap.
- Particle billboards omit proven transparent atlas borders and discard empty
  atlas samples before soft-depth work, preserving counts, lifetimes and artwork.

Validation and native profile limits are recorded in the October 20 military
combat audit. The software renderer does not establish hardware FPS.
