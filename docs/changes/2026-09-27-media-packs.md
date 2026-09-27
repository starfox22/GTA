# Media packs: the published page carries no media

- The published game page shrinks from 15.6 MB to 8.8 MB, leaving room for new missions,
  models, textures and sounds; the downloadable zip still plays offline from its folder.
- Internals: `build.py --split-media` / `--zip` write every non-streamed manifest entry into
  `media/pack-{images,audio,data}[-n].js` (a script registering the same data: URL in
  `window.DEAD_END_CITY_MEDIA`, split at 12 MB), loaded by `<script src>` before
  asset-loader.js, which reads the packs first. The single-file build is unchanged.
- Publishing now maps every file in dist/publish/media/ (mp3s and packs).
