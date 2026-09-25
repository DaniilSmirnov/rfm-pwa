export function createOfflineMapControls({
  getCurrentPackageId,
  getPackage,
  savePackage,
  downloadOfflineMap,
  removeOfflineMap,
  discardOfflineMapRevision,
  buildDownloadPlan,
  formatBytes,
  selectPackage,
  refreshList,
}) {
  const $ = id => document.getElementById(id);
  const elements = () => ({
    buttons: [$('downloadMapBtn'), $('downloadMapBtnTop')].filter(Boolean),
    deletes: [$('deleteMapBtn'), $('deleteMapBtnTop')].filter(Boolean),
    statuses: [$('offlineMapStatus'), $('offlineMapStatusTop')].filter(Boolean),
  });

  function setUi({ button, status, deleteHidden, disabled }) {
    const els = elements();
    for (const el of els.buttons) { if (button != null) el.textContent = button; if (disabled != null) el.disabled = disabled; }
    for (const el of els.statuses) { if (status != null) el.textContent = status; }
    for (const el of els.deletes) { if (deleteHidden != null) el.hidden = deleteHidden; if (disabled != null) el.disabled = disabled; }
  }

  function update(pkg) {
    if (!pkg) {
      setUi({ button: 'Скачать офлайн-карту', status: 'Сначала выбери сохранённую гонку.', deleteHidden: true, disabled: true });
      return;
    }
    if (pkg.offlineMap?.ready) {
      const layers = (pkg.offlineMap.vectorLayers || []).map(value => typeof value === 'string' ? value : value?.id).filter(Boolean);
      setUi({
        button: `Обновить карту (${formatBytes(pkg.offlineMap.bytes || 0)})`,
        status: `Офлайн-подложка готова · ${pkg.offlineMap.tileCount || 0} тайлов · ${layers.length} слоёв · ${formatBytes(pkg.offlineMap.bytes || 0)} · z${pkg.offlineMap.minZoom}–${pkg.offlineMap.maxZoom}${layers.length ? ` · ${layers.slice(0, 8).join(', ')}` : ''}`,
        deleteHidden: false,
        disabled: false,
      });
      return;
    }
    let status = 'Офлайн-подложка ещё не скачана.';
    try {
      const plan = buildDownloadPlan(pkg.geojson);
      status = `Будет скачано до ${plan.tiles.length} векторных тайлов · z${plan.minZoom}–${plan.maxZoom}. Размер зависит от района.`;
    } catch {}
    setUi({ button: 'Скачать офлайн-карту', status, deleteHidden: true, disabled: false });
  }

  async function download() {
    const id = getCurrentPackageId();
    if (!id) return;
    setUi({ disabled: true });
    let staged = null;
    let pkgId = id;
    let failureMessage = '';
    try {
      const pkg = await getPackage(id);
      if (!pkg) return;
      pkgId = pkg.id;
      const previous = pkg.offlineMap || null;
      if (navigator.storage?.persist) { try { await navigator.storage.persist(); } catch {} }
      staged = await downloadOfflineMap(pkg, progress => {
        setUi({
          button: `Карта ${progress.done}/${progress.total}`,
          status: `Скачано ${progress.saved} тайлов · ${formatBytes(progress.bytes)}${progress.failed ? ` · ошибок ${progress.failed}` : ''}`,
        });
      }, { previousMap: previous });
      pkg.offlineMap = staged;
      await savePackage(pkg);
      staged = null;
      if (previous) {
        try { await discardOfflineMapRevision(previous, pkg.id); }
        catch (error) { console.warn('Could not remove previous offline map revision', error); }
      }
      await selectPackage(pkg.id);
      await refreshList();
    } catch (error) {
      if (staged) {
        try { await discardOfflineMapRevision(staged); }
        catch (cleanupError) { console.warn('Could not remove staged offline map revision', cleanupError); }
      }
      failureMessage = `Не удалось скачать карту: ${error.message}`;
      alert(failureMessage);
    } finally {
      update(await getPackage(pkgId));
      if (failureMessage) setUi({ status: failureMessage, disabled: false });
    }
  }

  async function remove() {
    const id = getCurrentPackageId();
    if (!id || !confirm('Удалить офлайн-подложку этой гонки?')) return;
    const pkg = await getPackage(id);
    if (!pkg) return;
    await removeOfflineMap(pkg);
    delete pkg.offlineMap;
    await savePackage(pkg);
    await selectPackage(pkg.id);
    await refreshList();
  }

  for (const id of ['downloadMapBtn', 'downloadMapBtnTop']) $(id)?.addEventListener('click', download);
  for (const id of ['deleteMapBtn', 'deleteMapBtnTop']) $(id)?.addEventListener('click', remove);

  return { update, download, remove };
}
