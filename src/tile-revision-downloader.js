const DEFAULT_RETRIES = 1;

export const normalizeTileData = value => {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  return value;
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retry(operation, attempts, retryDelayMs) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(retryDelayMs * attempt);
    }
  }
  throw lastError || new Error('Tile download failed');
}

/**
 * Downloads a tile set into an uncommitted storage revision. The caller owns
 * the final metadata commit so the previous revision remains usable until all
 * tiles are present.
 */
export async function downloadTileRevision({
  tiles,
  storageId,
  getTile,
  fetchTile,
  saveTile,
  concurrency = 6,
  retries = DEFAULT_RETRIES,
  retryDelayMs = 150,
  resume = false,
  cleanupOnFailure = false,
  deleteRevision,
  onProgress = () => {},
  progressIntervalMs = 150,
  maxZoom,
}) {
  if (!Array.isArray(tiles) || !tiles.length) throw new Error('Tile plan is empty');
  if (!storageId || typeof getTile !== 'function' || typeof fetchTile !== 'function' || typeof saveTile !== 'function') {
    throw new TypeError('Tile revision downloader is missing required dependencies');
  }

  let done = 0;
  let saved = 0;
  let bytes = 0;
  let failed = 0;
  let reused = 0;
  const errors = [];
  const queue = [...tiles];
  let lastProgressAt=-Infinity;

  async function worker() {
    while (queue.length) {
      const tile = queue.shift();
      try {
        const existing = resume ? normalizeTileData((await getTile(storageId, tile.z, tile.x, tile.y))?.data) : null;
        if (existing?.byteLength) {
          reused++;
          saved++;
          bytes += existing.byteLength;
        } else {
          const value = await retry(() => fetchTile(tile), retries, retryDelayMs);
          const data = normalizeTileData(value?.data ?? value);
          if (!data?.byteLength) throw new Error('Downloaded tile is empty');
          await saveTile(storageId, tile.z, tile.x, tile.y, data);
          saved++;
          bytes += data.byteLength;
        }
      } catch (error) {
        failed++;
        errors.push({ tile, error });
      }
      done++;
      const now=globalThis.performance?.now?.()??Date.now();
      if(done===tiles.length || now-lastProgressAt>=progressIntervalMs){
        lastProgressAt=now;
        onProgress({ done, total: tiles.length, saved, bytes, failed, reused, maxZoom });
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), queue.length) }, () => worker()));
    if (failed) {
      const first = errors[0]?.error;
      const error = new Error(`Failed to download ${failed} of ${tiles.length} tiles${first?.message ? `: ${first.message}` : ''}`);
      error.stats = { done, total: tiles.length, saved, bytes, failed, reused, maxZoom };
      throw error;
    }
    return { done, total: tiles.length, saved, bytes, failed, reused, maxZoom };
  } catch (error) {
    if (cleanupOnFailure) {
      try { await deleteRevision?.(storageId); }
      catch (cleanupError) { console.warn('Could not remove failed tile revision', cleanupError); }
    }
    throw error;
  }
}
