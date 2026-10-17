# Shared screen layout

`expo/src/theme/ScreenLayout.ts` owns page geometry. Widths include 16-point
gutters: library 1200, tool library 900, detail/session 720, setup forms 680.
Different content types keep readable widths; each page's navigation and action
footer use the same frame as its content. Do not place a viewport-wide native
navigation row above a constrained desktop form.

`ScreenHeader` is shared by game details/setup/sessions, tool routes, card decks,
lobbies, profile, invitations and purchase details. Its equally sized side slots
keep the title centered with either action missing. Titles may occupy two lines;
navigation controls remain at least 44 points high. It handles the top safe inset
on iOS/Android. Exit/skip confirmation and existing back fallbacks are preserved.

Setup footers participate in flex layout outside the scroller. They reserve real
height rather than covering scrollable controls. Header, cards and Start button
share the form frame and gutters. Player steppers and removal controls have
44-point touch targets; player toolbars wrap rather than overflowing narrow
screens.

Games/Tools/Friends use the same toolbar spacing and 44-point profile control.
`BrandWordmark` frames the visible letters of the existing PNG, removing the
apparent offset caused by the bitmap's transparent margins without changing the
approved artwork. Update its bounds if the canonical wordmark PNG changes.

## Verification

- `npm run typecheck` and the ordinary CI app/backend regressions.
- One-off `expo export --platform web --output-dir .expo/layout-review`.
- `node scripts/verify-navigation-layout.cjs` uses that export by default. Set
  `EXPO_REVIEW_DIR` to another export and, if needed,
  `PUPPETEER_EXECUTABLE_PATH` to an installed Chrome executable.
- The review intercepts requests with exported files and mocked Firebase
  identity responses. It starts no HTTP/Metro server and creates no real account.
  It checks mobile, landscape, tablet and desktop geometry, setup footer bounds,
  menu headers, confirmed session exits and the final two library entries.
- Screenshots are ignored under `expo/.expo/review-*.png`. Browser viewport
  checks do not certify native rendering, device keyboard behavior or VoiceOver.
  Real iOS/Android device review remains distinct from TypeScript/Expo Go export.

The library ends with Pass & Guess, then Ten Tangle. Stable game IDs, saved
configuration and gameplay rules are unchanged.
