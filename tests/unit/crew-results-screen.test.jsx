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
    expect(screen.getByLabelText('Спецучасток')).toBeTruthy();
    expect(screen.getByLabelText('Класс')).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Поиск экипажа' })).toBeTruthy();
  });

  it('prioritizes followed crews without changing their protocol places', () => {
    renderResults({ subscriptions: [{ crewId: '2', key: '55:2' }] });
    const rows = screen.getAllByRole('row').filter(row => row.hasAttribute('data-crew-row'));
    expect(within(rows[0]).getByText('Bravo / Co-driver')).toBeTruthy();
    expect(within(rows[0]).getByText('2')).toBeTruthy();
    expect(within(rows[1]).getByText('Alpha / Co-driver')).toBeTruthy();
    expect(within(rows[1]).getByText('1')).toBeTruthy();
    expect(screen.getByText(/Место в протоколе не меняется/)).toBeTruthy();
  });

  it('shows the selected crew stage by stage when expanded', () => {
    renderResults();
    fireEvent.click(screen.getAllByRole('button', { name: 'По СУ' })[0]);
    const details = document.querySelector('[data-crew-details="1"]');
    expect(details).toBeTruthy();
    expect(within(details).getByText(/СУ 1 · место 1/)).toBeTruthy();
    expect(within(details).getByText(/СУ 1 · место 1/)).toBeTruthy();
    expect(within(details).getByText('00:00:50')).toBeTruthy();
    expect(within(details).getByText('От лидера: лидер')).toBeTruthy();
    expect(
      within(screen.getAllByRole('row').find(row => row.hasAttribute('data-crew-row'))).getByText(
        'От лидера: лидер',
      ),
    ).toBeTruthy();
  });
});
