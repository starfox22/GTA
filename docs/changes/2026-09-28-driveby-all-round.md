# Drive-bys: all round from a car, the cross for a blocked shot

- From a car the pistol fires all round again: ahead through the windscreen, out of either
  side window, back through the rear screen; the first shot through a screen shatters it
  (glass crumbs; a repair puts it back and winds the side windows up).
- Fixed: shooting behind with the mouse while driving went out of the driver's window.
  Every fresh press of a driving key handed the aim to the keyboard's auto-aim; at the
  wheel the pointer now keeps the aim (on foot nothing changes).
- Trucks, vans, buses, the ambulance, police cars and mid-engined supercars (nothing to
  see through behind the seats) fire over about 270 deg; a shot toward the 90 deg straight
  back fires nothing and shows a small cross for a moment. No message.
- The aim line and ring from the window are gone.
- Riders fire all round but the right rear quarter; boats all round; aircraft out of the
  side windows. The hypercars and 4x4s now have drive-by profiles too.
- Console: `driveByScreenPoint(relDegrees, metres)`; `driveBy()` reports the cross and the
  windscreen. Tools: `dev.mjs mouse` / `t.mouse` move the real pointer in tests.
