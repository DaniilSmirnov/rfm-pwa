import './AppTabBar.css';
import React from 'react';
import { CalendarDays, CircleEllipsis, Map, Trophy } from 'lucide-react';
import Button from '../Button/Button.jsx';

export const tabs = [
  { key: 'today', label: 'Сегодня', Icon: CalendarDays },
  { key: 'map', label: 'Карта', Icon: Map },
  { key: 'results', label: 'Результаты', Icon: Trophy },
  { key: 'more', label: 'Меню', Icon: CircleEllipsis },
];

export default function AppTabBar({ activeTab, onActivate }) {
  return (
    <nav className="bottom-tabbar app-tab-bar" aria-label="Основная навигация">
      {tabs.map(({ key, label, Icon }) => (
        <Button
          key={key}
          className={activeTab === key ? 'active' : ''}
          aria-current={activeTab === key ? 'page' : undefined}
          onClick={() => onActivate(key)}
        >
          <Icon aria-hidden="true" size={21} strokeWidth={activeTab === key ? 2.4 : 1.8} />
          <b>{label}</b>
        </Button>
      ))}
    </nav>
  );
}
