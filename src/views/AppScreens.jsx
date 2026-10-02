import './AppScreens.css';
import React from 'react';
import TodayScreen from './TodayScreen.jsx';
import ResultsScreen from './ResultsScreen.jsx';
import MoreScreen, { moreSectionTitles } from './MoreScreen.jsx';

export function getScreenHeaderTitle(tab, moreScreen) {
  if (tab !== 'more' || moreScreen === 'menu') return null;
  return {
    races: 'Управление гонками',
    settings: 'Настройки и диагностика',
    ...moreSectionTitles,
  }[moreScreen] || 'Раздел гонки';
}

export default function AppScreens(props) {
  const { tab, moreScreen } = props;
  if (!['today', 'results', 'more'].includes(tab)) return null;
  return (
    <div className="app-screens">
      {tab === 'today' && <TodayScreen {...props} />}
      {tab === 'results' && <ResultsScreen {...props} />}
      {tab === 'more' && <MoreScreen moreScreen={moreScreen} {...props} />}
    </div>
  );
}
