# Reviewed local security forks

These are private source forks, not claimed upstream releases. npm audit does
not assess private fork code. The unchanged registry audit gate is supplemented
by mandatory exploit regression tests in `scripts/security-forks.test.cjs`.
Remove these forks when compatible upstream fixes have shipped and passed the
same regressions. Never replace them with an unpatched registry copy merely to
reduce repository size. All original license/copyright notices are retained.

## braces 3.0.3 → @8playo/braces 3.0.3-8playo.1

- Official source: https://registry.npmjs.org/braces/-/braces-3.0.3.tgz
- Upstream integrity: `sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==`
- Advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- Parser rejects nesting at 128 before constructing deeper brace/paren nodes.
  All recursive public AST walkers first validate depth/node count iteratively;
  cycles and external deeply nested ASTs cannot bypass the parser's limit.
- Ordinary expansion, ranges and compilation are unchanged. Exceeding the hard
  security limit raises SyntaxError; callers cannot opt out of this limit.

## node-forge 1.4.0 → @8playo/node-forge 1.4.0-8playo.1

- Official source: https://registry.npmjs.org/node-forge/-/node-forge-1.4.0.tgz
- Upstream integrity: `sha512-LarFH0+6VfriEhqMMcLX2F7SwSXeWwnEAJEsYm5QKWchiVYVvJyV9v7UDvUv+w5HO23ZpQTXDv/GxdDdMyOuoQ==`
- Advisory: https://github.com/advisories/GHSA-86w9-cpqp-85rv
- RSA PKCS#1 v1.5 verification also validates the nested AlgorithmIdentifier
  element count (OID, optional NULL) and requires an empty primitive NULL.
  Extra elements and garbage in NULL are rejected before digest comparison.
- SHA-256 signatures with both valid optional-NULL encodings are tested, along
  with altered messages and correctly padded signatures containing malformed
  DigestInfo. No cryptographic primitive/signature generation is replaced.
- Unpatched prebuilt browser dist/Flash artifacts are omitted. Expo CLI and
  signing tools load the patched CommonJS `lib/index.js`; upstream browser field
  mappings are preserved. Package lifecycle scripts/dev dependencies removed.

Only manifests and the listed security source files differ from these official
tarballs; READMEs and licenses are preserved. No private credentials included.
