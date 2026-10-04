# Docs index

Start with `/CLAUDE.md` (commands, rules, workflow). Then open only what the task needs.

| Doc | Read it for |
| --- | --- |
| HANDOFF.md | START HERE for a new session: project state, the owner's preferences, the lead/helper workflow, publish and `main` steps, open items |
| FILEMAP.md | Which file holds what (generated; grep it first) |
| BACKLOG.md | Known issues and loose ends per feature (check before polishing an area) |
| areas/core-and-contracts.md | The closure and include model, units and scale, entity contracts, carriers, saves, performance rules |
| areas/world-and-map.md | Layout and coordinates, frames, the Northbank grid, shores, bridges and the drawbridge, navigation, `layout()` and the layout audit |
| areas/world-county-and-sea.md | The county, falls off cliffs, rail, airfields, parks, sea life |
| areas/world-county-and-sea-terrain.md | Ridgeline terrain: the height field, the 4x4 trails and their grading, the ride on the terrain (suspension), trail dressing, scenic roads |
| areas/places-and-venues.md | Palm Keys, the beach and Marea, Sunset Pier, Harbor Point (marina, superyacht, liners, cargo terminal), North Point Key, roofs and helipads, garages, casino |
| areas/places-monarch-and-county.md | Monarch Isle and MONARCH ONE, Ridgeline villages and the 4x4 club, Fort Sentinel and the Apache, the stadium and GOALLINE, MONARCH MOTORS |
| areas/vehicles-and-driving.md | Vehicle specs, handling, brakes and assists, crashes, riders, cliffs, aircraft, vehicle models and their contracts |
| areas/vehicles-and-driving-handling.md | Steering and grip, brakes and assists, drifts and the handbrake (`driftTest`) |
| areas/people-and-crowd.md | Crowd behaviour, perception, speech bubbles, the character rig |
| areas/people-and-crowd-vehicles.md | Who sees or hears a car coming and how they react (dodge, freeze, hit unaware), the second pass over someone on the ground (harm by speed and weight, blood, dying) |
| areas/people-and-crowd-living-city.md | Free roam's living city: traffic streamed round the player by hour and district, sirens and pulling over, ambulances and paramedics, street events |
| areas/police-and-combat.md | Heat and stars, police response, shooting and wounds, carjacking, overhead cover, damage and breakables |
| areas/police-and-combat-ammo.md | Where guns and rounds come from: no street ammo or armour, the gun shops, taking a body's gun, police vehicles' stock; the on-screen fire rule |
| areas/police-and-combat-witnesses.md | Witnesses and 911 calls: who calls, the call and its bubbles, the response to a report, `witnessReport` |
| areas/police-and-combat-blood.md | Blood: a hit's spatter and drops, the pool a body bleeds out, blasts and impacts, `bleed()` for other code |
| areas/police-and-combat-armour.md | NPC body armour: soft vests and plates by calibre and hit zone, shots to kill per weapon, no knock-back from rounds |
| areas/police-and-combat-driveby.md | Drive-bys: firing arcs per window and body, the aim clamp, the rear screen, the lean-out pose |
| areas/police-and-combat-mounted.md | Mounted guns: the LAV-8's 25 mm and coax, the gun jeep's .50 cal, the Black Hawk's door guns |
| areas/missions-and-demo.md | Mission list and lifecycle, adding a mission, saves, the demo build, RESTART CURRENT JOB and the story index |
| areas/missions-and-demo-godmode.md | God mode (the cheat, its panel, teleport) and skipping a cab, train or liner ride |
| areas/missions-and-demo-mission1.md | Mission 1's look: Vinny's truck model (livery, lamps, crate slots) and the yellow payphone and its dressing |
| areas/missions-bluehour.md | The Blue Hour hotel (mission 2) in 3D: terrace, the VIP table and reserved glass, the street entrance, the limousines and doormen |
| areas/audio-and-radio.md | The mix and buses, sound systems, media and credits, the car radio |
| areas/audio-soundscape.md | Free-roam sound: the ear probe and the room (slap-back, echo, occlusion), ambience beds by place, footsteps by surface, horns, doors, tyre ground |
| areas/rendering.md | Cameras and view, draw-call rules, buildings and signs, ground, water, wet roads, weather, tiers |
| areas/rendering-hiccups.md | First-use hitches: what the title-screen prewarm warms (programs, off-screen passes, stand-in models, the far copy), the first-use log (`renderHiccups`), the rules a new effect follows, dormant lights, numbers |
| areas/boot-and-memory.md | The boot timeline (`bootTimings()`) and what each stage costs, what was cut, the renderer memory soak, the staged tier change, the cell pre-upload and AUTO's resolution hold |
| areas/rendering-lighting.md | HDR pipeline, post passes and the film grade, sun and time of day, night light map, searchlights, the cutaway |
| areas/rendering-vehicle-lights.md | Vehicle lamps: CAR LAMPS, the drive light map, beam shadows, beams on slopes and the terrain horizon |
| areas/rendering-clouds.md | The cloud layer's altitude by weather and area (`cloudBaseAt`), the march, the veil, wisps and lens in cloud, cloud shadows |
| areas/ui-and-settings.md | Input actions, settings, HUD and the interaction prompt, touch, bike share |
| areas/testing-and-console.md | Checks, the headless browser and slots, the dev server, writing tests, tours |
| console/README.md | `window.DeadEndCity` rules (named methods only, adding one) and the index of the per-group method tables in console/ |
| changes/ | Changelog fragments, one per change (see changes/README.md) |
| CHANGELOG.md | The latest release; older ones in archive/CHANGELOG-archive.md |
| THIRD_PARTY_CREDITS.txt | Credits for every third-party asset (embedded in the build: keep it) |
| SOURCE_GUIDE.md, DEVELOPMENT.md | Stubs mapping the old guides to the docs above |

## Audit and QA logs (audit/)

Method, findings and open observations of past passes; read the one for an area before
re-auditing it.

| Log | Covers |
| --- | --- |
| audit/scale-audit.md | People, vehicles, streets, furniture and the camera measured against real sizes (`scaleReport`) |
| audit/performance.md | Simulation, render CPU and frame pacing budgets |
| audit/graphics-review.md | Art-direction review of the map on HIGH, fixes and a performance pass |
| audit/visual-qa.md | Screenshot tour of the whole map after the graphics overhaul |
| audit/3d-meshes.md | Mesh fragments (garage, landmarks, civic, sports, transit, county, harbor, aircraft...) |
| audit/world-layout.md | World layout, railway, county, parks, harbor, sports, streets; the layout audit |
| audit/streets-collision-qa.md | Streets, barriers and collision on the waterfront |
| audit/core-loop.md | Core loop, input, UI, mobile, radio, garages, audio |
| audit/combat-qa.md | Wanted system, police response, pursuit driving, on-foot combat |
| audit/missions-police.md | Missions, police, campaign, chase, challenges, rooftop, casino |
| audit/missions-qa.md | All 16 missions after the world overhaul |
| audit/physics-flight.md | Physics, combat rules, arsenal, air cover, parachute, aviation |
| audit/systems-qa.md | Open-world systems after the railway, beach, superyacht, damage and crowd passes |
| audit/freeroam-sweep.md | Free roam on every island: doors, vehicles, police, services, touch HUD, saves, long idle |

Area docs hold the *why*: contracts, gotchas and decisions the code does not say. Details
that code or FILEMAP already state belong there, not here. Keep each area doc under ~8 KB;
when one grows past that, split it by topic (`<area>-<topic>.md`) and add it to this table.
