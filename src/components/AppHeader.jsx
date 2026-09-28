import React from 'react';
import packageMeta from '../../package.json';
import './AppShell.css';

export default function AppHeader({online,installControl,onLogoClick}){
  return <header className="topbar">
    <div className="header-brand"><img id="headerLogo" className="header-logo" src={`/rfm/icon.png?v=${String(packageMeta.version).replace(/\D/g,'')}`} alt="" onClick={onLogoClick}/>
      <div><div className="brand-small">Rally Fans Map</div><h1>OFFLINE</h1></div>
    </div>
    <div className="top-actions">{installControl}<span id="networkBadge" className={`badge ${online?'online':'offline'}`}>{online?'онлайн':'офлайн'}</span></div>
  </header>;
}
