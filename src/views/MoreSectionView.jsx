import './MoreSectionView.css';
import React from 'react';
import Button from '../components/Button.jsx';
import EmptyState from '../components/EmptyState.jsx';
import RaceMedia from '../components/RaceMedia.jsx';
import SafetyMemo from '../components/SafetyMemo.jsx';
import ScheduleList from '../components/ScheduleList.jsx';
import { assetUrl } from '../rallyfans.js';

const sectionTitles = {
  eventInfo: 'Информация о гонке',
  schedule: 'Полное расписание',
  participants: 'Участники',
  documents: 'Документы и материалы',
  safety: 'Безопасность',
};

const valuesFor = (pkg, original) =>
  [
    ['Этап', [pkg?.summary?.category, pkg?.summary?.stage].filter(Boolean).join(' · ')],
    ['Даты', pkg?.summary?.dates],
    ['Место проведения', pkg?.summary?.city || original.city_race_details || original.city_race],
    ['Статус', pkg?.summary?.status],
    ['Организатор', original.organizer_name || original.organizer || original.organizer_race],
    ['Дистанция', pkg?.summary?.totalDistance],
    ['Боевые километры', pkg?.summary?.combatKm],
    ['Дней', pkg?.summary?.days],
    ['Сайт', original.website || original.site || original.url],
    ['Контакт', original.contact || original.phone || original.email],
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim());

function hasParticipantMaterials(race) {
  const oldLists = ['list_crews', 'list_crews2', 'list_crews3', 'list_crews4', 'list_crews5'];
  const oldPresent = oldLists.some(key => typeof race[key] === 'string' && race[key].trim());
  const newPresent = (
    Array.isArray(race.lists) ? race.lists : Object.values(race.lists || {})
  ).some(item => typeof item?.image === 'string' && item.image.trim());
  return oldPresent || newPresent;
}

function hasDocumentMaterials(pkg) {
  const original = pkg?.original || {};
  const asImages = value =>
    (Array.isArray(value) ? value : Object.values(value || {})).map(item =>
      typeof item === 'string' ? item : item?.image,
    );
  const legacyImages = keys =>
    keys.map(key => original[key]).filter(value => typeof value === 'string');
  const known = new Set([
    original.image,
    original.mapsimg,
    original.safety_leaflet,
    ...asImages(original.lists),
    ...asImages(original.results),
    ...legacyImages(['list_crews', 'list_crews2', 'list_crews3', 'list_crews4', 'list_crews5']),
    ...legacyImages([
      'results_race',
      'results_race2',
      'results_race3',
      'results_race4',
      'results_race5',
    ]),
  ]);
  return Boolean(
    original.mapsimg ||
      original.how_it_was ||
      (pkg?.assetNames || []).some(name => name && !known.has(name) && name !== 'name-pin.jpg'),
  );
}

export default function MoreSectionView({ sectionId, app, onBack, onOpenResults }) {
  const pkg = app?.currentPackage;
  const original = pkg?.original || {};
  const title = sectionTitles[sectionId];

  return (
    <section className="more-section-view" aria-label={title || 'Раздел гонки'}>
      <header className="more-section-header">
        <Button className="button compact" type="button" onClick={onBack}>
          ← Ещё
        </Button>
        <div>
          <p className="more-section-kicker">{pkg?.name || 'Текущая гонка'}</p>
          <h2>{title || 'Раздел гонки'}</h2>
        </div>
      </header>

      {!pkg ? (
        <EmptyState>Сначала выбери гонку в шапке, чтобы открыть её разделы.</EmptyState>
      ) : sectionId === 'eventInfo' ? (
        <section className="more-event-info" aria-label="Сведения о гонке">
          {original.image && (
            <img className="more-event-image" src={assetUrl(original.image)} alt="" />
          )}
          {valuesFor(pkg, original).length ? (
            <dl className="more-event-facts">
              {valuesFor(pkg, original).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <EmptyState>В Rally Pack пока нет дополнительной информации об этой гонке.</EmptyState>
          )}
          {original.description && <p className="more-event-description">{original.description}</p>}
        </section>
      ) : sectionId === 'schedule' ? (
        <section aria-label="Расписание гонки">
          <ScheduleList pkg={pkg} />
        </section>
      ) : sectionId === 'participants' ? (
        <section className="more-section-content" aria-label="Список участников">
          {hasParticipantMaterials(original) ? (
            <RaceMedia pkg={pkg} sections={['participants']} />
          ) : (
            <EmptyState>Список участников ещё не добавлен в Rally Pack этой гонки.</EmptyState>
          )}
          {pkg.crewResults?.eventResults?.length > 0 && (
            <div className="more-results-link">
              <p>Для этой гонки сохранены результаты экипажей.</p>
              <Button className="button primary" type="button" onClick={onOpenResults}>
                Открыть результаты экипажей
              </Button>
            </div>
          )}
        </section>
      ) : sectionId === 'documents' ? (
        <section className="more-section-content" aria-label="Документы гонки">
          {hasDocumentMaterials(pkg) ? (
            <RaceMedia pkg={pkg} sections={['map', 'documents', 'history']} />
          ) : (
            <EmptyState>
              Организатор пока не добавил документы и дополнительные материалы.
            </EmptyState>
          )}
        </section>
      ) : sectionId === 'safety' ? (
        <section className="more-section-content" aria-label="Памятка по безопасности">
          <SafetyMemo />
          {original.safety_leaflet ? (
            <RaceMedia pkg={pkg} sections={['safety']} />
          ) : (
            <EmptyState>
              Отдельная памятка организатора не приложена. Общие правила безопасности доступны выше.
            </EmptyState>
          )}
        </section>
      ) : (
        <EmptyState>Этот раздел недоступен для выбранной гонки.</EmptyState>
      )}
    </section>
  );
}

export { sectionTitles as moreSectionTitles };
