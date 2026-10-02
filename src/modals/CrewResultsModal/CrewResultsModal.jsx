import './CrewResultsModal.css';
import * as Dialog from '@radix-ui/react-dialog';
import React, { useMemo, useRef, useState } from 'react';
import SearchField from '../../components/SearchField/SearchField.jsx';
import Button from '../../components/Button/Button.jsx';
import SelectField from '../../components/SelectField/SelectField.jsx';
import AsmgLogo from '../../components/AsmgLogo/AsmgLogo.jsx';
import { formatRetirementReason } from '../../views/ResultsScreen/logic/crew-results.js';
import { crewIdOf, crewTimeLabel, gapFromLeader, retirementLabel } from './logic/formatters.js';
import { ChevronRight, Star } from 'lucide-react';
import CrewDetailsDialog from '../../components/CrewDetailsDialog/CrewDetailsDialog.jsx';



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
          <colgroup>
            <col className="crew-results-col-place" />
            <col className="crew-results-col-name" />
            <col className="crew-results-col-car" />
            <col className="crew-results-col-time" />
            <col className="crew-results-col-subscription" />
          </colgroup>
          <thead>
            <tr>
              <th className="crew-results-place" scope="col">
                Место
              </th>
              <th className="crew-results-name" scope="col">
                Экипаж
              </th>
              <th className="crew-results-car" scope="col">
                Автомобиль / зачёт
              </th>
              <th className="crew-results-time" scope="col" id="crewResultsTimeHeading">
                {activeView?.name || 'Время'}
              </th>
              <th className="crew-results-subscription" scope="col">
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
                      <td className="crew-results-car">
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
                      <td className="crew-results-subscription">
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
            <span className="asmg-results-prefix">Результаты от</span>
            <AsmgLogo className="asmg-results-logo" />
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
