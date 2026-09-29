import React from 'react';
import packageMeta from '../../package.json';
import Badge from './Badge.jsx';
import './AppShell.css';

export default function AppHeader({
  online,
  onLogoClick,
  currentPackage,
  packages = [],
  onSelectRally,
}) {
  return (
    <header className="topbar">
      <div className="header-brand">
        <img
          id="headerLogo"
          className="header-logo"
          src={`/rfm/icon.png?v=${String(packageMeta.version).replace(/\D/g, '')}`}
          alt=""
          onClick={onLogoClick}
        />
        <div>
          <div className="brand-small">Rally Fans Map</div>
          <h1>OFFLINE</h1>
        </div>
      </div>
      <div className="top-actions">
        {packages.length > 0 && (
          <label className="current-rally-select">
            <span className="sr-only">Текущая гонка</span>
            <select
              aria-label="Текущая гонка"
              value={currentPackage?.id || ''}
              onChange={event => onSelectRally?.(event.target.value)}
            >
              {!currentPackage && <option value="">Выбрать гонку</option>}
              {packages.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name || `Гонка ${item.raceId || item.id}`}
                </option>
              ))}
            </select>
          </label>
        )}
        <Badge id="networkBadge" variant={online ? 'online' : 'offline'}>
          {online ? 'онлайн' : 'офлайн'}
        </Badge>
      </div>
    </header>
  );
}
