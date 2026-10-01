function storageOrNull(storage = globalThis.localStorage) {
  try {
    return storage || null;
  } catch {
    return null;
  }
}

export function readStorage(key, storage = globalThis.localStorage) {
  try {
    return storageOrNull(storage)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function readJsonStorage(key, fallback, storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(readStorage(key, storage) || 'null');
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value, storage = globalThis.localStorage) {
  try {
    storageOrNull(storage)?.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

export function writeJsonStorage(key, value, storage = globalThis.localStorage) {
  try {
    return writeStorage(key, JSON.stringify(value), storage);
  } catch {
    return false;
  }
}

export function removeStorage(key, storage = globalThis.localStorage) {
  try {
    storageOrNull(storage)?.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
