import './PwaInstallPrompt.css';
import React, { useEffect, useState } from 'react';
import { getPwaInstallSnapshot, requestPwaInstall, subscribePwaInstall } from '../app/pwa.js';
export default function PwaInstallPrompt({active = true}) {
  const [snapshot, setSnapshot] = useState(getPwaInstallSnapshot);
  const [expanded, setExpanded] = useState(true);
  const [helpRequested, setHelpRequested] = useState(false);
  useEffect(() => subscribePwaInstall(setSnapshot), []);
  useEffect(() => {
    document.documentElement.dataset.pwaInstalled = snapshot.installedLaunch ? 'true' : 'false';
    document.documentElement.dataset.pwaContext = snapshot.installedLaunch ? 'app' : 'browser';
  }, [snapshot.installedLaunch]);
  useEffect(() => {
    const show = () => {
      setExpanded(true);
      setHelpRequested(true);
    };
    window.addEventListener('rfm:pwa-install-help', show);
    return () => window.removeEventListener('rfm:pwa-install-help', show);
  }, []);
  const visible = !snapshot.installedLaunch;
  const activate = async () => {
    if (snapshot.promptAvailable) {
      await requestPwaInstall();
      return;
    }
    setExpanded(value => !value);
  };
  const instructions = snapshot.instructions;
  return <section className="pwa-install-prompt" role="region" aria-label="Установка PWA" hidden={!visible || !(active || helpRequested) || !expanded} aria-live="polite">
    <div className="pwa-install-copy">
      <div className="eyebrow">УСТАНОВКА PWA</div>
      <strong>{instructions.title}</strong>
      <p>{instructions.text}</p>
      {instructions.steps.length > 0 && <ol className="pwa-install-steps">{instructions.steps.map(step => <li key={step}>{step}</li>)}</ol>}
    </div>
    <button className="button primary" type="button" onClick={activate}>{instructions.action}</button>
    </section>;
}
