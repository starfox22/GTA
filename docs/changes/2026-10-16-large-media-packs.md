# Exact source models stay inside the split-media file limit

- A single large media asset now spans ordered classic script packs, each at most 12 MB including its wrapper. The asset loader receives the exact original data URL after the final append, including when the downloaded game is opened from `file://`.
- Source byte counts and SHA-256 labels remain in every fragment; ordinary pack contents and cache identities remain unchanged. Inline builds and streamed radio assets keep their existing format.
- Verification: `python3 tools/build-media-chunks-check.py` reconstructs an 18,026,262-byte hero model in Node's classic-script VM, checks neighbors, ceilings, boundaries and cache behavior. The existing media-cache regression also passes.
