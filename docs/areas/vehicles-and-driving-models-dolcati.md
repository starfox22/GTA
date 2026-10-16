# Vehicles and driving: downloaded Dolcati

The owner's October 16 replacement uses ROY's **Ducati Panigale V4**, downloaded
from a pinned GitHub mirror with model-specific CC BY 4.0 metadata. It ships in
the independent `dolcati-vehicle-*` pack; the original 23-model pack and every
approved motorcycle array remain unchanged. `tools/dolcati_vehicle_models.py`
supports `--download` and verifies the exact GLB SHA before conversion.

The close mesh retains all 372,664 authored triangles, split normals (signed16),
source UVs and full-resolution source textures. A separate 25,717-triangle far
mesh shares the same meshes/draw calls and restores source normals after reduction.
The player bike retains close detail; unoccupied Low/Medium bikes and bikes more
than 9 m away use far geometry, with 7 m re-entry hysteresis. Existing bullet/dent
face pins still preserve near geometry. Geometry is cached across instances;
forks, wheels, paint, lights and damage remain independent. High/Ultra use 2048px
atlases, Low/Medium 1024px. These budgets are not hardware FPS measurements.

Both rolling axles and tyre radii come from the actual source tyres. Rotors,
circular hubs and rims roll; the front spindle, calipers, fender and forks steer
without spinning. The fairing-mounted headlights stay on the chassis. The actual
front saddle is measured by a barycentric ray; paired grips and driver footrests
set rider contacts, with a sport tuck verified for 1.65–1.9 m adults. Preserve the
source rear wheel's authored lateral offset rather than recentering its geometry.

Source albedo, scalar roughness/metalness, lamp artwork and emission survive the
atlas. Resprays replace only the source red pigment in the paint shader and keep
white source lettering. Tyres use the shared physically rough rubber treatment;
the transmission glass and opaque tail-cover placeholder receive optical treatment. The source
declares no normal maps. Missing media or disabled asset rendering retains the
procedural Dolcati fallback. `tools/tests/dolcati-model.mjs` exercises the real
decoder, builders, wheel axes, LOD budgets and character contact/IK contracts.

