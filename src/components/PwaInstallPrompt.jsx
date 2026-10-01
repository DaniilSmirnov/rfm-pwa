import './PwaInstallPrompt.css';
import React, { useEffect, useState } from 'react';
import packageMeta from '../../package.json';
import Button from './Button.jsx';
import { getPwaInstallSnapshot, requestPwaInstall, subscribePwaInstall } from '../app/pwa.js';

const description =
  'Чтобы пользоваться Rally Fans Map офлайн и быстро получать доступ к картам и результатам, установи приложение на устройство.';

export default function PwaInstallPrompt() {
  const [snapshot, setSnapshot] = useState(getPwaInstallSnapshot);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  useEffect(() => subscribePwaInstall(setSnapshot), []);

  useEffect(() => {
    document.documentElement.dataset.pwaInstalled = snapshot.installedLaunch ? 'true' : 'false';
    document.documentElement.dataset.pwaContext = snapshot.installedLaunch ? 'app' : 'browser';
  }, [snapshot.installedLaunch]);

  useEffect(() => {
    if (!snapshot.installedLaunch) {
      document.body.classList.add('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [snapshot.installedLaunch]);

  useEffect(() => {
    if (snapshot.promptAvailable) setInstructionsOpen(false);
  }, [snapshot.promptAvailable]);

  const activate = async () => {
    if (snapshot.promptAvailable) {
      const result = await requestPwaInstall({
        onInstructions: () => setInstructionsOpen(true),
      });
      if (result.instructions || result.choice?.outcome !== 'accepted') {
        setInstructionsOpen(true);
      }
      return;
    }
    setInstructionsOpen(value => !value);
  };

  const instructions = snapshot.instructions;
  const visible = !snapshot.installedLaunch;

  return (
    <section
      className="pwa-install-prompt"
      role="dialog"
      aria-label="Установка приложения"
      aria-modal="true"
      hidden={!visible}
      aria-live="polite"
    >
      <div className="pwa-install-screen">
        <div className="pwa-install-brand" aria-label="Rally Fans Map">
          <img
            className="pwa-install-logo"
            src={`/rfm/icon.png?v=${String(packageMeta.version).replace(/\D/g, '')}`}
            alt=""
            aria-hidden="true"
          />
          <span>RALLY FANS MAP</span>
        </div>

        <div className="pwa-install-content">
          <div className="pwa-install-copy">
            <h1>Установи приложение</h1>
            <p>{description}</p>
          </div>

          <Button className="button primary pwa-install-action" type="button" onClick={activate}>
            {instructions.action}
          </Button>

          {instructionsOpen && (
            <section className="pwa-install-help" aria-label={instructions.title}>
              <div className="pwa-install-help-icon" aria-hidden="true">
                i
              </div>
              <div>
                <h2>Как установить?</h2>
                <p>{instructions.text}</p>
                <ol className="pwa-install-steps">
                  {instructions.steps.map(step => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
