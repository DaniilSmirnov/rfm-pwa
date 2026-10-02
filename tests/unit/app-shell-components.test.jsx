// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AppTabBar from '../../src/components/AppTabBar/AppTabBar.jsx';
import AppScreens, { getScreenHeaderTitle } from '../../src/views/AppScreens/AppScreens.jsx';
import TodayScreen from '../../src/views/TodayScreen/TodayScreen.jsx';
import ResultsScreen from '../../src/views/ResultsScreen/ResultsScreen.jsx';
import MoreScreen from '../../src/views/MoreScreen/MoreScreen.jsx';

vi.mock('../../src/views/TodayView/TodayView.jsx', () => ({ default: () => <div>today view</div> }));
vi.mock('../../src/views/TodayScreen/TodayScreen.jsx', async () => {
  const actual = await vi.importActual('../../src/views/TodayScreen/TodayScreen.jsx');
  return actual;
});
vi.mock('../../src/views/SettingsView/SettingsView.jsx', () => ({ default: () => <div>settings screen</div> }));
vi.mock('../../src/views/RacesView/RacesView.jsx', () => ({ default: () => <div>races screen</div> }));
vi.mock('../../src/views/MoreSectionView/MoreSectionView.jsx', () => ({
  default: ({ sectionId }) => <div>{sectionId} screen</div>,
  moreSectionTitles: { schedule: 'Расписание' },
}));
vi.mock('../../src/components/MoreMenu/MoreMenu.jsx', () => ({ default: () => <div>menu screen</div> }));
vi.mock('../../src/components/CrewResults/CrewResults.jsx', () => ({
  default: () => <div>results screen</div>,
}));
vi.mock('../../src/components/EmptyScreenState/EmptyScreenState.jsx', () => ({
  default: ({ onAction }) => <button onClick={onAction}>open races</button>,
}));

afterEach(cleanup);

const app = { currentPackage: { id: 'race-1' }, packages: [{ id: 'race-1' }] };
const callbacks = {
  onMap: vi.fn(),
  onResults: vi.fn(),
  onRaces: vi.fn(),
  onOpenRaces: vi.fn(),
  onOpenCrewResults: vi.fn(),
  onCloseCrewResults: vi.fn(),
  onSettings: vi.fn(),
  onRacesMenu: vi.fn(),
  onOpenSection: vi.fn(),
  onNotifications: vi.fn(),
  onTheme: vi.fn(),
  onDiagnostics: vi.fn(),
  onBackSettings: vi.fn(),
  onBackMore: vi.fn(),
  onOpenRace: vi.fn(),
};

describe('AppTabBar', () => {
  it('renders all tabs and marks the active tab', () => {
    const onActivate = vi.fn();
    render(<AppTabBar activeTab="map" onActivate={onActivate} />);
    expect(screen.getByRole('navigation', { name: 'Основная навигация' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Карта/ }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: /Результаты/ }));
    expect(onActivate).toHaveBeenCalledWith('results');
  });
});

describe('AppScreens', () => {
  it('keeps screen header titles isolated from rendering', () => {
    expect(getScreenHeaderTitle('today', 'menu')).toBeNull();
    expect(getScreenHeaderTitle('more', 'settings')).toBe('Настройки и диагностика');
    expect(getScreenHeaderTitle('more', 'schedule')).toBe('Расписание');
    expect(getScreenHeaderTitle('more', 'unknown')).toBe('Раздел гонки');
  });

  it('renders every top-level and nested screen through the screen component', () => {
    const { rerender } = render(
      <AppScreens app={app} tab="today" moreScreen="menu" {...callbacks} />,
    );
    expect(screen.getByText('today view')).toBeTruthy();

    rerender(<AppScreens app={app} tab="results" moreScreen="menu" {...callbacks} />);
    expect(screen.getByText('results screen')).toBeTruthy();

    rerender(<AppScreens app={app} tab="more" moreScreen="settings" {...callbacks} />);
    expect(screen.getByText('settings screen')).toBeTruthy();

    rerender(<AppScreens app={app} tab="more" moreScreen="races" {...callbacks} />);
    expect(screen.getByText('races screen')).toBeTruthy();

    rerender(<AppScreens app={app} tab="more" moreScreen="schedule" {...callbacks} />);
    expect(screen.getByText('schedule screen')).toBeTruthy();

    rerender(<AppScreens app={app} tab="more" moreScreen="menu" {...callbacks} />);
    expect(screen.getByText('menu screen')).toBeTruthy();

    rerender(
      <AppScreens
        app={{ packages: [], currentPackage: null }}
        tab="results"
        moreScreen="menu"
        {...callbacks}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'open races' }));
    expect(callbacks.onOpenRaces).toHaveBeenCalled();
  });

  it('returns no content for the map tab', () => {
    const { container } = render(
      <AppScreens app={app} tab="map" moreScreen="menu" {...callbacks} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('composed screen components', () => {
  it('renders the dedicated today screen', () => {
    render(<TodayScreen app={app} onMap={vi.fn()} onResults={vi.fn()} onRaces={vi.fn()} />);
    expect(screen.getByText('today view')).toBeTruthy();
  });

  it('renders downloaded and empty result states', () => {
    const { rerender } = render(
      <ResultsScreen
        app={app}
        crewResultsOpen={false}
        onOpenCrewResults={vi.fn()}
        onCloseCrewResults={vi.fn()}
        onOpenRaces={vi.fn()}
      />,
    );
    expect(screen.getByText('results screen')).toBeTruthy();
    const onOpenRaces = vi.fn();
    rerender(
      <ResultsScreen
        app={{ packages: [], currentPackage: null }}
        crewResultsOpen={false}
        onOpenCrewResults={vi.fn()}
        onCloseCrewResults={vi.fn()}
        onOpenRaces={onOpenRaces}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'open races' }));
    expect(onOpenRaces).toHaveBeenCalledOnce();
  });

  it('renders each more screen branch', () => {
    const { rerender } = render(<MoreScreen moreScreen="settings" app={app} {...callbacks} />);
    expect(screen.getByText('settings screen')).toBeTruthy();
    rerender(<MoreScreen moreScreen="races" app={app} {...callbacks} />);
    expect(screen.getByText('races screen')).toBeTruthy();
    rerender(<MoreScreen moreScreen="schedule" app={app} {...callbacks} />);
    expect(screen.getByText('schedule screen')).toBeTruthy();
    rerender(<MoreScreen moreScreen="menu" app={app} {...callbacks} />);
    expect(screen.getByText('menu screen')).toBeTruthy();
  });
});
