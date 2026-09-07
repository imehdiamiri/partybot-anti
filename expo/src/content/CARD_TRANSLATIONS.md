# Offline card translations

`cardTranslations.json` bundles Persian (fa), Turkish (tr), German (de), French
(fr), and Arabic (ar) for all 2,888 built-in cards, keyed by stable card ID.
English remains visible. Selecting a language performs a synchronous local lookup.
No translation endpoint, API key, paid service, network request, or model is used
by the app. Custom user-written cards are not sent anywhere and do not receive
automatic translations. An initially downloaded web app is still required;
offline translation does not guarantee that a never-loaded website opens offline.

## Build provenance and review

Initial drafts were generated locally with M2M100-418M (MIT), using CTranslate2
INT8 on the development computer. Model weights and the Python environment are
not shipped or committed. Model: https://huggingface.co/facebook/m2m100_418M
Converted weights: https://huggingface.co/gn64/M2M100_418M_CTranslate2

These are machine-assisted translations with sampled editorial corrections,
not a complete professional linguistic review. Idioms and culturally specific
prompts may need further editing. `cardTranslationCorrections.json` stores
reviewed source-unit replacements. The six discussion questions are reused
across 112 authored scenarios (672 new discussion cards).

To assemble cached local drafts and corrections, run from `expo`:

    node scripts/assemble-card-translations.cjs <local-cache-directory>

The cache directory must contain `translation-cache-fa.json` and equivalents for
tr/de/fr/ar, each mapping English source units to translated text. This assembly
step does not access the network. Tests enforce complete ID/language coverage.
