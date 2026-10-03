// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MoreSectionView from '../../src/views/MoreSectionView/MoreSectionView.jsx';

afterEach(cleanup);

describe('MoreSectionView', () => {
  it('renders rally information from saved RaceDetails package metadata', () => {
    render(
      <MoreSectionView
        sectionId="eventInfo"
        app={{
          currentPackage: {
            name: 'Ралли Карелия',
            summary: { category: 'Ралли', stage: 'Этап 3', dates: '10–12 июня', city: 'Сортавала' },
            original: { organizer_name: 'Организатор' },
          },
        }}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: 'Информация о гонке' })).toBeTruthy();
    expect(screen.getByText('Ралли · Этап 3')).toBeTruthy();
    expect(screen.getByText('10–12 июня')).toBeTruthy();
    expect(screen.getByText('Сортавала')).toBeTruthy();
    expect(screen.getAllByText('Организатор').length).toBe(2);
  });

  it('shows full schedule using ScheduleList and its explicit empty state', () => {
    const { rerender } = render(
      <MoreSectionView
        sectionId="schedule"
        app={{ currentPackage: { name: 'Ладога', original: { schedule: [] } } }}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('Расписание отсутствует.')).toBeTruthy();

    rerender(
      <MoreSectionView
        sectionId="schedule"
        app={{
          currentPackage: {
            name: 'Ладога',
            original: {
              schedule: [
                { date: '10 июня', location: 'СУ 1', events: [{ time: '10:15', text: 'Старт' }] },
              ],
            },
          },
        }}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('СУ 1')).toBeTruthy();
    expect(screen.getByText('Старт')).toBeTruthy();
  });

  it('uses RaceMedia for available participants and exposes the Results tab action', () => {
    const onOpenResults = vi.fn();
    render(
      <MoreSectionView
        sectionId="participants"
        app={{
          currentPackage: {
            name: 'Карелия',
            original: { list_crews: 'entries.jpg' },
            assetNames: ['entries.jpg'],
            crewResults: { eventResults: [{ name: 'cached' }] },
          },
        }}
        onBack={vi.fn()}
        onOpenResults={onOpenResults}
      />,
    );

    expect(screen.getByText('ЗАЯВЛЕННЫЕ ЭКИПАЖИ')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Открыть результаты экипажей' }));
    expect(onOpenResults).toHaveBeenCalledOnce();
  });

  it('shows SafetyMemo and RallyMedia safety leaflet when available', () => {
    render(
      <MoreSectionView
        sectionId="safety"
        app={{
          currentPackage: {
            name: 'Карелия',
            original: { safety_leaflet: 'safety.jpg' },
            assetNames: ['safety.jpg'],
          },
        }}
      />,
    );

    expect(screen.getByRole('region', { name: 'Памятка по безопасности' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Главное' })).toBeTruthy();
    expect(screen.getByText('ПАМЯТКА ПО БЕЗОПАСНОСТИ')).toBeTruthy();
  });

  it('gives a direct empty state when a rally has no documents or no selection', () => {
    const { rerender } = render(
      <MoreSectionView
        sectionId="documents"
        app={{ currentPackage: { name: 'Карелия', original: {} } }}
        onBack={vi.fn()}
      />,
    );
    expect(
      screen.getByText('Организатор пока не добавил документы и дополнительные материалы.'),
    ).toBeTruthy();

    rerender(
      <MoreSectionView sectionId="eventInfo" app={{ currentPackage: null }} onBack={vi.fn()} />,
    );
    expect(
      screen.getByText('Сначала выбери гонку в шапке, чтобы открыть её разделы.'),
    ).toBeTruthy();
  });

  it('shows an overlap schedule in Documents even when it is the only material', () => {
    render(
      <MoreSectionView
        sectionId="documents"
        app={{
          currentPackage: {
            name: 'Карелия',
            original: { overlap_schedule: 'overlap.jpg' },
            assetNames: ['overlap.jpg'],
          },
        }}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText('СХЕМА ПЕРЕКРЫТИЯ ТРАССЫ')).toBeTruthy();
  });
});
