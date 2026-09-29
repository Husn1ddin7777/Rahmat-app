// Run after the first deployment. Keep the backup outside the source directory.
// Neither the private key nor the JSON payload is printed to the terminal.
const fs = require('node:fs');
const path = require('node:path');
const { generateKeyPairSync } = require('node:crypto');
const { spawn } = require('node:child_process');
const [subject, backupArgument] = process.argv.slice(2);
if (!subject || !backupArgument || !/^(https:\/\/\S+|mailto:[^\s@]+@[^\s@]+\.\S+)$/.test(subject)) {
  console.error('Usage: node scripts/setup-push.cjs https://YOUR-LIVE-APP-URL /absolute/private/path/rahmat-vapid.json');
  process.exit(1);
}
const root = path.resolve(__dirname, '..');
const backup = path.resolve(backupArgument);
if (backup === root || backup.startsWith(root + path.sep)) throw new Error('Keep the secret backup outside the app/source folder.');
let keys;
if (fs.existsSync(backup)) {
  keys = JSON.parse(fs.readFileSync(backup, 'utf8'));
  if (!keys.VAPID_PUBLIC_KEY || !keys.VAPID_PRIVATE_KEY) throw new Error('Invalid key backup.');
  keys.VAPID_SUBJECT = subject;
} else {
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = pair.privateKey.export({ format: 'jwk' });
  keys = {
    VAPID_PUBLIC_KEY: Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url'),
    VAPID_PRIVATE_KEY: jwk.d,
    VAPID_SUBJECT: subject,
  };
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.writeFileSync(backup, JSON.stringify(keys), { flag: 'wx', mode: 0o600 });
}
const child = spawn(process.execPath, [path.join(root, 'node_modules/wrangler/bin/wrangler.js'), 'secret', 'bulk'], {
  cwd: root, env: process.env, stdio: ['pipe', 'inherit', 'inherit'], windowsHide: true,
});
child.stdin.end(JSON.stringify(keys));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
