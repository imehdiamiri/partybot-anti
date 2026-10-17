const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const braces = require('braces');
const forge = require('node-forge');

test('all installed callers resolve to reviewed local forks', () => {
 for (const name of ['braces', 'node-forge']) {
  const pkg = require(name + '/package.json');
  assert.equal(pkg.name, '@8playo/' + name);
  assert.match(pkg.version, /-8playo\.1$/);
 }
 const expoRequire = createRequire(require.resolve('expo/package.json'));
 const cliRequire = createRequire(expoRequire.resolve('@expo/cli/package.json'));
 const signingRequire = createRequire(require.resolve('@expo/code-signing-certificates'));
 assert.equal(cliRequire('node-forge'), forge);
 assert.equal(signingRequire('node-forge'), forge);
 const lock = require('../package-lock.json');
 for (const [path, pkg] of Object.entries(lock.packages)) {
  if (/node_modules\/(braces|node-forge)$/.test(path)) {
   assert.equal(pkg.link, true, path + ' must use the reviewed local fork');
   assert.match(pkg.resolved, /^vendor\/(braces|node-forge)$/);
  }
 }
});
test('ordinary brace patterns and nested alternatives retain behavior', () => {
 assert.deepEqual(braces.expand('a/{b,c}/{1..3}'), ['a/b/1','a/b/2','a/b/3','a/c/1','a/c/2','a/c/3']);
 assert.equal(braces.compile('{a,{b,c}}'), '(a|(b|c))');
});
test('deep brace/paren inputs and caller-supplied ASTs fail before recursion', () => {
 for (const [open,close] of [['{','}'],['(',')']]) {
  const pattern = open.repeat(4000)+'a,b'+close.repeat(4000);
  for (const fn of [braces,braces.parse,braces.compile,braces.expand,braces.stringify]) {
   assert.throws(()=>fn(pattern), {name:'SyntaxError',message:/security depth/});
  }
 }
 let ast = {type:'text',value:'x'};
 for(let n=0;n<10000;n++) ast={type:'root',nodes:[ast]};
 for (const fn of [braces.compile,braces.expand,braces.stringify]) {
  assert.throws(()=>fn(ast), {name:'SyntaxError',message:/security depth/});
 }
 const cyclic = {type:'root',nodes:[]}; cyclic.nodes.push(cyclic);
 assert.throws(()=>braces.compile(cyclic), {name:'SyntaxError'});
});

const keys = crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const publicKey = forge.pki.publicKeyFromPem(keys.publicKey.export({type:'spki',format:'pem'}));
const message = Buffer.from('8Playo signature regression');
const digest = crypto.createHash('sha256').update(message).digest('binary');
test('valid RSA signatures and altered-message rejection still work', () => {
 const signature = crypto.sign('sha256',message,keys.privateKey).toString('binary');
 assert.equal(publicKey.verify(digest,signature),true);
 assert.equal(publicKey.verify(digest.replace(/^./,'!'),signature),false);
});
function signDigestInfo(mutator) {
 const a = forge.asn1;
 const info=a.create(a.Class.UNIVERSAL,a.Type.SEQUENCE,true,[
  a.create(a.Class.UNIVERSAL,a.Type.SEQUENCE,true,[
   a.create(a.Class.UNIVERSAL,a.Type.OID,false,a.oidToDer(forge.pki.oids.sha256).getBytes()),
   a.create(a.Class.UNIVERSAL,a.Type.NULL,false,'')
  ]),
  a.create(a.Class.UNIVERSAL,a.Type.OCTETSTRING,false,digest)
 ]);
 mutator(info,a);
 const der=Buffer.from(a.toDer(info).getBytes(),'binary');
 const em=Buffer.concat([Buffer.from([0,1]),Buffer.alloc(256-der.length-3,255),Buffer.from([0]),der]);
 return crypto.privateEncrypt({key:keys.privateKey,padding:crypto.constants.RSA_NO_PADDING},em).toString('binary');
}
test('nested DigestAlgorithm garbage and non-empty NULL signatures rejected', () => {
 for(const mutate of [
  (info,a)=>info.value[0].value.push(a.create(a.Class.UNIVERSAL,a.Type.OCTETSTRING,false,'garbage')),
  info=>{info.value[0].value[1].value='garbage';},
  (info,a)=>info.value.push(a.create(a.Class.UNIVERSAL,a.Type.NULL,false,''))
 ]) assert.throws(()=>publicKey.verify(digest,signDigestInfo(mutate)), /valid RSASSA-PKCS1-v1_5/);
});
test('SHA-256 AlgorithmIdentifier with omitted optional NULL remains valid', () => {
 assert.equal(publicKey.verify(digest,signDigestInfo(info=>info.value[0].value.pop())),true);
});
test('Expo code-signing certificate generation and verification still work', () => {
 const signing = require('@expo/code-signing-certificates');
 const keyPair = {publicKey, privateKey:forge.pki.privateKeyFromPem(keys.privateKey.export({type:'pkcs1',format:'pem'}))};
 const now = Date.now();
 const certificate = signing.generateSelfSignedCodeSigningCertificate({keyPair,
  validityNotBefore:new Date(now-60000),validityNotAfter:new Date(now+3600000),commonName:'8Playo regression only'});
 signing.validateSelfSignedCertificate(certificate,keyPair);
 assert.ok(signing.signBufferRSASHA256AndVerify(keyPair.privateKey,certificate,message));
});
