// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MoreMenu from '../../src/components/MoreMenu.jsx';

describe('MoreMenu', () => {
  afterEach(cleanup);

  it('shows the active rally and routes rally sections through the shared callback', () => {
    const onOpenSection = vi.fn();
    render(
      <MoreMenu
        app={{ currentPackage: { name: 'Ралли Карелия', summary: { dates: '10–12 июня' } } }}
        onOpenSection={onOpenSection}
        onRaces={vi.fn()}
        onSettings={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Текущая гонка').textContent).toContain('Ралли Карелия');
    expect(screen.getByLabelText('Текущая гонка').textContent).toContain('10–12 июня');
    fireEvent.click(screen.getByRole('button', { name: 'Полное расписание' }));
    fireEvent.click(screen.getByRole('button', { name: 'Участники' }));
    fireEvent.click(screen.getByRole('button', { name: 'Документы и материалы' }));

    expect(onOpenSection.mock.calls).toEqual([['schedule'], ['participants'], ['documents']]);
  });

  it('keeps management destinations and disables rally-specific links without a rally', () => {
    const onRaces = vi.fn();
    const onSettings = vi.fn();
    render(<MoreMenu onRaces={onRaces} onSettings={onSettings} />);

    expect(screen.getByRole('button', { name: 'Информация о гонке' }).disabled).toBe(true);
    expect(screen.getByText('Выбери гонку в шапке, чтобы открыть её материалы.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Гонки и Rally Pack/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Настройки и диагностика' }));
    fireEvent.click(screen.getByRole('button', { name: 'Уведомления' }));

    expect(onRaces).toHaveBeenCalledOnce();
    expect(onSettings).toHaveBeenCalledTimes(2);
  });

  it('supports dedicated settings callbacks while retaining the existing settings fallback', () => {
    const onSettings = vi.fn();
    const onTheme = vi.fn();
    const onNotifications = vi.fn();
    const onDiagnostics = vi.fn();
    render(
      <MoreMenu
        app={{ currentPackage: { name: 'Северный лес' } }}
        onSettings={onSettings}
        onTheme={onTheme}
        onNotifications={onNotifications}
        onDiagnostics={onDiagnostics}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Тема оформления' }));
    fireEvent.click(screen.getByRole('button', { name: 'Уведомления' }));
    fireEvent.click(screen.getByRole('button', { name: 'Диагностика' }));
    expect(onTheme).toHaveBeenCalledOnce();
    expect(onNotifications).toHaveBeenCalledOnce();
    expect(onDiagnostics).toHaveBeenCalledOnce();
    expect(onSettings).not.toHaveBeenCalled();
  });
});
