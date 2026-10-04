# God mode splash

- Typing a god mode code now plays a full-screen splash: a gold "GOD MODE ACTIVATED!" that slams in over a
  turning light burst with a flash, a shine and a brass fanfare; typing it again shows a steel "GOD MODE
  DEACTIVATED" with a falling motif. It plays over Settings, the pause menu or the title and fades by itself
  (3.6 s / 2.6 s); clicks pass through. Reduced motion keeps only the fade.
- Internals: src/god-splash.js (`showGodSplash`, `godFanfare`), src/ui/god-splash.{html,css}; the old centre
  headline and beep for the toggle are gone. Console `godSplash()`, `godSplashStill(on)`, `godSplashHide()`;
  tools/tests/god-mode-codes.mjs checks both cards and that they leave.
