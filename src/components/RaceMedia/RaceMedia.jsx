import './RaceMedia.css';
import React, { useEffect, useState } from 'react';
import Button from '../Button/Button.jsx';
import { assetUrl } from '../../rallyfans.js';
import { sanitizeRichHtml } from '../../app/sanitize.js';
import { raceHasFinished } from '../../app/today-summary.js';
import ImageViewerModal from '../../modals/ImageViewerModal/ImageViewerModal.jsx';
import CollapsibleSection from '../CollapsibleSection/CollapsibleSection.jsx';

const asArray = value =>
  Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
const legacyImages = (object, keys) =>
  keys.map(key => object?.[key]).filter(value => typeof value === 'string' && value.trim());
const modernImages = items =>
  asArray(items)
    .map(item => item?.image)
    .filter(value => typeof value === 'string' && value.trim());
const unique = values => [...new Set(values)];

function MediaSection({ title, images, emptyText = 'Информация появится позже :)', onOpen }) {
  const list = unique(images);
  return (
    <CollapsibleSection
      className="race-material"
      summary={
        <>
          <span className="block-title">{title}</span>
          <span className="summary-meta">{list.length ? ` · ${list.length}` : ''}</span>
          <span className="summary-chevron">⌄</span>
        </>
      }
    >
      {list.length ? (
        <div className="media-strip">
          {list.map((name, index) => (
            <Button
              key={`${name}-${index}`}
              className="media-card"
              data-media-name={name}
              type="button"
              aria-label={`Открыть ${title} ${index + 1}`}
              onClick={() => onOpen(name)}
            >
              <img loading="lazy" src={assetUrl(name)} alt={title} />
            </Button>
          ))}
        </div>
      ) : (
        <p className="gray-label">{emptyText}</p>
      )}
    </CollapsibleSection>
  );
}

export default function RaceMedia({ pkg, sections = null }) {
  const [selectedImage, setSelectedImage] = useState('');
  useEffect(() => {
    if (!selectedImage) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') setSelectedImage('');
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selectedImage]);
  if (!pkg) return null;
  const race = pkg.original || {};
  const crews = [
    ...modernImages(race.lists),
    ...legacyImages(race, [
      'list_crews',
      'list_crews2',
      'list_crews3',
      'list_crews4',
      'list_crews5',
    ]),
  ];
  const results = [
    ...modernImages(race.results),
    ...legacyImages(race, [
      'results_race',
      'results_race2',
      'results_race3',
      'results_race4',
      'results_race5',
    ]),
  ];
  const known = new Set(
    [
      race.image,
      race.mapsimg,
      race.safety_leaflet,
      race.overlap_schedule,
      ...crews,
      ...results,
    ].filter(Boolean),
  );
  const extra = (pkg.assetNames || []).filter(name => !known.has(name) && name !== 'name-pin.jpg');
  const finished = raceHasFinished(pkg);
  const open = name => setSelectedImage(name);
  const include = name => !sections || sections.includes(name);
  return (
    <>
      {include('map') && race.mapsimg && (
        <MediaSection title="КАРТА ОРГАНИЗАТОРА" images={[race.mapsimg]} onOpen={open} />
      )}
      {include('safety') && (
        <MediaSection
          title="ПАМЯТКА ПО БЕЗОПАСНОСТИ"
          images={race.safety_leaflet ? [race.safety_leaflet] : []}
          onOpen={open}
        />
      )}
      {include('participants') && (
        <MediaSection title="ЗАЯВЛЕННЫЕ ЭКИПАЖИ" images={crews} onOpen={open} />
      )}
      {include('results') && !finished && (
        <MediaSection title="РЕЗУЛЬТАТЫ" images={results} onOpen={open} />
      )}
      {include('documents') && extra.length > 0 && (
        <MediaSection title="МАТЕРИАЛЫ ГОНКИ" images={extra} onOpen={open} />
      )}
      {include('documents') && race.overlap_schedule && (
        <MediaSection
          title="СХЕМА ПЕРЕКРЫТИЯ ТРАССЫ"
          images={[race.overlap_schedule]}
          onOpen={open}
        />
      )}
      {include('history') && (
        <CollapsibleSection
          className="race-material"
          summary={
            <>
              <span className="block-title">КАК ЭТО БЫЛО</span>
              <span className="summary-chevron">⌄</span>
            </>
          }
        >
          {race.how_it_was ? (
            <div
              className="how-it-was"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(race.how_it_was) }}
            />
          ) : (
            <p className="gray-label">Информация появится позже :)</p>
          )}
        </CollapsibleSection>
      )}
      <ImageViewerModal image={selectedImage} onClose={() => setSelectedImage('')} />
    </>
  );
}
