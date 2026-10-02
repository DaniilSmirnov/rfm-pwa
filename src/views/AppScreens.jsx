import React from 'react';
import TodayView from './TodayView.jsx';
import SettingsView from './SettingsView.jsx';
import RacesView from './RacesView.jsx';
import MoreSectionView, { moreSectionTitles } from './MoreSectionView.jsx';
import MoreMenu from '../components/MoreMenu.jsx';
import CrewResults from '../components/CrewResults.jsx';
import EmptyScreenState from '../components/EmptyScreenState.jsx';

export function getScreenHeaderTitle(tab, moreScreen) {
  if (tab !== 'more' || moreScreen === 'menu') return null;
  return {
    races: 'Управление гонками',
    settings: 'Настройки и диагностика',
    ...moreSectionTitles,
  }[moreScreen] || 'Раздел гонки';
}

export default function AppScreens({
  app,
  tab,
  moreScreen,
  crewResultsOpen,
  onMap,
  onResults,
  onRaces,
  onOpenRaces,
  onOpenCrewResults,
  onCloseCrewResults,
  onSettings,
  onRacesMenu,
  onOpenSection,
  onNotifications,
  onTheme,
  onDiagnostics,
  onBackSettings,
  onBackMore,
  onOpenRace,
}) {
  const pkg = app.currentPackage;

  if (tab === 'today') {
    return <TodayView app={app} onMap={onMap} onResults={onResults} onRaces={onRaces} />;
  }

  if (tab === 'results') {
    return (
      <section className="results-tab-screen">
        {app.packages?.length > 0 && pkg ? (
          <CrewResults
            pkg={pkg}
            open={crewResultsOpen}
            onOpen={onOpenCrewResults}
            onClose={onCloseCrewResults}
            standalone
          />
        ) : (
          <EmptyScreenState
            className="results-empty-state"
            description="Скачай Rally Pack в разделе управления гонками, чтобы открыть результаты."
            onAction={onOpenRaces}
          />
        )}
      </section>
    );
  }

  if (tab !== 'more') return null;

  if (moreScreen === 'settings') {
    return <SettingsView app={app} onBack={onBackSettings} onDiagnostics={onDiagnostics} />;
  }

  if (moreScreen === 'races') {
    return <RacesView app={app} onBack={onBackMore} onOpenRace={onOpenRace} />;
  }

  if (moreScreen !== 'menu') {
    return (
      <MoreSectionView
        sectionId={moreScreen}
        app={app}
        onBack={onBackMore}
        onOpenResults={onResults}
        onOpenDiagnostics={onDiagnostics}
      />
    );
  }

  return (
    <MoreMenu
      app={app}
      onSettings={onSettings}
      onRaces={onRacesMenu}
      onOpenSection={onOpenSection}
      onNotifications={onNotifications}
      onTheme={onTheme}
      onDiagnostics={onDiagnostics}
    />
  );
}
