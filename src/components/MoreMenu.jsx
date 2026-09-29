import React from 'react';
import Button from './Button.jsx';
import './AppShell.css';

export default function MoreMenu({ onSettings, onRaces }) {
  return (
    <section className="more-menu">
      <Button className="more-menu-row" onClick={onRaces}>
        <strong>Гонки и Rally Pack</strong>
        <span>Каталог гонок, скачанные пакеты и управление хранением</span>
      </Button>
      <Button className="more-menu-row" onClick={onSettings}>
        <strong>Настройки и диагностика</strong>
        <span>Тема оформления, уведомления и состояние приложения</span>
      </Button>
    </section>
  );
}
