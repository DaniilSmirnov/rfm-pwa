import React from 'react';
import packageMeta from '../../package.json';
import releaseMeta from '../../version.json';
import './AppShell.css';

export default function AppFooter(){
  return <footer className="app-footer"><div className="brand-small">Rally Fans Map</div><div>Companion v{packageMeta.version} · {releaseMeta.codename}</div></footer>;
}
