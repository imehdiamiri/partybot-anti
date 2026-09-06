# Stable home layout and game hero refresh

## Cause and fix

Production reproduced the reported refresh issue: at a 1280px viewport, fresh
HTML retained 172px card widths; switching Ideas -> Games remounted cards at 279px.
The server used a fallback width while client layout used the real viewport, and
hydration retained the original inline styles. Web now uses CSS grid, delivered
in the static HTML, with 2/3/4 columns and no measured inline card widths. Native
layout is unchanged. Icon placeholders reserve the requested icon dimensions.

## Art

All 16 existing hero assets were replaced through the built-in image_gen tool.
Minimal animated-film 3D style, indigo/purple backgrounds, game-specific subjects.
Original generated files remain intact; the app consumes optimized WebP files in
`expo/assets/images/heroes/`. No runtime image generation or new AI feature.
Each image is 1672x941. Combined transfer size: 748,784 bytes. The initial hero
frame uses this natural ratio, avoiding a 3:2 -> 16:9 layout jump after loading.

- [Complete gallery](hero-gallery-2026-09-06.html)
- [Exact prompts, source images and final asset paths](hero-prompts-2026-09-06.json)
- Optimization: `node scripts/install-generated-heroes.cjs <path-to-sharp>`

## Verification

- TypeScript passed; 149 tests in 18 suites passed; 91 static routes exported.
- Production refresh/navigation: 279.99px before and after on desktop; 165.73px
  before and after at 390px mobile width. Main icon font size remains 52px.
- 390x844: two columns; 768x1024: three; 1440x900: four. No horizontal overflow.
- Mobile Reverse Singing and desktop Imposter: loaded new heroes at their natural
  ratio, rounded corners, bounded width, no colored sidebars. No console errors.
- All 16 production WebP URLs returned HTTP 200 with SHA-256 matching local files.
- Firebase Hosting deployed to partyplay-8. No persistent local server started.
- Expo Go publication and Git recovery references are recorded in RELEASE_LOG.md.
- Physical-device receipt of an Expo update is not certified by browser checks.
