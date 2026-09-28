import React from 'react';
import ActionGroup from './ActionGroup.jsx';
import Button from './Button.jsx';

export default function OfflineMapActions({app,top=false}){
  const variant=top?'Top':'';
  return <ActionGroup className={top?'offline-cta':''}>
    <Button id={`downloadMapBtn${variant}`} className="button primary" disabled={app.mapUi.disabled} onClick={app.downloadMap}>{app.mapUi.button}</Button>
    <Button id={`deleteMapBtn${variant}`} className="button danger" hidden={app.mapUi.deleteHidden} disabled={app.mapUi.disabled} onClick={app.deleteMap}>Удалить карту</Button>
    <Button id={`downloadTerrainBtn${variant}`} className="button" disabled={app.terrainUi.disabled} onClick={app.downloadTerrainForRace}>{app.terrainUi.button}</Button>
    <Button id={`deleteTerrainBtn${variant}`} className="button danger" hidden={app.terrainUi.deleteHidden} disabled={app.terrainUi.disabled} onClick={app.deleteTerrain}>Удалить рельеф</Button>
    <span id={`offlineMapStatus${variant}`} className="muted small">{app.mapUi.status}</span>
    <span id={`terrainStatus${variant}`} className="muted small">{app.terrainUi.status}</span>
  </ActionGroup>;
}
