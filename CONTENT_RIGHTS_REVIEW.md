# Content and store review — 2026-09-29

This is a repository and release-risk audit, not a legal clearance or a guarantee
of App Store / Google Play approval. No license documents for commercial music
were found in the repository. The owner requested removal of the Whitney mode
from iOS; removal on Android/web was separately proposed and remains undecided.

## Findings and actions

| Content | Evidence | Action / remaining work |
| --- | --- | --- |
| Whitney recording | `expo/assets/sounds/whitney_raw.wav`; original commercial recording restored in the September 22 release | iOS platform module exports no audio asset and disables this mode; stale sessions fall back to Metronome. A real iOS export asset map was checked and contains no `whitney_raw`. Android/web still include it pending the owner's decision; removal or documented rights is recommended there too. |
| Drum metronome / UI tones | Locally synthesized assets and generator scripts under `expo/scripts` | Retained. Do not reintroduce the legacy Whitney trim script into iOS asset imports. |
| Tools Foley | `expo/assets/sounds/tools/SOURCES.md` lists Freesound and Kenney sources, CC0 declarations, hashes and processing | Source record retained; Kenney Casino Audio and the bottle source were rechecked against their public source pages. Archive license evidence for the remaining sources before final store submission. |
| Tool illustrations | `expo/assets/images/tools/README.md` records built-in image generation and prompts | Retained. Generated origin alone is not a warranty of third-party rights. |
| Other hero/onboarding/logo art | Local image assets; not every image has an individual provenance/license record | No blanket rights clearance claimed. Preserve generation receipts / original source ownership evidence before store submission. |
| Imposter movie words | `expo/src/content/imposterWords.ts` includes movie/character names as text guessing prompts, with translations | Names alone are different from distributing a movie recording or artwork. No film clips were identified by this code audit. Do not use the names/logos to imply sponsorship; final trademark/content review remains with the owner. |
| Spicy cards | Follow-up traced the actual export: all 422 `isSpicy: true` records were already filtered out of ORIGINAL_CARDS, so they were not playable. | At the owner's request, removed the unused 422 records and Spicy subtype itself from source/bundles. The playable catalog remains 2,888 cards, including Favorites lookup. The initial source-only risk observation was broader than actual runtime behavior; this corrects it. Store audience/rating answers must still describe the remaining content accurately. |
| User voice recordings | Reverse Singing records and can share user audio | Sharing user recordings does not grant music rights. No public music catalog/license was added. |
| Ads / privacy | New AdMob SDK and web AdSense placement code | Privacy page updated; UMP/Google CMP configured. Store data safety / App Privacy declarations must reflect SDK data collection before submission. Native previews use test ads; no live ads were clicked. |

## References

- [Apple App Review Guidelines, including 5.2 intellectual property and age-appropriate content](https://developer.apple.com/app-store/review/guidelines/)
- [Kenney Casino Audio](https://kenney.nl/assets/casino-audio)
- [Bottle Foley source](https://freesound.org/people/mincedbeats/sounds/698783/)

Older published binaries and cached assets are not erased by a new Git commit or
OTA. New iOS builds/updates exclude the recording; prior releases must not be
resubmitted as the reviewed version. Git history is retained for recovery.
