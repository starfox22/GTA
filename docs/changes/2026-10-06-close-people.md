# People up close
- Chase view: the player and up to seven people nearest the camera (about 12 m) use a new near set: smoother
  bodies (neck and shoulders, chest or bust, blades, glutes, knees, calves), a modelled face and ears, hands with
  a thumb and fingers, shoes and boots on soles, bare feet with toes, hair with real hairlines and partings.
- Faces are painted: eyes, irises, lid lines, brows, lips, nostrils, stubble or beards, and make-up from the
  look's seed; hair has strands and a highlight along them; skin wraps the light a little and is smoother.
- Cloth up close: folds at the waist, armpits, elbows, knees and over the shoe, seams, plackets and buttons,
  uniform and hoodie pockets, lapels, jeans' pockets, yoke and stitching, a suit's crease, laces.
- Every view: arms, hands and legs were drawn inside out (lit from the wrong side); they now face out.
- Cost (seeded A/B, Broadway 17:00, HIGH): +8 camera and +6 shadow draws (at most +10/+6), scene triangles
  +1.7% with the player near (about 17k per near person), packing CPU unchanged; the street view identical.
- Internals: character-near3d.js, -head.js, -shader.js (`BODY_NEAR`, `rigNearBits`, `rigNearMaterial`);
  crowd3d-frame.js NEAR PEOPLE (`chooseNearPeople`); `crowdStats().near`; tools/tests/rig-geometry.mjs;
  docs/areas/people-and-crowd-rig.md.
