// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BootDiagnostics from '../../src/modals/BootDiagnostics/BootDiagnostics.jsx';
import CrewResultsModal from '../../src/modals/CrewResultsModal/CrewResultsModal.jsx';
import ImageViewerModal from '../../src/modals/ImageViewerModal/ImageViewerModal.jsx';

vi.mock('../../src/app/boot-diagnostics.js', () => ({
  bootSnapshot: () => ({
    marks: [],
    meta: {
      online: true,
      displayMode: 'browser',
      navigationType: 'navigate',
      serviceWorkerControlled: false,
      domContentLoadedMs: 1,
      loadEventMs: 2,
      userAgent: 'test',
    },
    storage: null,
  }),
  collectStorageDiagnostics: vi.fn(async () => undefined),
  markBoot: vi.fn(),
}));
vi.mock('../../src/app/eruda.js', () => ({
  loadErudaVisibility: () => false,
  setErudaVisible: vi.fn(async () => undefined),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const crew = { id: 1, number: '11', pilot: { lastName: 'Alpha' }, car: 'Car A' };
const result = { crew, discipline: { name: 'A' }, time: 100, formattedTime: '00:01' };
const views = [{ key: 'overall', name: 'Общий итог', results: [result] }];

function renderCrew(overrides = {}) {
  return render(
    <CrewResultsModal
      open
      data={{ eventId: '55' }}
      views={views}
      activeView={views[0]}
      className=""
      onClassChange={vi.fn()}
      onStageChange={vi.fn()}
      classes={['A']}
      query=""
      onQueryChange={vi.fn()}
      visible={[result]}
      selectedClassResults={[result]}
      subscriptions={[]}
      onToggleSubscription={vi.fn()}
      resultLabel={() => 'Alpha / Co-driver'}
      subscriptionKey={() => '55:1'}
      onClose={vi.fn()}
      {...overrides}
    />,
  );
}

describe('Radix dialog migrations', () => {
  it('keeps crew results modal semantics, focuses search, and closes on Escape', async () => {
    const onClose = vi.fn();
    renderCrew({ onClose });

    expect(screen.getByRole('dialog', { name: 'Результаты экипажей' }).className).toContain(
      'crew-results-dialog',
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Поиск экипажа' })),
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes diagnostics through Radix outside interaction and Escape', () => {
    const onClose = vi.fn();
    render(<BootDiagnostics open onClose={onClose} />);
    const overlay = screen
      .getByRole('dialog', { name: 'Boot diagnostics' })
      .closest('#bootDiagnosticsModal');

    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole('dialog', { name: 'Boot diagnostics' }).getAttribute('aria-modal'),
    ).toBe('true');
  });

  it('retains image modal id/hidden contract and closes via close button', () => {
    const onClose = vi.fn();
    const { container, rerender } = render(<ImageViewerModal image="" onClose={onClose} />);
    expect(container.querySelector('#imageModal')).toHaveProperty('hidden', true);

    rerender(<ImageViewerModal image="/map.jpg" onClose={onClose} />);
    expect(container.querySelector('#imageModal')).toHaveProperty('hidden', false);
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
