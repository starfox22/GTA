# The player model

- The player is now a ready-made, photo-textured character: the Microsoft Rocketbox avatar Male_Adult_16 (MIT),
  restyled towards the owner's reference: a black tee with a white skull on the chest, dark indigo jeans, brown
  shoes, dark brown hair, a trimmed dark beard, lightly tanned skin, a broader chest, narrower waist and heavier arms.
- He is still posed by the rig's 15 bones (walk, aim, seats, ragdoll poses), grips weapons with his own fingers
  (relaxed, gripping and trigger hand shapes made from the model's finger bones), takes wounds and loses limbs as
  before; one draw and one shadow draw, about 7k triangles (the field body had 112k).
- tools/player_model.py converts the FBX (its own binary FBX reader) into assets/player-model.bin and two texture
  atlases (assets/player-skin.webp, assets/player-detail.webp: normal map and specular), 0.5 MB in all; the fit to the
  bind skeleton happens at load (player-body3d-asset.js). The field body stays as the fallback.
- PB_WIDTH and the player look's widthAbsolute are 1.04 (the model's shoulders); the crowd-set colours of the player
  follow the new clothes. Console `playerModel()` reports `model` and `textured`.
