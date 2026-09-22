# Tool Foley — soft refresh, 2026-09-22

All sources are CC0: https://creativecommons.org/publicdomain/zero/1.0/.
Freesound high-quality previews and Kenney OGG assets are edited locally.

| Tool | Source | Local input | SHA-256 |
| --- | --- | --- | --- |
| Bottle | [mincedbeats: Glass Bottle Spins And Rolls](https://freesound.org/people/mincedbeats/sounds/698783/) | bottle-spin-new.mp3 | 956b8ad3875955382377e42cad1a357e25a28e3861b04c3cb1c7b277d72ac33a |
| Coin | [janbezouska: Coin Spin](https://freesound.org/people/janbezouska/sounds/386452/) | coin-new.mp3 | a115a323b55a694fa812954d4414124fbb722840a0957e37db9f168e663fb4e4 |
| Hourglass | [dland: Kitchen Timer — Done!](https://freesound.org/people/dland/sounds/149506/) | timer-new.mp3 | 3f95937b07d45f515d63a6af405c054dc34623b8280f741f8f6092a1c0af264c |
| Wheel | [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds), wood light 000/002 | impact.zip | 029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8 |
| Dice / Teams | [Kenney Casino Audio](https://kenney.nl/assets/casino-audio), dice shake/throw 3, card fan 2/place 4 | casino.zip | f36250766ac5bc378c13708ddf12a23a8e54a3251f8d482c7536e51b5dbafa18 |

Preview URLs: `https://cdn.freesound.org/previews/698/698783_723858-hq.mp3`,
`https://cdn.freesound.org/previews/386/386452_3287894-hq.mp3`,
`https://cdn.freesound.org/previews/149/149506_274531-hq.mp3`.

Exact cuts and processing: `../../../scripts/prepare-tool-foley.py`.
Processing: mono 44.1 kHz PCM16, DC removal, 95 Hz high-pass, gentle low-pass,
quiet-floor suppression and edge fades; gain capped at 4x, peak 0.48, RMS 0.065.
Bottle, coin, dice and cards use single motion clips, never rapid loops.
Wheel uses softened wooden detent clicks; hourglass uses a mechanical tick/bell.
Playback gain is additionally reduced per tool in ToolSoundDesign.ts.
Native and web use the same 12 bundled files. The legacy generator does not
replace these assets. Source downloads stay in ignored .expo/foley.
