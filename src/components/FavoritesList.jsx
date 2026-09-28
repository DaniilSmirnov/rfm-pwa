import React from 'react';
import { coordinateText } from '../navigation.js';
import './MapView.css';

export default function FavoritesList({app}){
  if(!app.favorites.length)return <p className="muted small">Пока пусто.</p>;
  return <>{app.favorites.map(point=><article className="favorite-row" key={point.key||coordinateText(point)}>
    <div className="point-row-copy" onClick={()=>app.showPoint(point)}><strong>★ {point.name}</strong><span className="muted">{coordinateText(point)}</span></div>
    <div className="point-nav-buttons">
      <button className="button compact primary" onClick={()=>app.showPoint(point)}>Открыть</button>
      <button className="button compact danger" onClick={()=>app.toggleFavorite(point,false)}>Удалить</button>
    </div>
  </article>)}</>;
}
