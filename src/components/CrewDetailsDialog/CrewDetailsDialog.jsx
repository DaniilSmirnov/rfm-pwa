import './CrewDetailsDialog.css';
import * as Dialog from '@radix-ui/react-dialog';
import React from 'react';
import { Star } from 'lucide-react';
import Button from '../../components/Button/Button.jsx';
import ScreenHeader, { useEdgeSwipeBack } from '../../components/ScreenHeader/ScreenHeader.jsx';
import AsmgLogo from '../../components/AsmgLogo/AsmgLogo.jsx';
import {
  crewIdOf,
  crewTimeLabel,
  gapFromLeader,
  retirementLabel,
} from '../../modals/CrewResultsModal/logic/formatters.js';

export default function CrewDetailsDialog({
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
          <footer className="crew-details-footer" aria-label="Результаты от ASMG">
            <span className="asmg-results-prefix">Результаты от</span>
            <AsmgLogo className="asmg-results-logo crew-details-footer-logo" ariaHidden />
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
