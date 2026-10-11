# People: the avatars' cast, painted variants and tints

Who is drawn as which Microsoft Rocketbox avatar (MIT; docs/THIRD_PARTY_CREDITS.txt) near the camera. The levels,
slots and cost are in people-and-crowd-avatars.md. Code: src/npc-avatar-cast.js (casting, tints), tools/npc_models.py
(CAST: tags, rig traits, painting options), tools/npc_paint.py (texture edits).

## Casting (npcAvatarPick, once per look in compileLook)

- By role and sex: compileLook's `female` (lookFemale, the rule voices.js shares) and a tag from the role, outfit,
  city role or name; the look's hash picks within the tag's pool. Uniforms and children (`NPC_UNIFORMS`) never fall
  back to a civilian (the other sex's uniform first); other tags fall back to the street cast.
- Only the player in his own clothes has no avatar (-1: his own body, people-and-crowd-player.md).
- Street, motorist and story looks wear their avatar's palette and cut on the far rig (`npcAvatarLookTraits`); other
  outfits keep their own rig look far off.

| Role | Men | Women |
| --- | --- | --- |
| street | Male_Adult_01, 04, 06, 08, 12, 17 | Female_Adult_01, 02, 03, 04, 11, 15 |
| summer, tourist; commuter | Male_Adult_01, 17; Male_Adult_08, Business_Male_01 | Female_Adult_01, 03; Female_Adult_02, 15, Business_Female_01, 03 |
| reveller, party guest | Male_Adult_04, 06, 08, Business_Male_01 | Female_Adult_03, 04, 11, Female_Party_02 |
| elder, worker, jogger, beach | Male_Adult_14, Construction_Male_07, Sports_Male_04, Sports_Male_01 | Female_Adult_14, (street), Sports_Female_02, Sports_Female_01 |
| kid (street and beach) | Male_Child_01, 02 | Female_Child_01, 02 |
| patrol police | Police_Male_01, 03, Security_Male_01 | Security_Female_01 |
| traffic police (painted hi-vis) | Traffic_Male_01, 03 | Traffic_Female_01 |
| SWAT | Police_Male_02 | (Police_Male_02: SWAT are men) |
| FED agents | Fed_Male_07 (Police_Male_07, patches FED) | Fed_Female_01 (Business_Female_01, FED vest) |
| soldiers; gate MPs | Military_Male_01, 03, 04; Military_Male_02, 05, 06 | - |
| paramedics | Medical_Male_01 | Medical_Female_01 |
| gangs (tinted to the crew's colour) | Male_Adult_04, 09, 10, 12, 18, 20 | Female_Adult_04, 12 |
| motorcyclists (tinted jacket + the rig's helmet) | the gang pool | the gang pool |
| cyclists, motorists (car occupants) | street | street |
| jet skiers | beach | beach |
| mobsters; the boss | Business_Male_01, 03; Business_Male_05 | - |
| waiters, bartenders | Business_Male_06 | (Business_Male_06) |
| footballers, referees (kit tinted) | Sports_Male_02, 03 | - |
| basketball (tank tinted) | Sports_Male_04 | - |
| stewards (vest tinted to the kit) | Steward_Male_09 (Male_Adult_09, painted vest) | - |
| the player's borrowed uniform (mission 4) | Military_Male_05 (also an MP) | - |
| the player's suit (mission 2, tinted cream) | Business_Male_02 | - |

Story characters by name (`NPC_STORY_CAST`; tag `named`, never drawn for anyone else): Vinny Moretti Male_Adult_03,
Elena Cruz Female_Adult_07, Mara Velez Female_Adult_13, Rafe Serrano Male_Adult_05, Daniel Vega Male_Adult_07, the
consul Anton Varga Business_Male_04, Lieutenant Kessler off duty (`missionDriver` 'kessler') Male_Adult_11. Other
story actors: party guests, waiters and paramedics by their name (`NPC_STORY_TAGS`), the rest from the street cast.

## Painted variants (tools/npc_paint.py, texture edits of the downloaded maps)

A CAST entry's 7th field paints its body page through a bake of each texel's bind position and part: `vest` (colour,
reflective bands as fractions of hip-to-shoulder, tintable, back letters) over the torso between the hips and the
shoulders, the collar left; `relabel` boxes (page pixels) refilled with the patch's own ground colour and lettered anew
(POLICE -> FED); `base` the avatar it is painted from (mesh shared, its own atlas cell).

## Tints (npcAvatarTint; the atlas' alpha, the shader's TINT)

- `tint` in CAST masks the top garment: body-page texels of the torso and arms (and the hood: `hood`) whose colour is
  close in chroma to the chest's median and not skin; `'kit'` takes the whole shirt (striped kits). The mask is the
  atlas' alpha on body pages: 255 none, 128 all (never lower: browsers un-premultiply low alpha). Hair cards keep
  their own alpha in their own cells; the depth program cuts only zone 5.
- The header's `tint` is the masked garment's mean linear luminance; npcAvatarTint returns (colour / tint, 1), and the
  shader sets a masked texel to that times its luminance: the garment keeps its folds and prints in the new colour.
- Tinted outfits (`NPC_TINTED`): gang (the crew's `p.color`), motorcyclist (`look.top`), playerDisguise (`look.top`),
  athlete (the kit's primary; a steward's vest `look.vest.a`). An untinted look on a tinted avatar shows its own colours.
- Near slots carry it in `npcTint`, mid rows in texel 31 of their bone row.

## Re-running the converter

`NPC_CACHE=<folder> python3 tools/npc_models.py <Rocketbox Avatars root>`: convert_one results are pickled in the
folder, so repainting reruns in a minute instead of ten. Sources: <root>/<Group>/<Avatar>/Export/<Avatar>.fbx and
Textures/*_color*.tga from github.com/microsoft/Microsoft-Rocketbox.
