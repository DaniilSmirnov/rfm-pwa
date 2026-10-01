const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DEFAULT_JSON_LIMIT = 256 * 1024;

function contentLength(request) {
  const value = Number(request?.headers?.get?.('content-length'));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

async function readLimitedText(source, maxBytes) {
  const reader = source?.getReader?.();
  if (!reader) return null;
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      total += chunk.byteLength;
      if (total > maxBytes) return null;
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock?.();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return decoder.decode(bytes);
}

export function bytesToBase64Url(bytes) {
  let binary = '';
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function textToBase64Url(value) {
  return bytesToBase64Url(encoder.encode(value));
}

export async function sha256Base64Url(value) {
  return bytesToBase64Url(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

export async function readJson(request, { maxBytes = DEFAULT_JSON_LIMIT } = {}) {
  try {
    if (contentLength(request) > maxBytes) return null;
    const text = await readLimitedText(request?.body, maxBytes);
    if (text == null) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function readResponseText(response, { maxBytes = 5 * 1024 * 1024 } = {}) {
  try {
    const length = Number(response?.headers?.get?.('content-length'));
    if (Number.isFinite(length) && length > maxBytes) return null;
    return await readLimitedText(response?.body, maxBytes);
  } catch {
    return null;
  }
}

export async function mapWithConcurrency(items, limit, mapper) {
  const values = Array.from(items || []);
  const results = new Array(values.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await mapper(values[index], index);
    }
  };
  const workers = Math.min(Math.max(1, Number(limit) || 1), values.length);
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
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
    headers: commonHeaders({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    }),
  });
}

export async function fetchWithTimeout(input, options = {}, timeoutMs = 10_000) {
  const controller = new AbortController();
  const external = options.signal;
  let timedOut = false;
  const abortFromExternal = () => controller.abort(external?.reason);
  if (external) {
    if (external.aborted) abortFromExternal();
    else external.addEventListener('abort', abortFromExternal, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(input, { ...options, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error(`Upstream request timed out after ${timeoutMs} ms`);
      timeoutError.name = 'UpstreamTimeoutError';
      timeoutError.timeoutMs = timeoutMs;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    external?.removeEventListener?.('abort', abortFromExternal);
  }
}
