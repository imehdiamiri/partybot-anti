# Recorded tool Foley

All source recordings are CC0 (https://creativecommons.org/publicdomain/zero/1.0/), verified 2026-09-22. Freesound sources use the publicly available high-quality MP3 previews; the Kenney archive contains OGG recordings. No synthetic melodies remain in the tool cues.

## Bottle — SpliceSound

- Source and license: https://freesound.org/people/SpliceSound/sounds/150438/
- Download: https://cdn.freesound.org/previews/150/150438_1480854-hq.mp3
- Input: `bottle.mp3`
- SHA-256: `5a8d00afe347cf51830d39ba272614cb2c8445305a9d8a75da2d7258160b8dbd`

## Wheel — takecoins

- Source and license: https://freesound.org/people/takecoins/sounds/588351/
- Download: https://cdn.freesound.org/previews/588/588351_13287395-hq.mp3
- Input: `wheel.mp3`
- SHA-256: `923ee9995b22788fd869576f7ef3016afeb92f21954dac33cba3b2a9a8a4d0e2`

## Coin — SpaceJoe

- Source and license: https://freesound.org/people/SpaceJoe/sounds/485744/
- Download: https://cdn.freesound.org/previews/485/485744_6150892-hq.mp3
- Input: `coin.mp3`
- SHA-256: `39ee070aa23cda3fe336f5776cb10c40a0990e2847047643260f8d3dff8ab9c7`

## Timer — maphill

- Source and license: https://freesound.org/people/maphill/sounds/204103/
- Download: https://cdn.freesound.org/previews/204/204103_573247-hq.mp3
- Input: `timer.mp3`
- SHA-256: `5594f7b0bcac15f96838b69c57b231994619dacaddd1876511e376010c8ddde2`

## Dice and team cards — Kenney

- Source and license: https://kenney.nl/assets/casino-audio
- Download: https://kenney.nl/media/pages/assets/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip
- Input: `casino.zip`
- SHA-256: `f36250766ac5bc378c13708ddf12a23a8e54a3251f8d482c7536e51b5dbafa18`

Edits: mono downmix, trim, 44.1 kHz PCM16, DC removal, peak level 0.82 and short edge fades; bottle friction uses a crossfaded loop. Exact cuts are in `../../../scripts/prepare-tool-foley.py`. Bottle uses continuous glass-on-wood friction plus its settling tail. Wheel uses a recorded roulette detent and final movement. Dice uses rattling dice then a real throw. Coin uses recorded metal contact/settling. Teams uses card shuffling/dealing. Hourglass uses a real mechanical timer tick and alarm bell.

Web and native load the same bundled WAV files. The legacy sound generator does not overwrite these recordings.
