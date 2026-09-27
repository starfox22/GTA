# Mission 1's look: Vinny's truck and the yellow payphone

The demo's first impression: the payphone the player is sent to at a fresh start (Armory St,
`phone` in game-state.js) and the truck the first job hands over (`HARBOR.truck`). Game
rules for the job are in missions-and-demo.md; this page is the models and the dressing.

## Vinny's truck (vinnytruck3d.js, type `flatbed`)

- `makeVinnyTruck` builds every `flatbed` (only mission 1 spawns one): an ATLAS medium-duty
  conventional (International 4700 / F-800 class) with a 5.4 m hardwood flatbed, at real size
  (`modelScale` 1; spec `l` 9.5 m, `w` 2.8 m over the mirrors, unchanged). Body 2.44 m, cab
  roof 2.74 m, deck 1.28 m, wheels r 0.51 m at x +3.55 / -1.9 m, duals at the rear.
- One kit per session (`vinnyKit`, in sharedGeometries): paint, trim (vertex colour, finish
  and trim-atlas cell per part), glass, markers, indicators, four lamps, a tyre, a dual pair
  and rims. About 17 draws and 9k triangles without crates (the old box model: 85 draws).
- Contract: `civilian` (cars3d.js `animateCivilianCar` runs the lamps with the shared lamp
  materials, rolls and steers the wheels) but not `car`: no crumple shell; damage is
  specialDamage's (tyres, burn) plus the lamps. `extra.animate` lights the amber/red markers
  with the lamps, blinks the hazards while the mission truck waits without a driver, sets
  `lampOut` for broken lamps' halos and drops the livery on a burnt shell.
- Head lamps sit at 1.0 m, 4.45 m forward: the class default `headlightFrame()` mount
  (truck lamp height) matches them, so the beams need no model mount.
- Livery: one canvas (`vinnyLivery`): door lettering (MORETTI & SONS CARTAGE) per side band
  and the roof's fleet number `07`. Only thin skins over the doors and roof carry it (a part
  spanning both bands would smear lettering across its faces). A respray keeps the lettering.
- Extruded profiles (`vtProfile`, hood and fenders) grow by 0.8 × bevel in the profile plane:
  parts mounted on their faces are placed past that growth.
- Crates: `VINNY_CARGO` (harbor-terminal.js) holds the three slots on the bed, the deck
  height and the crate scale; `cargoPosition` (the crane's drop, harbor3d.js) and the
  model's crates read it, so a lowered crate lands where the truck's own appears.
- Check: `carModels()` reports the truck (draws, casters, triangles).

## The yellow payphone (payphone3d.js)

- A 1990s pedestal payphone facing the street (south, the camera's side): yellow enamel
  enclosure with grime running down (canvas map), stainless phone (LCD, coin slot, 12 keys,
  coin return, card), handset on an armoured cord, placards and stickers inside, directory
  on the shelf, and a double-sided PHONE light box on the post (`litSignMaterial`: lit at
  night, off in a blackout) with its pool in the night light map (`signLightPools`).
- The handset trembles on its hook while the story call waits (`updatePayphoneVisuals`,
  reads `storyCallWaiting()`; render only).
- Two newspaper boxes flank it; worn concrete, gum, butts, a flyer, a cup, leaves along the
  kerb, weeds at the lot edge and a storm drain are flat decals (walked over).
- The booth and the boxes are foot obstacles (`registerFootObstacle`, render side like the
  bus shelters); the phone's reach (68 units) is unchanged.
- Included after render3d-resources.js: it builds at setup with the civilian kit, whose
  `civGeometry` / materials use sharedGeometries / sharedMaterials.
- Block kerb gotcha: a 0.35 m kerb strip runs along the block edge at y 562 (render3d-terrain.js),
  1.1 m south of the phone: keep pavement decals off local z 0.94..1.31 m.
- The car park behind it (bays y 498..537) has three parked cars (game-populate.js); the
  bay behind the booth stays empty so the booth reads against the tarmac.
