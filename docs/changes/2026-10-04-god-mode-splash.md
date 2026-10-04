# God mode splash

- Typing a god mode code plays a full-screen splash. ON (4.2 s): letterbox bars slide in, two gold rings and a
  streak of light charge up while a riser builds, then on the beat "GOD MODE ACTIVATED!" slams in with a red/cyan
  split, a flash, two shockwaves, a burst of sparks and a shake, over a sub boom, a metallic shing, a wide detuned
  power chord, an angelic pad and a glitter run; twin ray layers turn, a shine sweeps the gold and it zooms out.
  OFF (3 s): a steel "GOD MODE DEACTIVATED" glitches in over scanlines with a dark minor hit and digital blips,
  then switches off like an old TV (squash to a line, then a dot) with a tape-stop power-down.
- It plays over Settings, the pause menu or the title; clicks pass through. Reduced motion keeps only the fade.
- Internals: src/god-splash.js (`showGodSplash`), src/god-splash-audio.js (`godFanfare`, impact and power-off
  times shared with the CSS), src/ui/god-splash.{html,css}. Console `godSplash()`, `godSplashStill(on)`,
  `godSplashScrub(on, seconds)`, `godSplashHide()`, `godFanfareRender(on)` / `godFanfareReport()` (offline
  render: peak and loudness); tools/tests/god-mode-codes.mjs checks both cards, that they leave, and both sounds.
