import React from 'react';

export default function OfflineMapActions({app,top=false}){
  const variant=top?'Top':'';
  return <div className={top?'offline-cta':'actions'}>
    <button id={`downloadMapBtn${variant}`} className="button primary" disabled={app.mapUi.disabled} onClick={app.downloadMap}>{app.mapUi.button}</button>
    <button id={`deleteMapBtn${variant}`} className="button danger" hidden={app.mapUi.deleteHidden} disabled={app.mapUi.disabled} onClick={app.deleteMap}>Удалить карту</button>
    <button id={`downloadTerrainBtn${variant}`} className="button" disabled={app.terrainUi.disabled} onClick={app.downloadTerrainForRace}>{app.terrainUi.button}</button>
    <button id={`deleteTerrainBtn${variant}`} className="button danger" hidden={app.terrainUi.deleteHidden} disabled={app.terrainUi.disabled} onClick={app.deleteTerrain}>Удалить рельеф</button>
    <span id={`offlineMapStatus${variant}`} className="muted small">{app.mapUi.status}</span>
    <span id={`terrainStatus${variant}`} className="muted small">{app.terrainUi.status}</span>
  </div>;
}
