import React from 'react';
import {
  Bell,
  BookOpenText,
  CalendarDays,
  CarFront,
  CircleHelp,
  FileText,
  Gauge,
  MapPinned,
  Settings2,
  ShieldCheck,
  SunMoon,
} from 'lucide-react';
import Button from './Button.jsx';
import './MoreMenu.css';

const destinations = [
  {
    id: 'eventInfo',
    title: 'Информация о гонке',
    description: 'Организатор, место проведения, даты и детали этапа',
    Icon: MapPinned,
  },
  {
    id: 'schedule',
    title: 'Полное расписание',
    description: 'Все дни, спецучастки и события гонки',
    Icon: CalendarDays,
  },
  {
    id: 'participants',
    title: 'Участники',
    description: 'Заявленные экипажи и стартовые списки',
    Icon: CarFront,
  },
  {
    id: 'documents',
    title: 'Документы и материалы',
    description: 'Карты организатора, памятки и файлы гонки',
    Icon: FileText,
  },
  {
    id: 'safety',
    title: 'Безопасность',
    description: 'Правила поведения зрителей и памятка по безопасности',
    Icon: ShieldCheck,
  },
];

export default function MoreMenu({
  app,
  onSettings,
  onRaces,
  onOpenSection,
  onNotifications,
  onTheme,
  onDiagnostics,
}) {
  const pkg = app?.currentPackage;
  const summary = pkg?.summary || {};

  return (
    <section className="more-menu" aria-label="Дополнительные разделы">
      <header className="more-menu-heading">
        <div>
          <p className="more-menu-eyebrow">ЕЩЁ</p>
          <h2>Информация и управление</h2>
          <p className="more-menu-description">
            Материалы текущей гонки, Rally Pack и настройки приложения.
          </p>
        </div>
        {pkg && (
          <div className="more-current-race" aria-label="Текущая гонка">
            <span>ТЕКУЩАЯ ГОНКА</span>
            <strong>{pkg.name}</strong>
            {summary.dates && <small>{summary.dates}</small>}
          </div>
        )}
      </header>

      <section className="more-menu-group" aria-labelledby="more-race-title">
        <h3 id="more-race-title">Гонка</h3>
        <div className="more-menu-grid">
          {destinations.map(({ id, title, description, Icon }) => (
            <Button
              key={id}
              className="more-menu-row"
              type="button"
              onClick={() => onOpenSection?.(id)}
              aria-label={title}
              disabled={!pkg}
            >
              <Icon className="more-menu-icon" aria-hidden="true" size={20} />
              <span className="more-menu-copy">
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <span className="more-menu-chevron" aria-hidden="true">
                ›
              </span>
            </Button>
          ))}
        </div>
        {!pkg && (
          <p className="more-menu-empty">Выбери гонку в шапке, чтобы открыть её материалы.</p>
        )}
      </section>

      <section className="more-menu-group" aria-labelledby="more-manage-title">
        <h3 id="more-manage-title">Управление</h3>
        <div className="more-menu-grid more-menu-management">
          <Button className="more-menu-row" type="button" onClick={onRaces}>
            <BookOpenText className="more-menu-icon" aria-hidden="true" size={20} />
            <span className="more-menu-copy">
              <strong>Гонки и Rally Pack</strong>
              <small>Каталог, скачивание, обновление и хранение пакетов</small>
            </span>
            <span className="more-menu-chevron" aria-hidden="true">
              ›
            </span>
          </Button>
          <Button
            className="more-menu-row"
            type="button"
            aria-label="Уведомления"
            onClick={onNotifications || onSettings}
          >
            <Bell className="more-menu-icon" aria-hidden="true" size={20} />
            <span className="more-menu-copy">
              <strong>Уведомления</strong>
              <small>Напоминания о стартах и событиях гонки</small>
            </span>
            <span className="more-menu-chevron" aria-hidden="true">
              ›
            </span>
          </Button>
          <Button
            className="more-menu-row"
            type="button"
            aria-label="Тема оформления"
            onClick={onTheme || onSettings}
          >
            <SunMoon className="more-menu-icon" aria-hidden="true" size={20} />
            <span className="more-menu-copy">
              <strong>Тема оформления</strong>
              <small>Светлая или тёмная тема</small>
            </span>
            <span className="more-menu-chevron" aria-hidden="true">
              ›
            </span>
          </Button>
          <Button
            className="more-menu-row"
            type="button"
            aria-label="Настройки и диагностика"
            onClick={onSettings}
          >
            <Settings2 className="more-menu-icon" aria-hidden="true" size={20} />
            <span className="more-menu-copy">
              <strong>Настройки</strong>
              <small>Параметры приложения и состояние карты</small>
            </span>
            <span className="more-menu-chevron" aria-hidden="true">
              ›
            </span>
          </Button>
          <Button
            className="more-menu-row"
            type="button"
            aria-label="Диагностика"
            onClick={onDiagnostics || onSettings}
          >
            <Gauge className="more-menu-icon" aria-hidden="true" size={20} />
            <span className="more-menu-copy">
              <strong>Диагностика</strong>
              <small>Проверка запуска, хранилища и состояния приложения</small>
            </span>
            <CircleHelp className="more-menu-trailing" aria-hidden="true" size={17} />
          </Button>
        </div>
      </section>
    </section>
  );
}

export { destinations as moreRaceDestinations };
