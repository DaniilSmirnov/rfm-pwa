import React from 'react';

export default function PwaInstallPrompt(){
  return <section id="pwaInstallPrompt" className="pwa-install-prompt" hidden aria-live="polite">
    <div className="pwa-install-copy">
      <div className="eyebrow">УСТАНОВКА PWA</div>
      <strong id="pwaInstallTitle">Установи Rally Fans Map Offline</strong>
      <p id="pwaInstallText">Сейчас приложение открыто в браузере. Для офлайн-режима, push-уведомлений и корректной работы iOS открой его как установленное PWA.</p>
      <ol id="pwaInstallSteps" className="pwa-install-steps" hidden></ol>
    </div>
    <button id="pwaInstallAction" className="button primary" type="button">Установить приложение</button>
  </section>;
}
