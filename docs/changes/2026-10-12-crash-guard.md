# One fault no longer stops the game; a lost graphics context recovers

- An error in one part of a frame no longer freezes the whole game: the frame loop logs it once and keeps going.
- If the browser takes the graphics card's context away (GPU memory, a driver reset), the game pauses and says so
  instead of freezing on a black picture; when the picture comes back the page saves and reloads.
- Internals: frame-guard.js (`frameFault`, console `frameFaults()`, `frameFaultDrill(where)`), gpu-context.js
  (`watchGpuContext`, console `gpuContext('lose'|'restore')`); `soakReport().gpu` lists programs, textures and
  geometries; tools/tests/frame-guard.mjs.
- A slide down the summit scree no longer carries on after you board a vehicle and get out again.
