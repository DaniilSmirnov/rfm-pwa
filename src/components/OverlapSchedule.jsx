import React from 'react';
import './OverlapSchedule.css';
import { timeToMinutes } from '../app/overlap-schedule.js';

const START = 8 * 60;
const END = 19 * 60;
const LEFT = 150;
const RIGHT = 790;
const WIDTH = RIGHT - LEFT;
const X = value => LEFT + ((value - START) / (END - START)) * WIDTH;

export default function OverlapSchedule({ schedule }) {
  const stages = schedule?.stages || [];
  const rowHeight = 46;
  const chartTop = 38;
  const height = chartTop + stages.length * rowHeight + 8;
  const ticks = Array.from({ length: 12 }, (_, index) => START + index * 60);
  const format = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:00`;

  return (
    <section className="today-card today-overlap" aria-label="График перекрытий">
      <div className="block-title">ГРАФИК ПЕРЕКРЫТИЙ · {schedule.event}</div>
      <p className="overlap-date">
        {schedule.date} · {schedule.series} {schedule.year}
      </p>
      <div className="overlap-chart-scroll">
        <svg
          className="overlap-chart"
          viewBox={`0 0 800 ${height}`}
          role="img"
          aria-label={`Временная шкала перекрытия дорог: ${stages.length} спецучастков`}
        >
          <title>Перекрытие дорог и прохождение спецучастков</title>
          {ticks.map(tick => (
            <g key={tick}>
              <line
                x1={X(tick)}
                x2={X(tick)}
                y1="24"
                y2={height - 4}
                className="overlap-gridline"
              />
              <text x={X(tick)} y="16" textAnchor="middle" className="overlap-tick">
                {format(tick)}
              </text>
            </g>
          ))}
          {stages.map((stage, index) => {
            const y = chartTop + index * rowHeight;
            const close = timeToMinutes(stage.road_closes_at);
            const open = timeToMinutes(stage.road_opens_at);
            const markers = [
              { field: 'first_zero_at', className: 'zero', label: '0' },
              { field: 'first_crew_at', className: 'first-crew', label: 'Экипаж 1' },
              { field: 'last_crew_at', className: 'last-crew', label: 'Последний экипаж' },
            ];
            return (
              <g key={`${stage.number}-${index}`}>
                <text x="0" y={y + 17} className="overlap-stage-number">
                  СУ {stage.number}
                </text>
                <text x="42" y={y + 17} className="overlap-stage-name">
                  {stage.name}
                </text>
                <text x="42" y={y + 33} className="overlap-stage-section">
                  Секция {stage.section}
                </text>
                <line x1={LEFT} x2={RIGHT} y1={y + 14} y2={y + 14} className="overlap-track" />
                {close !== null && open !== null && (
                  <rect
                    x={X(close)}
                    y={y + 7}
                    width={Math.max(3, X(open) - X(close))}
                    height="14"
                    rx="7"
                    className="overlap-closure"
                  />
                )}
                {markers.map(marker => {
                  const time = timeToMinutes(stage[marker.field]);
                  if (time === null) return null;
                  return (
                    <circle
                      key={marker.field}
                      cx={X(time)}
                      cy={y + 14}
                      r="5"
                      className={`overlap-marker ${marker.className}`}
                    />
                  );
                })}
                <text x={LEFT} y={y + 38} className="overlap-time-label">
                  {stage.road_closes_at} перекрытие · 0: {stage.first_zero_at} · первый:{' '}
                  {stage.first_crew_at} · последний: {stage.last_crew_at} · {stage.road_opens_at}{' '}
                  открытие
                  {stage.last_crew_time_approximate
                    ? ' · время последнего экипажа ориентировочное'
                    : ''}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="overlap-legend" aria-label="Обозначения графика">
        <span>
          <i className="closure" /> Перекрытие
        </span>
        <span>
          <i className="zero" /> Нулевой экипаж
        </span>
        <span>
          <i className="first" /> Первый экипаж
        </span>
        <span>
          <i className="last" /> Последний экипаж
        </span>
      </div>
    </section>
  );
}
