# Lower clouds and a freefall through them
- The cloud layer comes down to where you meet it: from ~400 m on a clear day, ~370 m fair, ~300 m under an overcast and ~250 m in a storm; lower over the open sea (and at dawn), a little higher over the city, and in the wet it sinks onto the Ridgeline, clinging to the summits. Overcast and rain decks are flatter and trail scud under the base.
- Jumping through cloud: the tops rush up, the jumper sinks into the white and the ground disappears, rags of cloud stream past the camera at the fall's speed, water beads on the lens and is swept up the frame, the view greys out inside and opens up again under the base. The same, slower, under an open canopy; aircraft in cloud get a lighter veil.
- Clouds glow through with multiple scattering (grey only in the heart and base of a deep deck); tall towers and hills standing in the cloud fade into it correctly; shafts of light under broken cloud (HIGH, ULTRA).
- A soft, damp roar and hiss of droplets while in cloud.
- Internals: clouds.js holds the layer (`cloudBaseAt`/`cloudTopAt`, the only source of the cloud altitude; `cloudAmountAt`, `playerCloudImmersion()` for sound); clouds3d.js split into field, march, near (veil), wisps, shadows, frame and lens (post composite).
- Console: `cloudLayer(x, y, altitudeM)`, `cloudSpot(kind, lead)`, `cloudJump(metres, kind)`.
