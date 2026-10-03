import './MoreScreen.css';
import React from 'react';
import SettingsView from '../SettingsView/SettingsView.jsx';
import RacesView from '../RacesView/RacesView.jsx';
import MoreSectionView from '../MoreSectionView/MoreSectionView.jsx';
import MoreMenu from '../../components/MoreMenu/MoreMenu.jsx';

export const moreSectionTitles = {
  schedule: 'Расписание',
  participants: 'Участники',
  documents: 'Документы и материалы',
  safety: 'Правила и рекомендации',
  history: 'История гонки',
};

export default function MoreScreen({
  app,
  moreScreen,
  onResults,
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
  if (moreScreen === 'settings') {
    return (
      <div className="app-screen-more">
        <SettingsView app={app} onBack={onBackSettings} onDiagnostics={onDiagnostics} />
      </div>
    );
  }

  if (moreScreen === 'races') {
    return (
      <div className="app-screen-more">
        <RacesView app={app} onBack={onBackMore} onOpenRace={onOpenRace} />
      </div>
    );
  }

  if (moreScreen !== 'menu') {
    return (
      <div className="app-screen-more">
        <MoreSectionView
          sectionId={moreScreen}
          app={app}
          onBack={onBackMore}
          onOpenResults={onResults}
          onOpenDiagnostics={onDiagnostics}
        />
      </div>
    );
  }

  return (
    <div className="app-screen-more">
      <MoreMenu
        app={app}
        onSettings={onSettings}
        onRaces={onRacesMenu}
        onOpenSection={onOpenSection}
        onNotifications={onNotifications}
        onTheme={onTheme}
        onDiagnostics={onDiagnostics}
      />
    </div>
  );
}
