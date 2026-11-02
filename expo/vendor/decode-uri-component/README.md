# CommonJS compatibility for the patched decoder

Source: official npm `decode-uri-component@0.5.1`, MIT license retained.
Tarball SHA-512 integrity:
`sha512-vWHQkXgg2cE3BB4rR0c+PYw9BCQzLoNIRMI7AunIkZst74tw/vpPp7VLoYtsR/cy1f55g3XDWUslfeCZjiZJyA==`.

The only source change is replacing `export default function decodeUriComponent`
with `module.exports = function decodeUriComponent`. No decoding logic changes.
Expo Router 57's query-string 7 calls this dependency as a CommonJS function;
directly overriding it with the ESM-only upstream package breaks that contract.

Upstream 0.5.1 fixes GHSA-vcc3-ghjq-m6fr and GHSA-qr28-fpjm-wq7f using a
single-pass malformed UTF-8 decoder. This is the patched algorithm, not an audit
exclusion. Remove this adapter when the supported Expo SDK uses a compatible
patched query-string/decoder dependency. Regression coverage exercises the actual
query-string consumer and malformed input, in addition to normal routing tests.
