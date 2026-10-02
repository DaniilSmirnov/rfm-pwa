import './SettingsView.css';
import React, { useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import { loadThemePreference, resolveTheme, saveThemePreference } from '../app/preferences.js';
import PushSettings from '../components/PushSettings.jsx';

export default function SettingsView({ app, onBack, onDiagnostics }) {
  const [theme, setTheme] = useState(
    () =>
      resolveTheme(
        loadThemePreference(),
        window.matchMedia?.('(prefers-color-scheme: dark)').matches,
      ),
  );
  useEffect(() => {
    const systemTheme = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!systemTheme?.addEventListener) return undefined;
    const updateTheme = event => {
      if (loadThemePreference() === null) setTheme(resolveTheme(null, event.matches));
    };
    systemTheme.addEventListener('change', updateTheme);
    return () => systemTheme.removeEventListener('change', updateTheme);
  }, []);
  const changeTheme = value => {
    setTheme(value);
    saveThemePreference(value);
  };
  return (
    <section id="settingsSection" className="settings-screen">
      <p className="muted small">Настройки приложения и диагностика.</p>
      <fieldset className="settings-group">
        <legend>Тема оформления</legend>
        <div className="theme-switch" role="group" aria-label="Тема оформления">
          <Button
            className={`theme-option${theme === 'light' ? ' selected' : ''}`}
            type="button"
            aria-pressed={theme === 'light'}
            onClick={() => changeTheme('light')}
          >
            ☀ Светлая
          </Button>
          <Button
            className={`theme-option${theme === 'dark' ? ' selected' : ''}`}
            type="button"
            aria-pressed={theme === 'dark'}
            onClick={() => changeTheme('dark')}
          >
            ☾ Тёмная
          </Button>
        </div>
        <p className="muted small">Выбор сохраняется на этом устройстве.</p>
      </fieldset>
      <PushSettings />
      <div className="settings-diagnostics">
        <strong>Состояние карты</strong>
        <p className="muted small">
          {app.mapDiag || 'Диагностика карты появится, когда откроешь карту.'}
        </p>
      </div>
      <Button className="button" type="button" onClick={onDiagnostics}>
        Открыть диагностику приложения
      </Button>
    </section>
  );
}
