# Third-Party Notices

XinOne currently includes no third-party audio assets.

## Bundled Tools

- `tools/sound/sfx_generator.py`, `tests/test_sfx_generator_portability.py`,
  `.rulesync/metadata/sfx-generator.json` - taken from
  [kavao/OnGen](https://github.com/kavao/OnGen) (MIT License).
  Full license text: `licenses/third_party/OnGen-LICENSE.txt`.
- `tests/test_sfx_generator.py` - adapted from the corresponding test
  suite in [kavao/OnGen](https://github.com/kavao/OnGen) (MIT License),
  with OnGen-internal regression fixtures and their tests removed
  (those are maintained in the OnGen repository itself).

## Project-Originated CC0 Audio

The following sounds were synthesized specifically for this project without external source material and are dedicated to CC0 1.0:

- `hockey:sfx:goal` - Synthetic Goal Chime
- `hockey:sfx:puck-hit` - Synthetic Puck Hit
- `hockey:sfx:center-boost` - Synthetic Center Boost
- `breakout:sfx:ball-hit` - Synthetic Ball Hit
- `shared:sfx:ui-click` - Synthetic UI Click
- `shared:sfx:victory` - Synthetic Victory Jingle
- `shared:sfx:defeat` - Synthetic Defeat Jingle
- `shared:bgm:title-selection` - Synthetic Title Selection Loop
- `shared:bgm:thoughtful` - Synthetic Thoughtful Loop
- `shared:bgm:active` - Synthetic Active Loop
- `shared:bgm:upbeat` - Synthetic Upbeat Loop

Detailed provenance and SHA-256 hashes are stored under `licenses/audio/`.
