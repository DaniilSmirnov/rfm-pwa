import './CrewResultsModal.css';
import * as Dialog from '@radix-ui/react-dialog';
import React, { useMemo, useRef, useState } from 'react';
import SearchField from '../components/SearchField.jsx';
import Button from '../components/Button.jsx';
import ScreenHeader, { useEdgeSwipeBack } from '../components/ScreenHeader.jsx';
import SelectField from '../components/SelectField.jsx';
import { ChevronRight, Star } from 'lucide-react';

function gapFromLeader(result, rows) {
  if (!result) return 'Не пройден';
  if (result?.goingOff || result?.goingOffAfterSu) return '—';
  if (!Number.isFinite(Number(result?.time)) || Number(result?.time) <= 0) return 'Не пройден';
  if (result?.formattedFromLeader) return result.formattedFromLeader;
  const leader = rows.find(row => !row?.goingOff && !row?.goingOffAfterSu && Number(row?.time) > 0);
  if (!leader || leader === result) return 'лидер';
  const difference = Math.max(0, Number(result?.time) - Number(leader.time));
  return `+${(difference / 1000).toFixed(1)} с`;
}

function retirementLabel(result) {
  if (!result?.goingOff && !result?.goingOffAfterSu) return '';
  return result.reasonGoingOff || (result.goingOffAfterSu ? 'Сход после спецучастка' : 'Сход');
}

function sentenceCase(value) {
  const normalized = String(value || '').toLocaleLowerCase('ru').trim();
  return normalized ? normalized[0].toLocaleUpperCase('ru') + normalized.slice(1) : '';
}

function cleanRetirementReason(result, views, resultLabel) {
  const reason = retirementLabel(result);
  if (!reason || reason === 'Сход' || reason === 'Сход после спецучастка') return '';

  const crew = result?.crew || {};
  const removable = [
    resultLabel(result),
    [crew?.pilot?.lastName, crew?.pilot?.firstName].filter(Boolean).join(' '),
    [crew?.pilot?.firstName, crew?.pilot?.lastName].filter(Boolean).join(' '),
    [crew?.navigator?.lastName, crew?.navigator?.firstName].filter(Boolean).join(' '),
    [crew?.navigator?.firstName, crew?.navigator?.lastName].filter(Boolean).join(' '),
    ...views.slice(1).flatMap(view => [
      view?.name,
      String(view?.name || '').replace(/^Спецучасток\s*/i, 'СУ '),
    ]),
  ].filter(Boolean);

  let cleaned = reason;
  for (const value of removable) {
    cleaned = cleaned.replaceAll(String(value), ' ');
  }
  cleaned = cleaned
    .replace(/\b(?:СУ|SS)\s*[-№#:]?\s*\d+\b/gi, ' ')
    .replace(/\bспецучаст(?:ок|ка)\s*[-№#:]?\s*\d+\b/gi, ' ')
    .replace(/^\s*сход\s*[:—-]?\s*/i, '')
    .replace(/[·|,;:—-]+\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return sentenceCase(cleaned);
}

function retirementDetails(result, views, resultLabel) {
  if (!retirementLabel(result)) return null;
  return {
    reason: cleanRetirementReason(result, views, resultLabel),
  };
}

function crewIdOf(result, resultLabel) {
  return String(result?.crew?.id || result?.crew?.number || resultLabel(result));
}

function CrewDetailsDialog({ crewResult, views, resultLabel, onClose }) {
  if (!crewResult) return null;
  const crewId = crewIdOf(crewResult, resultLabel);
  const stageResults = views.slice(1).map(view => ({
    view,
    result: view.results.find(item => crewIdOf(item, resultLabel) === crewId),
  }));
  const overallStatus = retirementDetails(crewResult, views, resultLabel);
  const overallText =
    overallStatus?.reason || (overallStatus ? 'Сход' : crewResult.formattedFromLeader || '—');
  useEdgeSwipeBack(onClose, true);

  return (
    <Dialog.Root
      open={Boolean(crewResult)}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <Dialog.Overlay className="crew-details-dialog-overlay" />
      <Dialog.Content className="crew-details-dialog" aria-label="Детали экипажа">
        <ScreenHeader title="Детали экипажа" onBack={onClose} />

        <div className="crew-details-profile">
          <div className="crew-details-profile-copy">
            <div className="crew-details-identity">
              <strong>#{crewResult.crew?.number || '—'}</strong>
              <Star
                className="crew-details-star"
                size={24}
                fill="currentColor"
                aria-label="Избранный экипаж"
              />
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
            <strong>{overallText}</strong>
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
                  const retirement = retirementDetails(result, views, resultLabel);
                  const status = retirement?.reason || (retirement ? 'Сход' : '');
                  return (
                    <div className="crew-details-stage-row" role="row" key={view.key}>
                      <span role="cell">{view.name.replace(/^Спецучасток\s*/i, 'СУ')}</span>
                      <span role="cell">{result ? view.results.indexOf(result) + 1 : '—'}</span>
                      <span className={status ? 'retired' : ''} role="cell">
                        {status || result?.formattedTime || 'Не пройден'}
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
      </Dialog.Content>
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
                const retirement = retirementDetails(result, views, resultLabel);
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
                          ? retirement?.reason || (retired ? 'Сход' : 'Сход после финиша')
                          : result.formattedTime || 'Время пока недоступно'}
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
                                      ? retirementDetails(stageResult, views, resultLabel)?.reason || 'Сход'
                                      : stageResult.formattedTime || 'Время пока недоступно'}
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
        </div>
      </div>
      <div className="crew-results-mobile-list">
        {rankedRows.length ? (
          rankedRows.map(({ result }) => {
            const id = crewIdOf(result, resultLabel);
            const crew = result.crew || {};
            const retirement = retirementDetails(result, views, resultLabel);
            const subscribed = subscriptions.some(
              item => item.key === subscriptionKey(data.eventId, id),
            );
            const place = selectedClassResults.indexOf(result) + 1;
            return (
              <article
                key={id}
                className="crew-result-card"
                data-crew-row
                data-search={`${crew.number || ''} ${resultLabel(result)} ${crew.car || ''} ${result?.discipline?.name || ''}`.toLocaleLowerCase(
                  'ru',
                )}
              >
                <Button
                  type="button"
                  className="crew-result-card-main"
                  onClick={() => setSelectedCrew(result)}
                  aria-label={`Открыть результаты экипажа ${resultLabel(result)}`}
                >
                  <span className="crew-result-card-place">{place}</span>
                  <span className="crew-result-card-copy">
                    <strong>
                      №{crew.number || '—'} {resultLabel(result)}
                    </strong>
                    <small>{crew.car || 'Автомобиль не указан'}</small>
                    <small>{result?.discipline?.name || 'Зачёт не указан'}</small>
                  </span>
                  <span className={`crew-result-card-time ${retirement ? 'is-retired' : ''}`}>
                    {retirement ? (
                      <>
                        <span className="crew-result-card-retirement-label">Сход</span>
                        {retirement.reason && (
                          <span className="crew-result-card-retirement-reason">
                            {retirement.reason}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        {result.formattedTime || '—'}
                        <small>{gapFromLeader(result, selectedClassResults)}</small>
                      </>
                    )}
                  </span>
                  <ChevronRight className="crew-result-card-chevron" size={18} aria-hidden="true" />
                </Button>
                <Button
                  className={`crew-result-star ${subscribed ? 'active' : ''}`}
                  aria-label={`${subscribed ? 'Отписаться от экипажа' : 'Следить за экипажем'}: ${resultLabel(result)}`}
                  onClick={() => void onToggleSubscription(result)}
                >
                  <Star size={18} fill={subscribed ? 'currentColor' : 'none'} aria-hidden="true" />
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
