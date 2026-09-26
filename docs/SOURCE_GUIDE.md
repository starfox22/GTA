# Source guide (moved)

The source guide was split into small area docs under `docs/areas/` (index:
`docs/README.md`), and its hand-maintained file table was replaced by the generated
`docs/FILEMAP.md`. Source comments and old audit logs still point here by section; this is
where each section went:

| Old section | Now |
| --- | --- |
| 1. One closure, many files · 2. Data contracts | docs/areas/core-and-contracts.md |
| 2a. World scale, speeds and handling | core-and-contracts.md (scale), vehicles-and-driving.md |
| 3. Subsystem map | docs/FILEMAP.md (`python3 tools/filemap.py`) |
| 4. City layout, frames, Northbank, water and bridges, drawbridge, streets, county, railway, airfields | docs/areas/world-and-map.md |
| 4. Palm Keys, Sunset Pier, Monarch Isle · 4b. Harbor Point and boats · 4c. Roofs · 4d. Match day, GOALLINE · 6e. MONARCH MOTORS | docs/areas/places-and-venues.md |
| 4. Sea life | world-and-map.md |
| 4d. Input, settings and the HUD, bike share, flight HUD | docs/areas/ui-and-settings.md |
| 4d. Skip the ride, public demo, god mode · 5. Missions | docs/areas/missions-and-demo.md |
| 4d. Audio buses, radio volume, title radio | docs/areas/audio-and-radio.md |
| 6. Rendering notes · 6b. Performance · 6c. Image pipeline and lighting (sign families: rendering.md "Buildings and signs") | docs/areas/rendering.md |
| 6a. Damage and destruction | docs/areas/police-and-combat.md |
| 6c. Police vehicles · 6d. Helicopters · 6d. Civilian cars and motorbikes | docs/areas/vehicles-and-driving.md |
| 7. Build, check, test | CLAUDE.md, docs/areas/testing-and-console.md |
| 8. Known limitations | core-and-contracts.md |

The full previous text is in git history (`git log --follow docs/SOURCE_GUIDE.md`).
