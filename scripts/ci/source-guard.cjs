const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const files = execFileSync('git', ['ls-files', '-z'], { maxBuffer: 16 * 1024 * 1024 }).toString().split('\0').filter(Boolean);
const failures = [];
for (const file of files) {
  if (/(^|\/)(\.env(?:\..*)?|service-account[^/]*\.json|google-services\.json|GoogleService-Info\.plist|credentials\.json)$/.test(file) && !file.endsWith('.env.example')) failures.push(`${file}: credential filename`);
  if (/\.(p8|p12|pem|key|jks|keystore|mobileprovision)$/.test(file)) failures.push(`${file}: signing material`);
  const stat = fs.statSync(file);
  if (stat.size > 90 * 1024 * 1024) failures.push(`${file}: oversized tracked asset`);
  if (stat.size > 16 * 1024 * 1024) continue;
  const bytes = fs.readFileSync(file);
  if (bytes.subarray(0, 8192).includes(0)) continue;
  const text = bytes.toString('utf8');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) || /\bsk_[A-Za-z0-9]{24,}\b/.test(text) || /\bgh[pousr]_[A-Za-z0-9]{25,}\b/.test(text)) failures.push(`${file}: private credential pattern`);
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Source guard passed (${files.length} tracked files; targeted scan, not a full secret audit).`);
