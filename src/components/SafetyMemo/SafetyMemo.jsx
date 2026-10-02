import React from 'react';
import {
  dangerExamples,
  safetyCountdowns,
  safetyRules,
  stageGuides,
} from '../app/safety-memo-content.js';
import './SafetyMemo.css';

const illustration = name => `/assets/safety/${name}`;

function MemoImage({ name, alt, className = '', loading = 'lazy' }) {
  return (
    <img
      className={className}
      src={illustration(name)}
      alt={alt}
      loading={loading}
      decoding="async"
    />
  );
}

function MemoHeader() {
  return (
    <>
      <header className="safety-memo-header">
        <span className="safety-memo-kicker">ЗРИТЕЛЬ — ЧАСТЬ РАЛЛИ</span>
        <h2 id="safetyGateTitle">Безопасность</h2>
        <p>Соблюдай правила</p>
      </header>
      <p className="safety-memo-lead">
        Ралли — это скорость и риск. Машина может выйти за пределы трассы. Выбирай безопасные точки
        и следуй указаниям маршалов.
      </p>
    </>
  );
}

function MainRules() {
  return (
    <section className="safety-main-rules safety-memo-panel" aria-labelledby="safetyMainTitle">
      <h3 id="safetyMainTitle">Главное</h3>
      <ul>
        {safetyRules.map(rule => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </section>
  );
}

function SafetyCars() {
  return (
    <section className="safety-cars safety-memo-panel" aria-labelledby="safetyCarsTitle">
      <div className="safety-cars-copy">
        <h3 id="safetyCarsTitle">Автомобили безопасности</h3>
        <p>Перед стартом по трассе проходят:</p>
        <ol>
          {safetyCountdowns.map(({ label, minutes }) => (
            <li key={label}>
              <span>{label}</span>
              <b>{minutes} минут</b>
            </li>
          ))}
        </ol>
        <small>После автомобиля 0 едет первый боевой экипаж.</small>
      </div>
      <MemoImage
        name="safety-car.webp"
        alt="Автомобиль безопасности ралли"
        className="safety-car-image"
        loading="eager"
      />
    </section>
  );
}

function StartWarning() {
  return (
    <section className="safety-start-warning" aria-label="Ограничение движения по спецучастку">
      <strong>60 минут до старта</strong>
      <span>Передвижение по спецучастку запрещено</span>
    </section>
  );
}

function DangerLegend() {
  return (
    <ul className="safety-danger-legend" aria-label="Условные обозначения">
      <li>
        <b className="safety-legend-cross">×</b> Опасная зона вылета
      </li>
      <li>
        <b className="safety-legend-line" /> Безопасная зона для зрителей
      </li>
      <li>
        <b className="safety-legend-marshal">●</b> Маршал безопасности
      </li>
      <li>
        <b className="safety-legend-arrow">➜</b> Направление движения
      </li>
    </ul>
  );
}

function DangerMap() {
  return (
    <section className="safety-danger-map" aria-labelledby="safetyDangerTitle">
      <div className="safety-section-heading">
        <h3 id="safetyDangerTitle">Опасные зоны</h3>
        <p>На участке и в примерах опасных мест</p>
      </div>
      <div className="safety-map-art">
        <MemoImage
          name="danger-zones-map.webp"
          alt="Схема спецучастка: дорога, зрители за безопасными линиями и маршалы"
          className="safety-map-image"
          loading="eager"
        />
        <DangerLegend />
        <span className="safety-map-label safety-map-start">Старт</span>
        <span className="safety-map-label safety-map-finish">Финиш</span>
      </div>
      <div className="safety-danger-examples">
        {dangerExamples.map((item, index) => (
          <article className="safety-danger-example" key={item.title}>
            <h4>
              <span>{index + 1}</span>
              {item.title}
            </h4>
            <MemoImage name={item.image} alt={`Пример: ${item.title.toLowerCase()}`} />
            <p>{item.description}</p>
          </article>
        ))}
      </div>
      <div className="safety-danger-footer">
        <p>
          <b>×</b> Никогда не стой в зоне вылета и за ограждениями.
        </p>
        <p>
          <b>♟</b> Следуй указаниям маршалов безопасности.
        </p>
        <p>
          <b>👥</b> Выбирай место с хорошим обзором и запасом до дороги.
        </p>
        <p>
          <b>!</b> Безопасность — твоя ответственность.
        </p>
      </div>
    </section>
  );
}

function BroomMark() {
  return (
    <svg className="safety-broom-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="m31 5 5 5-18 18-5-5L31 5Zm-21 21 8 8-8 8-7-2 1-7 6-7Zm13-5 5 5-9 9-5-5 9-9Z"
        fill="currentColor"
      />
      <path
        d="m5 42 11-2M3 36l8-1M10 46l8-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StageGuide() {
  return (
    <section className="safety-stage-guide" aria-labelledby="safetyStageTitle">
      <h3 id="safetyStageTitle">Как вести себя на этапе</h3>
      <div className="safety-stage-cards">
        {stageGuides.map((step, index) => (
          <article className="safety-stage-card" key={step.title}>
            <header>
              <span>{index + 1}</span>
              <h4>{step.title}</h4>
            </header>
            <MemoImage name={step.image} alt="" />
            <ul>
              {step.rules.map(rule => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <footer className="safety-sweep-note">
        <BroomMark />
        <p>
          <strong>«Метла»</strong> — автомобиль, который проходит трассу после сходов экипажей и
          собирает контрольные карты.
        </p>
      </footer>
    </section>
  );
}

export default function SafetyMemo() {
  return (
    <article className="safety-memo">
      <MemoHeader />
      <div className="safety-top-panels">
        <MainRules />
        <SafetyCars />
      </div>
      <StartWarning />
      <div className="safety-marshal-note">
        <strong>Маршалы работают для твоей безопасности</strong>
        <span>Rally Fans Map</span>
      </div>
      <DangerMap />
      <StageGuide />
      <footer className="safety-memo-footer">Будь зрителем, а не участником аварии.</footer>
    </article>
  );
}
