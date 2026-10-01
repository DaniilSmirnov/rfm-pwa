const STORAGE_KEY = 'rfm.selected-rally-id';

function browserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function loadSelectedRallyId(storage = browserStorage()) {
  try {
    return storage?.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function saveSelectedRallyId(id, storage = browserStorage()) {
  if (id == null || id === '') return false;
  try {
    storage?.setItem(STORAGE_KEY, String(id));
    return true;
  } catch {
    return false;
  }
}

export function selectedPackage(packages, id) {
  return (
    (Array.isArray(packages) ? packages : []).find(item => String(item.id) === String(id)) || null
  );
}
