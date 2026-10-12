# Cull rooftop solar panels in spatial groups

- Close views with shadows off can skip offscreen rooftop solar panels in 2048-unit cells,
  without adding draw calls or changing
  placements, geometry, materials or the shadow camera's access to offscreen casters.
- Original single-draw pools remain available for shadowed presets, wide/flight views, any draw fan-out,
  future source mutations and console A/B comparisons (`sceneryPools(false/true)`).
- The measured LOW Royal Avenue street case removes 169 of 199 solar-panel instances
  (2,028 triangles) with unchanged draw calls. The live opt-in is limited to this measured
  family: 8 chunks and 12,736 extra matrix bytes. Other equipment awaits profiling.
- Added a real-Three host regression: exact matrices, conservative bounds, shadow-only
  casters, bounded main-camera fan-out, stable repeated updates and fallback behavior.
  The close fixture submits 16 of 1,024 instances with the same one camera draw.
- Added repeatable laptop profiling instructions for presets, chase/top-down views and
  dry/night/rain scenes. The provisional target is 60 FPS at a 1920×1080 scene buffer;
  Ultra on M4 Max remains a real-device validation target, not a cloud benchmark result.
