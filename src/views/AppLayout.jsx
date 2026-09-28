import React from 'react';
import AppHeader from '../components/AppHeader.jsx';
import CatalogSection from '../components/CatalogSection.jsx';
import SavedOfflineSection from '../components/SavedOfflineSection.jsx';
import RaceDetails from './RaceDetails.jsx';
import MapView from './MapView.jsx';
import Notice from '../components/Notice.jsx';

export default function AppLayout({
  app,
  selectedRoute,
  onLogoClick,
  pointElevation,
  pointStageDistance,
  catalogContent,
  packagesContent,
  statsContent,
  pointListContent,
  favoritesContent,
  scheduleContent,
  mediaContent,
  mapContent,
  installPrompt,
  screenContent,
  updateMessage,
}) {
  return (
    <>
      <AppHeader online={app.online} onLogoClick={onLogoClick} />
      {installPrompt}
      <div className="react-tab-content">{screenContent}</div>
      <main>
        <CatalogSection app={app}>{catalogContent}</CatalogSection>
        <SavedOfflineSection app={app} packages={packagesContent} stats={statsContent} />
        <RaceDetails app={app} schedule={scheduleContent} media={mediaContent} />
        <MapView
          app={app}
          selectedRoute={selectedRoute}
          pointElevation={pointElevation}
          pointStageDistance={pointStageDistance}
          mapContent={mapContent}
          pointsContent={pointListContent}
          favoritesContent={favoritesContent}
        />
      </main>
      {updateMessage && (
        <Notice as="div" variant="inverse" className="update-banner" role="status">
          {updateMessage}
        </Notice>
      )}
    </>
  );
}
