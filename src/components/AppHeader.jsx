import React from 'react';
import packageMeta from '../../package.json';
import Badge from './Badge.jsx';
import './AppShell.css';

export default function AppHeader({ online, onLogoClick }) {
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
        <Badge id="networkBadge" variant={online ? 'online' : 'offline'}>
          {online ? 'онлайн' : 'офлайн'}
        </Badge>
      </div>
    </header>
  );
}
