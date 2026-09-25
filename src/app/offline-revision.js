/**
 * Installs a fully downloaded revision in package metadata before deleting the
 * previous revision. A failed metadata write discards only the staged data.
 */
export async function replaceOfflineRevision({ packageData, key, download, savePackage, discardRevision }) {
  let staged = null;
  try {
    staged = await download();
    const next = { ...packageData, [key]: staged };
    await savePackage(next);
    staged = null;

    const previous = packageData?.[key];
    if (previous && previous.storageId !== next[key]?.storageId) {
      try { await discardRevision(previous, packageData.id); }
      catch (error) { console.warn(`Could not remove previous ${key} revision`, error); }
    }
    return next;
  } catch (error) {
    if (staged) {
      try { await discardRevision(staged, packageData.id); }
      catch (cleanupError) { console.warn(`Could not remove staged ${key} revision`, cleanupError); }
    }
    throw error;
  }
}
