import './CrewResultsModal.css';
import * as Dialog from '@radix-ui/react-dialog';
import React, { useMemo, useRef, useState } from 'react';
import SearchField from '../components/SearchField.jsx';
import Button from '../components/Button.jsx';
import ScreenHeader, { useEdgeSwipeBack } from '../components/ScreenHeader.jsx';
import SelectField from '../components/SelectField.jsx';
import { formatRetirementReason } from '../app/crew-results.js';
import { ChevronRight, Star } from 'lucide-react';

function gapFromLeader(result, rows) {
  if (result?.goingOff || result?.goingOffAfterSu) return '—';
  if (result?.formattedFromLeader) return result.formattedFromLeader;
  const leader = rows.find(row => !row?.goingOff && !row?.goingOffAfterSu && Number(row?.time) > 0);
  if (!leader || leader === result) return 'лидер';
  const difference = Math.max(0, Number(result?.time) - Number(leader.time));
  return `+${(difference / 1000).toFixed(1)} с`;
}

function retirementLabel(result) {
  return formatRetirementReason(result);
}

function crewTimeLabel(value) {
  const text = String(value ?? '').trim();
  return text && !text.includes('NaN') ? text : 'нет информации';
}

function crewIdOf(result, resultLabel) {
  return String(result?.crew?.id || result?.crew?.number || resultLabel(result));
}

function CrewDetailsDialog({
  crewResult,
  views,
  resultLabel,
  onClose,
  subscribed,
  onToggleSubscription,
}) {
  useEdgeSwipeBack(onClose, Boolean(crewResult));
  if (!crewResult) return null;
  const crewId = crewIdOf(crewResult, resultLabel);
  const stageResults = views.slice(1).map(view => ({
    view,
    result: view.results.find(item => crewIdOf(item, resultLabel) === crewId),
  }));
  const overallStatus = retirementLabel(crewResult);

  return (
    <Dialog.Root
      open={Boolean(crewResult)}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="crew-details-dialog-overlay" />
        <Dialog.Content className="crew-details-dialog" aria-labelledby="crewDetailsDialogTitle">
          <ScreenHeader title="Детали экипажа" onBack={onClose} />
          <Dialog.Title asChild>
            <span id="crewDetailsDialogTitle" className="sr-only">
              Детали экипажа
            </span>
          </Dialog.Title>

          <div className="crew-details-profile">
            <div className="crew-details-profile-copy">
              <div className="crew-details-identity">
                <strong>#{crewResult.crew?.number || '—'}</strong>
                <Button
                  className={`crew-details-star ${subscribed ? 'active' : ''}`}
                  type="button"
                  aria-pressed={subscribed}
                  aria-label={
                    subscribed ? 'Удалить экипаж из избранного' : 'Добавить экипаж в избранное'
                  }
                  onClick={() => void onToggleSubscription(crewResult)}
                >
                  <Star size={20} fill={subscribed ? 'currentColor' : 'none'} aria-hidden="true" />
                </Button>
              </div>
              <strong className="crew-details-name">{resultLabel(crewResult)}</strong>
              <span className="crew-details-car">
                {crewResult.crew?.car || 'Автомобиль не указан'}
              </span>
              <span className="crew-details-class">
                {crewResult.discipline?.name || 'Зачёт не указан'}
              </span>
            </div>
            <div className="crew-details-car-image" aria-label="Фото автомобиля">
              <span aria-hidden="true">RALLY</span>
            </div>
            <div className="crew-details-overall">
              <strong>{overallStatus || crewTimeLabel(crewResult.formattedFromLeader)}</strong>
              <span>к лидеру</span>
            </div>
          </div>

          <div className="crew-details-tabs" role="tablist" aria-label="Детали результатов">
            <Button className="active" role="tab" aria-selected="true">
              По СУ
            </Button>
            <Button className="disabled" role="tab" aria-selected="false" disabled>
              График позиции
            </Button>
          </div>

          <div className="crew-details-stages">
            <div
              className="crew-details-stage-table"
              role="table"
              aria-label="Результаты по спецучасткам"
            >
              <div className="crew-details-stage-row crew-details-stage-header" role="row">
                <span role="columnheader">СУ</span>
                <span role="columnheader">Место</span>
                <span role="columnheader">Время</span>
                <span role="columnheader">Отставание</span>
              </div>
              {stageResults.length ? (
                <div role="rowgroup">
                  {stageResults.map(({ view, result }) => {
                    const status = retirementLabel(result);
                    return (
                      <div className="crew-details-stage-row" role="row" key={view.key}>
                        <span role="cell">{view.name.replace(/^Спецучасток\s*/i, 'СУ')}</span>
                        <span role="cell">{result ? view.results.indexOf(result) + 1 : '—'}</span>
                        <span className={status ? 'retired' : ''} role="cell">
                          {status || crewTimeLabel(result?.formattedTime)}
                        </span>
                        <span className={status ? 'retired' : ''} role="cell">
                          {status || gapFromLeader(result, view.results)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="muted crew-details-empty">Данные по спецучасткам пока недоступны.</p>
              )}
            </div>
          </div>
          <footer className="crew-details-footer">Результаты от ASMG</footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function CrewResultsModal({
  open,
  standalone = false,
  onClose,
  data,
  views,
  activeView,
  className,
  onClassChange,
  onStageChange,
  classes,
  query,
  onQueryChange,
  visible,
  selectedClassResults,
  subscriptions,
  onToggleSubscription,
  resultLabel,
  subscriptionKey,
}) {
  const dialog = useRef(null);
  const searchRef = useRef(null);
  const [expandedCrew, setExpandedCrew] = useState('');
  const [selectedCrew, setSelectedCrew] = useState(null);
  const followedIds = useMemo(
    () => new Set(subscriptions.map(item => String(item.crewId))),
    [subscriptions],
  );
  const rankedRows = useMemo(
    () =>
      visible
        .map((result, index) => ({ result, index }))
        .sort((left, right) => {
          const leftId = String(
            left.result?.crew?.id || left.result?.crew?.number || resultLabel(left.result),
          );
          const rightId = String(
            right.result?.crew?.id || right.result?.crew?.number || resultLabel(right.result),
          );
          return (
            Number(followedIds.has(rightId)) - Number(followedIds.has(leftId)) ||
            left.index - right.index
          );
        }),
    [visible, followedIds, resultLabel],
  );
  const selectedCrewId = selectedCrew ? crewIdOf(selectedCrew, resultLabel) : null;
  const selectedCrewSubscribed = selectedCrew
    ? subscriptions.some(item => item.key === subscriptionKey(data.eventId, selectedCrewId))
    : false;

  const content = (
    <>
      {!standalone && (
        <header className="crew-results-dialog-head">
          <div>
            <Dialog.Title asChild>
              <h2 id="crewResultsDialogTitle">Результаты экипажей</h2>
            </Dialog.Title>
            <p className="muted small">Выбери класс, чтобы увидеть весь его состав.</p>
          </div>
          <Dialog.Close asChild>
            <Button
              className="button crew-results-close"
              type="button"
              aria-label="Закрыть результаты"
            >
              ×
            </Button>
          </Dialog.Close>
        </header>
      )}
      <div className="crew-results-toolbar">
        <label className="sr-only" htmlFor="crewResultsStage">
          Спецучасток
        </label>
        <SelectField
          id="crewResultsStage"
          className="crew-results-stage"
          value={activeView?.key || ''}
          onChange={event => {
            onStageChange(event.target.value);
            onClassChange('');
          }}
        >
          {views.map(view => (
            <option key={view.key} value={view.key}>
              {view.name}
            </option>
          ))}
        </SelectField>
        <label
          className="sr-only"
          htmlFor={standalone ? 'crewResultsDialogClass' : 'crewResultsDialogClass'}
        >
          Класс
        </label>
        <SelectField
          id="crewResultsDialogClass"
          className="crew-results-stage"
          value={className}
          onChange={event => onClassChange(event.target.value)}
        >
          <option value="">Все классы</option>
          {classes.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </SelectField>
        <SearchField
          ref={searchRef}
          id="crewResultsSearch"
          placeholder="Поиск по экипажу, номеру или машине…"
          aria-label="Поиск экипажа"
          value={query}
          onChange={event => onQueryChange(event.target.value)}
        />
      </div>
      <div className="crew-results-table-wrap">
        <table className="crew-results-table">
          <thead>
            <tr>
              <th scope="col">Место</th>
              <th scope="col">Экипаж</th>
              <th scope="col">Автомобиль / зачёт</th>
              <th scope="col" id="crewResultsTimeHeading">
                {activeView?.name || 'Время'}
              </th>
              <th scope="col">
                <span className="sr-only">Подписка</span>
              </th>
            </tr>
          </thead>
          <tbody className="crew-results-body">
            {rankedRows.length ? (
              rankedRows.map(({ result }) => {
                const crew = result?.crew || {};
                const id = String(crew.id || crew.number || resultLabel(result));
                const subscribed = subscriptions.some(
                  item => item.key === subscriptionKey(data.eventId, id),
                );
                const place = selectedClassResults.indexOf(result) + 1;
                const retired = result.goingOff || result.goingOffAfterSu;
                const stages = views
                  .slice(1)
                  .map(view => ({
                    view,
                    result: view.results.find(
                      item =>
                        String(item?.crew?.id || item?.crew?.number || resultLabel(item)) === id,
                    ),
                  }))
                  .filter(item => item.result);
                return (
                  <React.Fragment key={id}>
                    <tr
                      data-crew-row
                      data-search={`${crew.number || ''} ${resultLabel(result)} ${crew.car || ''} ${result?.discipline?.name || ''}`.toLocaleLowerCase(
                        'ru',
                      )}
                    >
                      <td className="crew-results-place">{retired ? '—' : place}</td>
                      <td className="crew-results-name">
                        <strong>{resultLabel(result)}</strong>
                        <small>№ {crew.number || '—'}</small>
                        <Button
                          className="button compact crew-details-toggle"
                          type="button"
                          aria-expanded={expandedCrew === id}
                          onClick={() => setExpandedCrew(expandedCrew === id ? '' : id)}
                        >
                          {expandedCrew === id ? 'Скрыть СУ' : 'По СУ'}
                        </Button>
                      </td>
                      <td>
                        {crew.car || 'Автомобиль не указан'}
                        <small>{result?.discipline?.name || 'Зачёт не указан'}</small>
                      </td>
                      <td className="crew-results-time">
                        {retired
                          ? formatRetirementReason(result)
                          : crewTimeLabel(result.formattedTime)}
                        {result.formattedTimePenalty && (
                          <small>Штраф {result.formattedTimePenalty}</small>
                        )}
                        <small>От лидера: {gapFromLeader(result, selectedClassResults)}</small>
                      </td>
                      <td>
                        <Button
                          className={`button compact crew-subscribe-button ${subscribed ? 'downloaded' : ''}`}
                          type="button"
                          data-subscribe={id}
                          data-name={resultLabel(result)}
                          aria-label={`${subscribed ? 'Отписаться от экипажа' : 'Следить за экипажем'}: ${resultLabel(result)}`}
                          onClick={() => void onToggleSubscription(result)}
                        >
                          {subscribed ? 'Отписаться' : 'Подписаться'}
                        </Button>
                      </td>
                    </tr>
                    {expandedCrew === id && (
                      <tr className="crew-stage-details" data-crew-details={id}>
                        <td colSpan="5">
                          <strong>Результаты по спецучасткам</strong>
                          {stages.length ? (
                            <ol>
                              {stages.map(({ view, result: stageResult }) => (
                                <li key={view.key}>
                                  <span>
                                    {view.name} · место {view.results.indexOf(stageResult) + 1}
                                  </span>
                                  <span>
                                    {stageResult.goingOff || stageResult.goingOffAfterSu
                                      ? formatRetirementReason(stageResult)
                                      : crewTimeLabel(stageResult.formattedTime)}
                                    <small>
                                      От лидера: {gapFromLeader(stageResult, view.results)}
                                    </small>
                                  </span>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p className="muted small">Данные по спецучасткам недоступны.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan="5" className="crew-results-empty">
                  Экипажи по этому запросу не найдены.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted small crew-results-priority-note">
        Экипажи, за которыми вы следите, показаны первыми. Место в протоколе не меняется.
      </p>
    </>
  );

  const standaloneContent = (
    <section className="crew-results-inline crew-results-mobile" aria-label="Результаты экипажей">
      <div className="crew-results-mobile-controls">
        <div className="crew-results-class-chips" aria-label="Класс">
          <Button
            className={!className ? 'active' : ''}
            aria-pressed={!className}
            onClick={() => onClassChange('')}
          >
            Абсолют
          </Button>
          {classes
            .filter(name => name !== 'Абсолют')
            .map(name => (
              <Button
                key={name}
                className={className === name ? 'active' : ''}
                aria-pressed={className === name}
                onClick={() => onClassChange(name)}
              >
                {name}
              </Button>
            ))}
          <Button
            className={className === '__all__' ? 'active' : ''}
            aria-pressed={className === '__all__'}
            onClick={() => onClassChange('__all__')}
          >
            Все
          </Button>
        </div>
        <div className="crew-results-search-row">
          <SearchField
            ref={searchRef}
            id="crewResultsSearch"
            placeholder="Поиск экипажа, пилота, номера…"
            aria-label="Поиск экипажа"
            value={query}
            onChange={event => onQueryChange(event.target.value)}
          />
          <a
            className="asmg-results-brand"
            href="https://asmg.ru/"
            target="_blank"
            rel="noreferrer"
            aria-label="Открыть сайт ASMG"
          >
            <svg className="asmg-results-logo" viewBox="159 0 127 31" role="img" aria-label="ASMG">
              <clipPath id="asmg-results-logo-clip">
                <rect x="159" y="0" width="127" height="31" />
              </clipPath>
              <g clipPath="url(#asmg-results-logo-clip)">
                <path
                  d="M166.931 5.5H183.555L183.812 12.8605L173.692 25.5H159.678L169.819 12.8605L166.931 5.5Z"
                  fill="#D72E2E"
                />
                <path
                  d="M173.691 25.5L183.812 12.8605L180.602 5.5H203.41L196.649 25.5H190.102L195.665 10.3283H188.882L190.038 12.8605L180.174 25.5H173.691Z"
                  fill="white"
                />
                <path d="M194.189 16.6157H182.785V20.5857H194.189V16.6157Z" fill="white" />
                <path
                  d="M225.148 25.5L230.818 9.06223L229.235 5.5H236.852L241.324 17.1738L251.358 5.5H258.633L251.743 25.5H245.047L247.871 17.367L241.88 23.3326H237.023L234.627 17.5601L231.845 25.5H225.148Z"
                  fill="white"
                />
                <path
                  d="M268.133 5.5H261.03H259.831L261.393 8.9764C259.96 13.4614 257.478 20.8219 256.472 23.8047C256.151 24.6416 256.75 25.5 257.67 25.5H274.766C277.611 25.5 279.558 23.9764 280.607 20.9506C280.607 21.0365 283.281 13.2468 283.281 13.118H270.936H269.952C269.952 13.118 272.583 16.5515 272.776 16.7446C272.99 16.9378 273.311 17.1524 273.717 17.1524H275.45L274.359 20.2854C274.274 20.5429 274.081 20.6502 273.739 20.6502H264.517C264.324 20.6502 264.26 20.5644 264.282 20.4142C264.303 20.4142 266.828 12.7532 266.849 12.7532L265.523 10.2854H268.39H283.089C283.624 10.2854 284.116 9.96352 284.308 9.42704L285.678 5.5H268.133Z"
                  fill="white"
                />
                <path
                  d="M211.198 5.5C208.01 5.5 205.507 7.56009 204.672 10.0494L203.624 13.1609C202.618 15.9077 204.715 17.7318 207.668 17.7318H217.36C217.681 17.7318 217.767 17.8391 217.681 18.0751L216.911 20.3069C216.825 20.5644 216.654 20.6717 216.333 20.6502H202.469C201.934 20.6502 201.506 20.9722 201.292 21.4442L199.602 25.5H217.061C220.334 25.5 222.474 23.397 223.372 20.9506L224.421 17.8391C225.426 15.0922 223.33 13.2682 220.398 13.2682H214.814H211.498H210.663L208.93 10.3283H211.498H215.82H225.127C225.726 10.3283 226.132 10.0494 226.325 9.4485C226.774 7.98927 227.117 6.95923 227.609 5.5H211.198Z"
                  fill="white"
                />
              </g>
            </svg>
            <span>Результаты от ASMG</span>
          </a>
        </div>
      </div>
      <div className="crew-results-mobile-list">
        {rankedRows.length ? (
          rankedRows.map(({ result }) => {
            const id = crewIdOf(result, resultLabel);
            const crew = result.crew || {};
            const retired = retirementLabel(result);
            const subscribed = subscriptions.some(
              item => item.key === subscriptionKey(data.eventId, id),
            );
            const place = selectedClassResults.indexOf(result) + 1;
            return (
              <article
                key={id}
                className={`crew-result-card ${retired ? 'retired' : ''}`}
                data-crew-row
                data-search={`${crew.number || ''} ${resultLabel(result)} ${crew.car || ''} ${result?.discipline?.name || ''}`.toLocaleLowerCase(
                  'ru',
                )}
                onClick={event => {
                  if (event.target.closest('.crew-result-star')) return;
                  setSelectedCrew(result);
                }}
              >
                <div className="crew-result-card-leading">
                  <span className="crew-result-card-place">{retired ? '—' : place}</span>
                  <Button
                    className={`crew-result-star ${subscribed ? 'active' : ''}`}
                    type="button"
                    aria-label={`${subscribed ? 'Отписаться от экипажа' : 'Следить за экипажем'}: ${resultLabel(result)}`}
                    onClick={() => void onToggleSubscription(result)}
                  >
                    <Star
                      size={18}
                      fill={subscribed ? 'currentColor' : 'none'}
                      aria-hidden="true"
                    />
                  </Button>
                </div>
                <Button
                  type="button"
                  className="crew-result-card-main"
                  onClick={() => setSelectedCrew(result)}
                  aria-label={`Открыть результаты экипажа ${resultLabel(result)}`}
                >
                  <span className="crew-result-card-copy">
                    <strong>
                      №{crew.number || '—'} {resultLabel(result)}
                    </strong>
                    <small>{crew.car || 'Автомобиль не указан'}</small>
                    <small>{retired || result?.discipline?.name || 'Зачёт не указан'}</small>
                  </span>
                  <span className="crew-result-card-time">
                    {retired || crewTimeLabel(result.formattedTime)}
                    {!retired && <small>{gapFromLeader(result, selectedClassResults)}</small>}
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </Button>
              </article>
            );
          })
        ) : (
          <p className="crew-results-empty">Экипажи по этому запросу не найдены.</p>
        )}
      </div>
      <CrewDetailsDialog
        crewResult={selectedCrew}
        views={views}
        resultLabel={resultLabel}
        subscribed={selectedCrewSubscribed}
        onToggleSubscription={onToggleSubscription}
        onClose={() => setSelectedCrew(null)}
      />
    </section>
  );

  if (standalone) return standaloneContent;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) onClose?.();
      }}
    >
      <Dialog.Overlay className="crew-results-dialog-overlay" />
      <Dialog.Content
        ref={dialog}
        className="crew-results-dialog"
        aria-labelledby="crewResultsDialogTitle"
        onOpenAutoFocus={event => {
          event.preventDefault();
          searchRef.current?.focus();
        }}
      >
        {content}
      </Dialog.Content>
    </Dialog.Root>
  );
}
