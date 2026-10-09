# Avatars everywhere: police, soldiers, gangs, children, story characters and the player in uniform

- Up close everyone is now a downloaded Microsoft Rocketbox avatar: patrol officers (three men, a woman), traffic
  officers in a hi-vis vest painted on a police avatar, SWAT, FED agents (POLICE patches relettered FED; a FED vest on
  a businesswoman), soldiers and MPs (six), paramedics, gangs (eight avatars, their tops tinted to the crew's colour),
  mobsters and their boss, waiters, footballers and basketball players in their club's colours, stewards, bikers,
  cyclists, jet skiers, people seated in cars and patrol cars, and children (four Rocketbox children, drawn as
  children). Story characters each have their own avatar: Vinny, Elena, Mara, Rafe, Daniel Vega, the consul and
  Lieutenant Kessler off duty.
- In Kessler's borrowed uniform the player is one of the fort's soldiers (Military_Male_05, the MPs' avatar), in
  mission 2's suit a businessman in a cream jacket; out of them his own body again.
- More people get the full near mesh: near slots per tier 6 / 8 / 12 / 14 (were 4 / 6 / 8 / 8) plus 4-10 for riders,
  occupants, athletes and beachgoers; uniforms rank first; up to 24 avatars at mid at once.
- Internals: 64 cast entries in assets/npc-models.bin (59 avatars, 6 painted variants) and an atlas of 3840x2560;
  tools/npc_paint.py (vests, relettering, the tint mask in the atlas' alpha); the TINT in the avatar shader (`npcTint`,
  the mid row's texel 31); late takers and `npcPlayerSlot` / `playerAvatarOn` in npc-avatar3d.js; children fitted at an
  adult's stature (`npcChildGrow`). Console: `avatarLineup(spacing)`; `npcAvatars()` reports `late`, `player`, tints.
