import './TodayScreen.css';
import React from 'react';
import TodayView from '../TodayView/TodayView.jsx';

export default function TodayScreen({ app, onMap, onResults, onRaces }) {
  return (
    <div className="app-screen-today">
      <TodayView app={app} onMap={onMap} onResults={onResults} onRaces={onRaces} />
    </div>
  );
}
