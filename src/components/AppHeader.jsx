import React from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import packageMeta from '../../package.json';
import SelectField from './SelectField.jsx';
import './AppShell.css';

export default function AppHeader({ onLogoClick, currentPackage, packages = [], onSelectRally }) {
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
        <span className="header-wordmark">RALLY FANS MAP</span>
      </div>
      <div className="top-actions">
        {packages.length > 0 && (
          <label className="current-rally-select">
            <MapPin aria-hidden="true" size={19} className="current-rally-pin" />
            <span className="current-rally-copy">
              <span className="sr-only">Текущая гонка</span>
              <strong>{currentPackage?.name || 'Выбрать гонку'}</strong>
              <small>{currentPackage?.summary?.dates || currentPackage?.dates || ''}</small>
            </span>
            <SelectField
              aria-label="Текущая гонка"
              className="current-rally-field"
              value={currentPackage?.id || ''}
              onChange={event => onSelectRally?.(event.target.value)}
            >
              {!currentPackage && <option value="">Выбрать гонку</option>}
              {packages.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name || `Гонка ${item.raceId || item.id}`}
                </option>
              ))}
            </SelectField>
            <ChevronDown aria-hidden="true" size={16} className="current-rally-chevron" />
          </label>
        )}
      </div>
    </header>
  );
}
