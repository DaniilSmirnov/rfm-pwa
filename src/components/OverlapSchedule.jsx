import React from 'react';
import './OverlapSchedule.css';
import { timeToMinutes } from '../app/overlap-schedule.js';

const START = 8 * 60;
const END = 19 * 60;
const RIGHT = 640;
const WIDTH = RIGHT;
const X = value => ((value - START) / (END - START)) * WIDTH;

export default function OverlapSchedule({ schedule }) {
  const stages = schedule?.stages || [];
  const rowHeight = 46;
  const chartTop = 38;
  const height = chartTop + stages.length * rowHeight + 8;
  const ticks = Array.from({ length: 12 }, (_, index) => START + index * 60);
  const format = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:00`;
  const hasApproximateLastCrewTime = stages.some(stage => stage.last_crew_time_approximate);

  return (
    <section className="today-card today-overlap" aria-label="График перекрытий">
      <div className="block-title">ГРАФИК ПЕРЕКРЫТИЙ · {schedule.event}</div>
      <p className="overlap-date">
        {schedule.date} · {schedule.series} {schedule.year}
      </p>
      <div className="overlap-chart-layout">
        <div className="overlap-stage-labels" aria-label="Спецучастки">
          {stages.map((stage, index) => (
            <div className="overlap-stage-label" key={`${stage.number}-label-${index}`}>
              <div className="overlap-stage-heading">
                <span className="overlap-stage-number">СУ {stage.number}</span>
                <span className="overlap-stage-name">{stage.name}</span>
              </div>
              <span className="overlap-stage-section">Секция {stage.section}</span>
            </div>
          ))}
        </div>
        <div className="overlap-chart-scroll">
          <svg
            className="overlap-chart"
            viewBox={`0 0 ${RIGHT} ${height}`}
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
                  <line
                    x1="0"
                    x2={RIGHT}
                    y1={y + 14}
                    y2={y + 14}
                    className="overlap-track"
                  />
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
                  {close !== null && (
                    <line
                      x1={X(close)}
                      x2={X(close)}
                      y1={y + 3}
                      y2={y + 25}
                      className="overlap-boundary overlap-close"
                    />
                  )}
                  {open !== null && (
                    <line
                      x1={X(open)}
                      x2={X(open)}
                      y1={y + 3}
                      y2={y + 25}
                      className="overlap-boundary overlap-open"
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
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      {hasApproximateLastCrewTime && (
        <p className="overlap-approximation-note">Время последнего экипажа ориентировочное</p>
      )}
      <div className="overlap-legend" aria-label="Обозначения графика">
        <span>
          <i className="closure" /> Перекрытие
        </span>
        <span>
          <i className="boundary-close" /> Закрытие
        </span>
        <span>
          <i className="boundary-open" /> Открытие
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
