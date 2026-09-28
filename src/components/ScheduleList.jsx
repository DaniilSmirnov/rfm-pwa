import './ScheduleList.css';
import React, { useState } from 'react';
import Button from './Button.jsx';
import EmptyState from './EmptyState.jsx';
import { stageIdentity } from '../app/schedule.js';
import {
  subscribedStageKeys,
  setStageSubscribed,
  walletStageKeys,
  setWalletStageAdded,
} from '../app/preferences.js';
import { isIOSDevice } from '../app/pwa.js';
import {
  getPushSubscription,
  setPushStatus,
  scheduleRaceReminders,
  enablePushNotifications,
} from '../app/push-client.js';
import { syncWalletStage } from '../app/wallet-client.js';

const asArray = value =>
  Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
const WALLET_STAGE_FEATURE_ENABLED = false;

export default function ScheduleList({
  pkg,
  schedule = asArray(pkg?.original?.schedule),
  selectedStageKey = null,
  onStageSelect,
}) {
  const [busyKey, setBusyKey] = useState('');
  const [revision, setRevision] = useState(0);
  if (!schedule.length)
    return (
      <div className="schedule-list">
        <EmptyState>Расписание отсутствует.</EmptyState>
      </div>
    );
  const subscribed = subscribedStageKeys(pkg);
  const walletAdded = walletStageKeys(pkg);
  const showWallet = WALLET_STAGE_FEATURE_ENABLED && isIOSDevice();

  const togglePush = async (item, stage) => {
    setBusyKey(stage.key);
    try {
      const shouldEnable = !subscribedStageKeys(pkg).has(stage.key);
      if (shouldEnable && !(await getPushSubscription())) {
        await enablePushNotifications();
        if (!(await getPushSubscription())) return;
      }
      setStageSubscribed(pkg, stage.key, shouldEnable);
      const result = await scheduleRaceReminders(pkg);
      setPushStatus(
        shouldEnable
          ? `${stage.name}: уведомления включены · за 60, 30 и 15 минут.`
          : `${stage.name}: уведомления выключены.`,
        'geo-ok',
      );
      if (result.stored === 0 && shouldEnable)
        setPushStatus(
          `${stage.name}: подписка сохранена, но будущих событий открытия/закрытия пока нет.`,
        );
      setRevision(value => value + 1);
    } catch (error) {
      setPushStatus(`Не удалось изменить подписку ${stage.name}: ${error.message}`, 'geo-error');
    } finally {
      setBusyKey('');
    }
  };

  const toggleWallet = async (item, stage) => {
    setBusyKey(stage.key);
    try {
      const data = await syncWalletStage(pkg, item, stage, { openPass: true });
      setWalletStageAdded(pkg, stage.key);
      setPushStatus(
        data.updated
          ? `${stage.name}: карточка Wallet обновлена.`
          : `${stage.name}: карточка Wallet подготовлена.`,
        'geo-ok',
      );
      setRevision(value => value + 1);
    } catch (error) {
      setPushStatus(`Wallet · ${stage.name}: ${error.message}`, 'geo-error');
    } finally {
      setBusyKey('');
    }
  };

  return (
    <div className="schedule-list" data-revision={revision}>
      {schedule.map((item, index) => {
        const events = asArray(item.events);
        const stage = stageIdentity(item);
        const isSubscribed = Boolean(stage && subscribed.has(stage.key));
        const isInWallet = Boolean(stage && walletAdded.has(stage.key));
        return (
          <article
            key={`${stage?.key || item.date || 'event'}-${index}`}
            className={`schedule-item${stage && selectedStageKey === stage.key ? ' selected-stage' : ''}`}
            data-stage-row={stage?.key}
            tabIndex={stage && onStageSelect ? 0 : undefined}
            role={stage && onStageSelect ? 'button' : undefined}
            aria-label={stage && onStageSelect ? `Открыть ${stage.name} на карте` : undefined}
            onClick={
              stage && onStageSelect
                ? () => onStageSelect(stage.key, { source: 'schedule' })
                : undefined
            }
            onKeyDown={
              stage && onStageSelect
                ? event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onStageSelect(stage.key, { source: 'schedule' });
                    }
                  }
                : undefined
            }
          >
            {item.date && <div className="date-header">{item.date}</div>}
            <div className="schedule-location-row">
              <div className="location">{item.location || 'Событие'}</div>
              {stage && (
                <div className="stage-actions">
                  <Button
                    className={`button compact stage-push-toggle ${isSubscribed ? 'subscribed' : ''}`}
                    data-stage-key={stage.key}
                    type="button"
                    aria-label={isSubscribed ? 'Выключить уведомления' : 'Включить уведомления'}
                    disabled={busyKey === stage.key}
                    onClick={event => {
                      event.stopPropagation();
                      void togglePush(item, stage);
                    }}
                  >
                    <span aria-hidden="true">🔔</span>
                    <span>{isSubscribed ? 'Включены' : 'Уведомлять'}</span>
                  </Button>
                  {showWallet && (
                    <Button
                      className={`button compact stage-wallet-toggle ${isInWallet ? 'subscribed' : ''}`}
                      data-wallet-stage-key={stage.key}
                      type="button"
                      aria-label={`Добавить ${stage.name} в Apple Wallet`}
                      disabled={busyKey === stage.key}
                      onClick={event => {
                        event.stopPropagation();
                        void toggleWallet(item, stage);
                      }}
                    >
                      <img className="rfm-icon" src="/assets/wallet.svg" alt="" />
                      <span>{isInWallet ? 'Wallet ✓' : 'Wallet'}</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
            {item.coordinates && <div className="coordinates-line">{item.coordinates}</div>}
            <div className="event-list">
              {events.map((event, eventIndex) => (
                <div key={`${event.time || ''}-${eventIndex}`}>
                  <time>{event.time || ''}</time>
                  <span>{event.text || ''}</span>
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
