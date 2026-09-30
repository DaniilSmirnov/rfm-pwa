// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CrewResultsModal from '../../src/modals/CrewResultsModal.jsx';

afterEach(cleanup);

const crew1 = { id: 1, number: '11', pilot: { lastName: 'Alpha' }, car: 'Car A' };
const crew2 = { id: 2, number: '22', pilot: { lastName: 'Bravo' }, car: 'Car B' };
const makeResult = (crew, time, formattedTime = time) => ({
  crew,
  discipline: { name: 'A' },
  time,
  formattedTime,
});
const data = { eventId: '55' };
const overall = [makeResult(crew1, 100, '00:01'), makeResult(crew2, 200, '00:02')];
const views = [
  { key: 'overall', name: 'Общий итог', results: overall },
  {
    key: '0',
    name: 'СУ 1',
    results: [makeResult(crew1, 50, '00:00:50'), makeResult(crew2, 100, '00:01:40')],
  },
];

function renderResults(overrides = {}) {
  return render(
    <CrewResultsModal
      open={false}
      standalone
      onClose={vi.fn()}
      data={data}
      views={views}
      activeView={views[0]}
      className=""
      onClassChange={vi.fn()}
      onStageChange={vi.fn()}
      classes={['A']}
      query=""
      onQueryChange={vi.fn()}
      visible={overall}
      selectedClassResults={overall}
      subscriptions={[]}
      onToggleSubscription={vi.fn()}
      resultLabel={result => `${result.crew.pilot.lastName} / Co-driver`}
      subscriptionKey={(raceId, crewId) => `${raceId}:${crewId}`}
      {...overrides}
    />,
  );
}

describe('inline results screen', () => {
  it('renders as a first-class inline screen with class chips and search without a filter button', () => {
    renderResults();
    expect(screen.getByRole('region', { name: 'Результаты экипажей' })).toBeTruthy();
    expect(screen.getByLabelText('Класс')).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Поиск экипажа' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Фильтры' })).toBeNull();
  });

  it('prioritizes followed crews without changing their protocol places', () => {
    renderResults({ subscriptions: [{ crewId: '2', key: '55:2' }] });
    const cards = screen.getAllByRole('article');
    expect(within(cards[0]).getByText('№22 Bravo / Co-driver')).toBeTruthy();
    expect(within(cards[0]).getByText('2')).toBeTruthy();
    expect(within(cards[1]).getByText('№11 Alpha / Co-driver')).toBeTruthy();
    expect(within(cards[1]).getByText('1')).toBeTruthy();
  });

  it('opens all stage results in the crew details modal', () => {
    renderResults();
    fireEvent.click(screen.getByRole('button', { name: /Открыть результаты экипажа Alpha/ }));
    expect(screen.getByRole('dialog', { name: 'Детали экипажа' })).toBeTruthy();
    expect(screen.getByText('СУ 1')).toBeTruthy();
    expect(screen.getByText('00:00:50')).toBeTruthy();
  });

  it('shows unrun stages instead of NaN after retirement', () => {
    const retired = { ...overall[0], goingOff: true, reasonGoingOff: 'Поломка' };
    const retiredStage = { ...views[1].results[0], goingOff: true, reasonGoingOff: 'Поломка' };
    const retiredViews = [
      views[0],
      { ...views[1], results: [retiredStage, views[1].results[1]] },
      { key: '1', name: 'СУ 2', results: [views[1].results[1]] },
    ];
    renderResults({
      visible: [retired],
      selectedClassResults: [retired],
      views: retiredViews,
    });

    fireEvent.click(screen.getByRole('button', { name: /Открыть результаты экипажа Alpha/ }));
    const dialog = screen.getByRole('dialog', { name: 'Детали экипажа' });
    expect(within(dialog).getAllByText('Не пройден')).toHaveLength(2);
    expect(within(dialog).queryByText(/NaN/)).toBeNull();
  });

  it('shows retirement reason and stage while keeping the normal card layout', () => {
    const retired = { ...overall[0], goingOff: true, reasonGoingOff: 'Поломка' };
    const retiredStage = { ...views[1].results[0], goingOff: true, reasonGoingOff: 'Поломка' };
    const retiredViews = [views[0], { ...views[1], results: [retiredStage, views[1].results[1]] }];
    renderResults({
      visible: [retired],
      selectedClassResults: [retired],
      views: retiredViews,
    });
    const card = screen.getByRole('article');
    expect(within(card).getByText('1')).toBeTruthy();
    expect(within(card).getByText('Поломка')).toBeTruthy();
    expect(within(card).getByText('СУ 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Открыть результаты экипажа Alpha/ }));
    expect(screen.getByRole('dialog', { name: 'Детали экипажа' })).toBeTruthy();
    expect(
      within(screen.getByRole('dialog', { name: 'Детали экипажа' })).getByText('Поломка'),
    ).toBeTruthy();
  });
});
