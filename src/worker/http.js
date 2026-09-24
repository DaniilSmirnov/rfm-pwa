const encoder = new TextEncoder();

export function bytesToBase64Url(bytes) {
  let binary='';
  const view=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

export function textToBase64Url(value) {
  return bytesToBase64Url(encoder.encode(value));
}

export async function sha256Base64Url(value) {
  return bytesToBase64Url(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
}

export async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

export function commonHeaders(extra = {}) {
  return {
    'x-rfm-worker': 'rallyfans-companion-v0.6.0',
    'x-content-type-options': 'nosniff',
    ...extra,
  };
}

export function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: commonHeaders({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }),
  });
}
