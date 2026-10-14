# Independent replacement-asset audit

These are candidates for visual approval, not imported game assets. No production files were changed by this audit.

## Generic passenger car pack — Comrade1280

The original 11,761,956-byte GLB embeds asset.extras containing author Comrade1280, full source Sketchfab URL and **CC-BY-4.0**. This is model-specific evidence, stronger than a repository-wide code license. Original pack is 69,312 triangles, 75 meshes, 41 materials and 39 images. The candidate offroad extraction is 6,502 triangles with four separate wheels; SUV is 7,951 triangles with four separate wheels. 1024-pixel albedo and metallic/roughness textures were found. No normal maps are declared for those variants. An interior has not yet been visually confirmed. Do not promise AAA interior detail or photorealism from these counts alone. A sheriff livery, lightbar, interior assessment and damage/LOD work would still be necessary.

Source: https://sketchfab.com/3d-models/generic-passenger-car-pack-20f9af9b8a404d5cb022ac6fe87f21f5

Primary model page was not successfully accessible during this research. Embedded Sketchfab-export license metadata was successfully read from the downloaded original asset.

## SRAD sport motorcycle — nouter2077

The pinned Nonplanar-Vehicle-Control README explicitly credits this motorcycle to nouter2077 under CC BY 4.0 and links https://skfb.ly/oIYFv. The downloaded GLB itself has **no author/license extras or copyright**: only pygltflib generator/version. Thus license is documented by the redistributor, not independently confirmed on the blocked creator page.

Actual GLB: 15,428,024 bytes, 403,396 triangles, 51 meshes/primitives, 38 materials, zero embedded images. This is an attractive high-detail candidate for inspection but far too heavy to ship unchanged in a busy browser city. Optimization, LODs and material consolidation are necessary; zero images does not mean absent visual color, because material factors exist. Do not promise 4K PBR textures. Display it as a source-model preview pending original-license verification and optimization feasibility.

The README also includes unrelated CC-BY-NC racing-car and skybox assets. Its code is MIT. Neither category overrides this motorcycle's explicitly stated asset-specific CC BY license. Do not import unrelated NC assets from this repository.

Pinned evidence: https://raw.githubusercontent.com/thomasfork/Nonplanar-Vehicle-Control/8cb0ee51e2cf5cf7b3abbf21d3bdadc538a6c672/README.md

## Real Motorbike 02 — jsa201077

VGFramework README explicitly distinguishes MIT code from separately licensed data. Its asset table identifies **Real Motorbike 02**, author **jsa201077**, model URL below, and CC BY 4.0. This is model-specific third-party license evidence, although original creator page remains unverified. Other sounds/assets in this repo are NC or restricted; only the identified motorcycle geometry and its associated texture should be considered.

Source: https://sketchfab.com/3d-models/real-motorbike-02-unity3d-f24e366933c54835b562e5210d93047f
Author: https://sketchfab.com/unityjsa7

Native FBX inspection: body 6,435 triangles, fork 1,516, one wheel 2,200. Assembled total with two supplied wheels is **12,351 triangles**, subject to actual prefab confirmation. Separate body/fork/wheel files make proper steering/rolling integration more approachable. Available texture is one albedo PNG; do not describe it as a complete modern PBR texture set. A materials upgrade and LODs would still be required.

README source: https://github.com/vimontgames/vgframework/blob/b3173a3814790af7061f1949437a3c958b00000b/README.md

## Approval readiness

Show all candidates as native-source model renders, not as implemented-game screenshots. Car pack has sufficient embedded attribution/license evidence for a provisional import decision. Motorcycle candidates are appropriate for visual approval, with the source README's license claim clearly identified; verify original creator license before public integration. CC BY 4.0 generally permits commercial adaptation with attribution, license link and change notice. Preserve creator credit, original URL, downloaded SHA and dated license evidence in any eventual import.

From efficiency alone, Real Motorbike 02 is the more practical motorcycle baseline. The high-detail SRAD can be offered as a visual option requiring a larger optimization step. Neither has been proven AAA-ready in the actual game. The car-pack SUVs may be relatively lightweight but their art quality/interior must be judged from actual renders before recommending them as a major visual upgrade.
