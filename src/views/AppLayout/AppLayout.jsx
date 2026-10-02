import './AppLayout.css';
import React from 'react';
import AppHeader from '../../components/AppHeader/AppHeader.jsx';
import RaceDetails from '../RaceDetails/RaceDetails.jsx';
import MapView from '../MapView/MapView.jsx';
import Notice from '../../components/Notice/Notice.jsx';
import ScreenHeader from '../../components/ScreenHeader/ScreenHeader.jsx';

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
  onSelectRally,
  onOpenRaces,
  screenHeader,
}) {
  return (
    <>
      {screenHeader ? (
        <ScreenHeader title={screenHeader.title} onBack={screenHeader.onBack} />
      ) : (
        <AppHeader
          onLogoClick={onLogoClick}
          currentPackage={app.currentPackage}
          packages={app.packages}
          onSelectRally={onSelectRally}
        />
      )}
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
          onOpenRaces={onOpenRaces}
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
