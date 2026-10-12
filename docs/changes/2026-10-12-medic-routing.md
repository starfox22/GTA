# Ambulance junction recovery and bridge safety

- An ambulance held by a stopped vehicle can take a different block when it has a clear approach to a nearby junction. It considers both approaches to the patient and drives normally along the replacement route.
- Replanning is limited to three attempts, eight seconds apart. Visible vehicles never jump, collision handling remains active, and mission drivers are excluded. Fully boxed-in vehicles keep the existing wait/offscreen/abort behavior.
- Ambulances now obey raised-drawbridge stop limits as well as traffic and pedestrian clearance; their early return from ordinary county-route steering previously skipped that check.
- `medicReport()` includes detours/attempts; `medicRoutingAudit()` and `tools/tests/medic-routing.mjs` exercise the actual world graph. `node tools/medic-routing-check.mjs` checks blocked-road recovery, unchanged positions, protected roles, retry bounds, unsafe approaches and drawbridge limits without a browser.
