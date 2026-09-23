import { webcrypto } from 'node:crypto';

const { subtle } = webcrypto;
const pair = await subtle.generateKey(
  { name:'ECDSA', namedCurve:'P-256' },
  true,
  ['sign','verify']
);

const privateJwk = await subtle.exportKey('jwk', pair.privateKey);
const publicJwk = await subtle.exportKey('jwk', pair.publicKey);

function b64urlToBytes(value) {
  const base64=value.replace(/-/g,'+').replace(/_/g,'/');
  return Uint8Array.from(Buffer.from(base64,'base64'));
}
function bytesToB64url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

const x=b64urlToBytes(publicJwk.x);
const y=b64urlToBytes(publicJwk.y);
const uncompressed=new Uint8Array(65);
uncompressed[0]=4;
uncompressed.set(x,1);
uncompressed.set(y,33);

privateJwk.key_ops=['sign'];
privateJwk.ext=true;

console.log('VAPID_PUBLIC_KEY=' + bytesToB64url(uncompressed));
console.log('VAPID_PRIVATE_JWK=' + JSON.stringify(privateJwk));
console.log('VAPID_SUBJECT=mailto:you@example.com');
console.log('');
console.log('Store VAPID_PRIVATE_JWK and PUSH_ADMIN_TOKEN as Cloudflare secrets.');
