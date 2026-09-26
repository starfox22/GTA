# Docs index

Start with `/CLAUDE.md` (commands, rules, workflow). Then open only what the task needs.

| Doc | Read it for |
| --- | --- |
| FILEMAP.md | Which file holds what (generated; grep it first) |
| areas/core-and-contracts.md | The closure and include model, units and scale, entity contracts, carriers, saves, performance rules |
| areas/world-and-map.md | Coordinates, the street grid, bridges and the drawbridge, county, terrain, rail, airfields, sea life, layout audit |
| areas/places-and-venues.md | Palm Keys and Marea, Sunset Pier, Monarch Isle, marina and liners, roofs, Ridgeline and the 4x4 club, Fort Sentinel, stadium and GOALLINE, MONARCH MOTORS |
| areas/vehicles-and-driving.md | Vehicle specs, handling, brakes and assists, crashes, riders, aircraft, vehicle models and their contracts |
| areas/people-and-crowd.md | Crowd behaviour, perception, speech bubbles, the character rig |
| areas/police-and-combat.md | Heat and stars, police response, shooting and wounds, overhead cover, damage and breakables |
| areas/missions-and-demo.md | Mission list and lifecycle, adding a mission, saves, the demo build, god mode, ride skip |
| areas/audio-and-radio.md | The mix and buses, sound systems, media and credits, the car radio |
| areas/rendering.md | Cameras, draw-call rules, HDR pipeline, lighting, searchlights, cutaway, buildings and signs, ground, wet roads |
| areas/ui-and-settings.md | Input actions, settings, HUD and the interaction prompt, touch, bike share |
| areas/testing-and-console.md | Test tools, headless tips, tours, console rules and the index of the `DeadEndCity` tables (console/) |
| changes/ | Changelog fragments, one per change (see changes/README.md) |
| CHANGELOG.md | The latest release; older ones in archive/CHANGELOG-archive.md |
| audit/ | QA and review logs (method, findings, open observations) |
| THIRD_PARTY_CREDITS.txt | Credits for every third-party asset (embedded in the build: keep it) |
| SOURCE_GUIDE.md, DEVELOPMENT.md | Stubs mapping the old guides to the docs above |

Area docs hold the *why*: contracts, gotchas and decisions the code does not say. Details
that code or FILEMAP already state belong there, not here. Keep each area doc under ~8 KB;
when one grows past that, split it.
