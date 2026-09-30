import React from 'react';
import Button from './Button.jsx';
import { coordinateText } from '../navigation.js';
import './MapView.css';

export default function FavoritesList({ app }) {
  if (!app.favorites.length) return <p className="muted small">Пока пусто.</p>;
  return (
    <>
      {app.favorites.map(point => (
        <article className="favorite-row" key={point.key || coordinateText(point)}>
          <div
            className="point-row-copy"
            data-point-opener="true"
            onClick={() => app.showPoint(point)}
          >
            <strong>★ {point.name}</strong>
            <span className="muted">{coordinateText(point)}</span>
          </div>
          <div className="point-nav-buttons">
            <Button
              className="button compact primary"
              data-point-opener="true"
              onClick={() => app.showPoint(point)}
            >
              Открыть
            </Button>
            <Button
              className="button compact danger"
              onClick={() => app.toggleFavorite(point, false)}
            >
              Удалить
            </Button>
          </div>
        </article>
      ))}
    </>
  );
}
