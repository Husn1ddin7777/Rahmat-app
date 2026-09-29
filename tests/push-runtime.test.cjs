// Run the production sender in workerd, not Node's fetch. In particular,
// workerd rejects redirect:'error' before a network request can be sent.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
const root = path.resolve(__dirname, '..');
execFileSync(process.execPath, ['scripts/build-worker.cjs'], { cwd: root, windowsHide: true });
const bundle = fs.readFileSync(path.join(root, '.worker/index.mjs'), 'utf8');
assert.ok(bundle.includes('server_default as default'));
const script = bundle.replace('server_default as default', 'pushRuntimeProbe as default') + `
const pushRuntimeProbe = { async fetch() {
 const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
 const vapid = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const receiver = await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const jwk = await crypto.subtle.exportKey('jwk',vapid.privateKey);
 const subscription = {endpoint:'https://web.push.apple.com/runtime-test',expirationTime:null,keys:{p256dh:encode(await crypto.subtle.exportKey('raw',receiver.publicKey)),auth:encode(crypto.getRandomValues(new Uint8Array(16)))}};
 const env = {VAPID_PUBLIC_KEY:encode(await crypto.subtle.exportKey('raw',vapid.publicKey)),VAPID_PRIVATE_KEY:jwk.d,VAPID_SUBJECT:'https://rahmat.example'};
 const now = Date.now();
 const delivery = {notice:{id:'test-runtime',title:'Rahmat',body:'Runtime test',screen:'today',url:'/',tag:'test-runtime'},dueAt:now,expiresAt:now+60000,attemptAt:now,attempts:0};
 let httpStatus;
 const outcome=await sendPush(subscription,delivery,env,now,status=>{httpStatus=status});
 return Response.json({outcome,httpStatus});
}};`;

test('workerd sends a valid push request and refuses redirects without leaking credentials to another host', async () => {
  for (const status of [201, 307]) {
    const calls = [];
    const mf = new Miniflare(convertV4MiniflareOptions({
      modules: true, script, compatibilityDate: '2026-09-27', port: 0,
      outboundService: async request => {
        calls.push(request.url);
        assert.equal(request.url, 'https://web.push.apple.com/runtime-test');
        assert.equal(request.method, 'POST');
        assert.equal(request.headers.get('content-encoding'), 'aes128gcm');
        assert.equal(request.headers.get('urgency'), 'high');
        assert.match(request.headers.get('authorization'), /^vapid t=/);
        assert.equal((await request.arrayBuffer()).byteLength, 4096);
        return new Response(null, {status, headers: status === 307 ? {Location:'https://untrusted.example/'} : {}});
      },
    }));
    try {
      const response = await mf.dispatchFetch('https://rahmat.example/');
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {outcome: status === 201 ? 'sent' : 'rejected',httpStatus:status});
      assert.equal(calls.length, 1);
    } finally { await mf.dispose(); }
  }
});
