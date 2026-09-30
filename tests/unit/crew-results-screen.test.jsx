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
  it('renders as a first-class inline screen with stage, class and search controls', () => {
    renderResults();
    expect(screen.getByRole('region', { name: 'Результаты экипажей' })).toBeTruthy();
    expect(screen.getByLabelText('Класс')).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Поиск экипажа' })).toBeTruthy();
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
    const card = screen.getByRole('button', { name: /Открыть результаты экипажа Alpha/ });
    expect(card).toBeTruthy();
    expect(screen.getByRole('button', { name: /Следить за экипажем: Alpha/ })).toBeTruthy();
    fireEvent.click(card);
    const dialog = screen.getByRole('dialog', { name: 'Детали экипажа' });
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('data-state')).toBe('open');
    expect(within(dialog).getByRole('heading', { name: 'Детали экипажа' })).toBeTruthy();
    expect(screen.getByText('СУ 1')).toBeTruthy();
    expect(screen.getByText('00:00:50')).toBeTruthy();
  });

  it('shows a retirement status in the card and in the details modal', () => {
    const retired = { ...overall[0], goingOff: true, reasonGoingOff: 'Поломка' };
    renderResults({ visible: [retired], selectedClassResults: [retired] });
    expect(screen.getAllByText('Поломка')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Открыть результаты экипажа Alpha/ }));
    expect(screen.getByRole('dialog', { name: 'Детали экипажа' })).toBeTruthy();
    expect(
      within(screen.getByRole('dialog', { name: 'Детали экипажа' })).getByText('Поломка'),
    ).toBeTruthy();
  });

  it('removes crew names and stage number from the retirement reason everywhere', () => {
    const retiredCrew = {
      ...crew1,
      pilot: { firstName: 'Иван', lastName: 'Alpha' },
      navigator: { firstName: 'Co-driver', lastName: 'Петров' },
    };
    const retired = {
      ...overall[0],
      crew: retiredCrew,
      goingOff: true,
      reasonGoingOff: 'Alpha Иван / Co-driver Петров / СУ 5 СХОД С ТРАССЫ',
    };
    const retiredStage = {
      ...makeResult(retiredCrew, 0),
      goingOff: true,
      reasonGoingOff: retired.reasonGoingOff,
    };

    renderResults({
      visible: [retired],
      selectedClassResults: [retired],
      views: [views[0], { ...views[1], results: [retiredStage] }],
      resultLabel: result => `${result.crew.pilot.lastName} / Co-driver`,
    });

    expect(screen.getAllByText('Сход с трассы')).toHaveLength(2);
    expect(screen.queryByText(/Alpha Иван|Co-driver Петров|СУ 5/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Открыть результаты экипажа Alpha/ }));
    expect(
      within(screen.getByRole('dialog', { name: 'Детали экипажа' })).getAllByText('Сход с трассы'),
    ).toHaveLength(3);
  });
});
