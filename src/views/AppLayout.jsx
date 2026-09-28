import React from 'react';
import AppHeader from '../components/AppHeader.jsx';
import RaceDetails from './RaceDetails.jsx';
import MapView from './MapView.jsx';
import Notice from '../components/Notice.jsx';

export default function AppLayout({
  app,
  selectedRoute,
  onLogoClick,
  pointElevation,
  pointStageDistance,
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
        <MapView
          app={app}
          selectedRoute={selectedRoute}
          pointElevation={pointElevation}
          pointStageDistance={pointStageDistance}
          mapContent={mapContent}
          pointsContent={pointListContent}
          favoritesContent={favoritesContent}
        />
        <RaceDetails app={app} schedule={scheduleContent} media={mediaContent} />
      </main>
      {updateMessage && (
        <Notice as="div" variant="inverse" className="update-banner" role="status">
          {updateMessage}
        </Notice>
      )}
    </>
  );
}
