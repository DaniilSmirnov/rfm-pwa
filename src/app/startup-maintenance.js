export function scheduleStartupMaintenance(deps){
  const run=async()=>{
    const {
      markBoot,setupServiceWorkerUpdates,ensurePersistentStorage,setupPeriodicBackgroundSync,
      requestRallyPackBackgroundRefresh,processCachedRallyPackUpdates,getAllPackages,savePackage,
      scheduleRaceReminders,refreshPushUi,getPushSubscription,scheduleAllSavedReminders,
      loadCatalog,onRegistration
    }=deps;

    markBoot('maintenance-start',{online:navigator.onLine});
    const registration=await setupServiceWorkerUpdates({
      onDiagnostic:(name,detail)=>markBoot(name,detail)
    });
    onRegistration?.(registration);
    markBoot('sw-setup-finished',{registered:Boolean(registration)});

    const storage=await ensurePersistentStorage();
    markBoot('persistent-storage-checked',storage);

    await setupPeriodicBackgroundSync(registration);
    markBoot('periodic-sync-checked');

    if(navigator.onLine) requestRallyPackBackgroundRefresh(registration);

    const smartUpdate=await processCachedRallyPackUpdates({getAllPackages,savePackage,scheduleRaceReminders})
      .catch(error=>{console.warn('Smart Rally Pack update failed',error);return null;});
    markBoot('cached-updates-processed',smartUpdate);

    await refreshPushUi();
    markBoot('push-ui-ready');

    if(navigator.onLine){
      try{
        if(await getPushSubscription()) await scheduleAllSavedReminders();
        markBoot('push-reminders-refreshed');
      }catch(error){
        console.warn('Could not refresh scheduled race reminders on startup',error);
        markBoot('push-reminders-failed',{message:String(error?.message||error)});
      }
    }else{
      markBoot('push-reminders-skipped',{reason:'offline'});
    }

    void loadCatalog().then(()=>markBoot('catalog-refresh-finished')).catch(()=>{});
  };

  if('requestIdleCallback' in window){
    requestIdleCallback(()=>void run(),{timeout:1500});
  }else{
    setTimeout(()=>void run(),300);
  }
}
