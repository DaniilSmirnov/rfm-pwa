import React from 'react';
import AppHeader from '../components/AppHeader.jsx';
import AppFooter from '../components/AppFooter.jsx';
import CatalogSection from '../components/CatalogSection.jsx';
import SavedOfflineSection from '../components/SavedOfflineSection.jsx';
import RaceDetails from './RaceDetails.jsx';
import MapView from './MapView.jsx';

export default function AppLayout({
  app,selectedRoute,onLogoClick,pointElevation,pointStageDistance,catalogContent,packagesContent,
  statsContent,pointListContent,favoritesContent,scheduleContent,mediaContent,mapContent,
  installControl,installPrompt,updateMessage
}){
  return <>
    <AppHeader online={app.online} installControl={installControl} onLogoClick={onLogoClick}/>
    {installPrompt}
    <main>
      <CatalogSection app={app}>{catalogContent}</CatalogSection>
      <SavedOfflineSection app={app} packages={packagesContent} stats={statsContent}/>
      <RaceDetails app={app} schedule={scheduleContent} media={mediaContent}/>
      <MapView app={app} selectedRoute={selectedRoute} pointElevation={pointElevation}
        pointStageDistance={pointStageDistance} mapContent={mapContent} pointsContent={pointListContent}
        favoritesContent={favoritesContent}/>
    </main>
    {updateMessage&&<div className="update-banner" role="status">{updateMessage}</div>}
    <AppFooter/>
  </>;
}
