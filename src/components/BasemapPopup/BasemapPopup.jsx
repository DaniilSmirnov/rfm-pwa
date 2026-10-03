import React from 'react';
import './BasemapPopup.css';

const fields = [
  ['Тип', 'kind'],
  ['Подтип', 'kind_detail'],
  ['Номер / ref', 'ref'],
  ['Щит', 'shield_text'],
  ['Дорожная сеть', 'network'],
  ['Односторонняя', 'oneway'],
  ['Сервис', 'service'],
  ['Съезд', 'is_link'],
  ['Мост', ['is_bridge', 'bridge']],
  ['Тоннель', ['is_tunnel', 'tunnel']],
  ['Население', 'population'],
  ['Ранг населения', 'population_rank'],
  ['Столица', 'capital'],
  ['Wikidata', 'wikidata'],
  ['Кухня', 'cuisine'],
  ['Религия', 'religion'],
  ['Спорт', 'sport'],
  ['IATA', 'iata'],
  ['Водохранилище', 'reservoir'],
  ['Пересыхающий', 'intermittent'],
  ['Щёлочная вода', 'alkaline'],
  ['Уровень', 'layer'],
  ['Спорная граница', 'disputed'],
  ['Admin level', '__admin_level'],
  ['Номер дома', 'addr_housenumber'],
  ['min_zoom', 'min_zoom'],
  ['sort_rank', 'sort_rank'],
];

function displayValue(value) {
  if (value === true || value === 'true') return 'да';
  if (value === false || value === 'false') return 'нет';
  return String(value);
}

function featureTitle(properties) {
  return (
    String(
      properties['name:ru'] ||
        properties.name_ru ||
        properties.name ||
        properties.title ||
        properties.caption ||
        '',
    ).trim() ||
    properties.ref ||
    properties.shield_text ||
    properties.addr_housenumber ||
    'Объект карты'
  );
}

export function getBasemapPopupData(feature) {
  const properties = feature?.properties || {};
  const visibleFields = fields
    .map(([label, key]) => {
      let value;
      if (key === '__admin_level') {
        value = feature?.layer?.['source-layer']?.includes?.('bound')
          ? properties.kind_detail
          : null;
      } else if (Array.isArray(key)) value = properties[key[0]] ?? properties[key[1]];
      else value = properties[key];
      return [label, value];
    })
    .filter(([, value]) => value !== undefined && value !== null && String(value) !== '');

  const layer = feature?.layer?.['source-layer'] || feature?.sourceLayer || '';
  return { title: featureTitle(properties), layer, fields: visibleFields };
}

export default function BasemapPopup({ feature }) {
  const data = getBasemapPopupData(feature);
  return (
    <div className="basemap-popup-card">
      <strong className="basemap-popup-title">{data.title}</strong>
      {data.layer && <div className="basemap-popup-layer">{data.layer}</div>}
      {data.fields.map(([label, value]) => (
        <div className="basemap-popup-row" key={label}>
          <span>{label}</span>
          <b>{displayValue(value)}</b>
        </div>
      ))}
    </div>
  );
}
