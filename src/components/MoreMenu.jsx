import React from 'react';
import Button from './Button.jsx';
import './AppShell.css';

export default function MoreMenu({ onSettings }) {
  return (
    <section className="more-menu">
      <Button className="more-menu-row" onClick={onSettings}>
        <strong>Настройки и диагностика</strong>
        <span>Тема оформления, уведомления и состояние приложения</span>
      </Button>
    </section>
  );
}
