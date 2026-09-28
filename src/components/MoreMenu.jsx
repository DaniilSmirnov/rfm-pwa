import React from 'react';
import Button from './Button.jsx';
import './AppShell.css';

export default function MoreMenu({ onSettings }) {
  const go = id =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <section className="more-menu">
      <Button className="more-menu-row" onClick={() => go('catalogSection')}>
        <strong>Мои гонки</strong>
        <span>Каталог и сохранённые Rally Pack</span>
      </Button>
      <Button className="more-menu-row" onClick={onSettings}>
        <strong>Настройки и диагностика</strong>
        <span>Настройки приложения и состояние диагностики</span>
      </Button>
    </section>
  );
}
