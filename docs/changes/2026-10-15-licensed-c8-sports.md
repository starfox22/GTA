# Licensed C8 sports body and native cabin

- The ordinary Chevette now draws Hari's free CC BY4.0 C8 Stingray, with its authored cabin, dashboard, bucket seats, mirrors and native door layers. Existing vehicle identity and handling remain.
- Preserve source PBR/UVs and night instruments in dedicated albedo/ORM/emissive atlases; HIGH/ULTRA use4096, LOW/MEDIUM2048. Retain painted resprays and the existing lamp, damage, repair and char contracts.
- Cache85,031-triangle close and9,407-triangle far geometry. Wheels retain measured hubs; brake calipers follow steering/suspension and cancel rolling rotation.
- Include all four authored lamp Far parts in actual distance swaps, avoiding1,958 extra triangles per distant C8 while retaining headlight/brake materials and damage/repair behavior.
- Add pinned source download/hash/licence evidence, clean offline rebuild tools and meaningful source/runtime integrity tests; details in `docs/areas/vehicles-and-driving-models-sports.md`.
