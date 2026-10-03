import './BootDiagnostics.css';
import * as Dialog from '@radix-ui/react-dialog';
import React, { useEffect, useState } from 'react';
import ActionGroup from '../../components/ActionGroup/ActionGroup.jsx';
import Button from '../../components/Button/Button.jsx';
import { bootSnapshot, collectStorageDiagnostics, markBoot } from '../../app/boot-diagnostics.js';
import { loadErudaVisibility, setErudaVisible } from '../../app/eruda.js';

function describeDetail(detail) {
  if (detail == null) return '';
  return typeof detail === 'string' ? detail : JSON.stringify(detail);
}

export default function BootDiagnostics({ open, onClose }) {
  const [, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [erudaVisible, setErudaVisibleState] = useState(() => loadErudaVisibility());
  useEffect(() => {
    const update = () => setRevision(value => value + 1);
    window.addEventListener('rfm:boot-mark', update);
    return () => {
      window.removeEventListener('rfm:boot-mark', update);
    };
  }, [open]);
  const snapshot = bootSnapshot();

  const refreshStorage = async () => {
    setBusy(true);
    setStorageError('');
    try {
      await collectStorageDiagnostics();
      setRevision(value => value + 1);
    } catch (error) {
      const message = String(error?.message || error);
      setStorageError(message);
      markBoot('storage-diagnostics-failed', { message });
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(bootSnapshot(), null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  const exportReport = () => {
    const blob = new Blob([JSON.stringify(bootSnapshot(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rfm-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const toggleEruda = async event => {
    const visible = event.target.checked;
    setErudaVisibleState(visible);
    try {
      await setErudaVisible(visible);
    } catch {
      setErudaVisibleState(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) onClose?.();
      }}
    >
      <Dialog.Overlay asChild>
        <div
          id="bootDiagnosticsModal"
          className="boot-diagnostics-modal"
          onClick={event => {
            if (event.target === event.currentTarget) onClose?.();
          }}
        >
          <Dialog.Content asChild aria-labelledby="bootDiagnosticsTitle" aria-modal="true">
            <div className="boot-diagnostics-card">
              <div className="boot-diagnostics-head">
                <div>
                  <div className="eyebrow">СЛУЖЕБНЫЙ ЭКРАН</div>
                  <Dialog.Title asChild>
                    <h2 id="bootDiagnosticsTitle">Boot diagnostics</h2>
                  </Dialog.Title>
                </div>
                <Dialog.Close asChild>
                  <Button id="bootDiagnosticsClose" className="button compact" type="button">
                    Закрыть
                  </Button>
                </Dialog.Close>
              </div>
              <div id="bootDiagnosticsList" className="boot-diagnostics-list">
                {snapshot.marks.length ? (
                  snapshot.marks.map((entry, index) => {
                    const previous = index ? snapshot.marks[index - 1].ms : 0;
                    return (
                      <div className="boot-diagnostic-row" key={`${entry.name}-${index}`}>
                        <span>{entry.name}</span>
                        <strong>{entry.ms} ms</strong>
                        <em>+{entry.ms - previous} ms</em>
                        {entry.detail != null && <small>{describeDetail(entry.detail)}</small>}
                      </div>
                    );
                  })
                ) : (
                  <p className="muted">Пока нет отметок.</p>
                )}
              </div>
              <pre id="bootDiagnosticsMeta" className="boot-diagnostics-meta">
                {[
                  `online: ${snapshot.meta.online}`,
                  `display: ${snapshot.meta.displayMode}`,
                  `navigation: ${snapshot.meta.navigationType}`,
                  `SW controlled: ${snapshot.meta.serviceWorkerControlled}`,
                  `DOMContentLoaded: ${snapshot.meta.domContentLoadedMs} ms`,
                  `load: ${snapshot.meta.loadEventMs} ms`,
                  snapshot.meta.userAgent,
                  snapshot.storage
                    ? `\nЛокальные данные:\n${JSON.stringify(snapshot.storage, null, 2)}`
                    : storageError
                      ? `\nОшибка диагностики: ${storageError}`
                      : '\nЛокальные данные: нажми «Проверить хранилище».',
                ].join('\n')}
              </pre>
              <label className="boot-diagnostics-eruda">
                <input type="checkbox" checked={erudaVisible} onChange={toggleEruda} />
                <span>Показывать кнопку Eruda</span>
              </label>
              <ActionGroup>
                <Button
                  id="bootDiagnosticsRefreshPackages"
                  className="button"
                  type="button"
                  onClick={() => window.dispatchEvent(new Event('rfm:refresh-local-data'))}
                >
                  Перечитать сохранённые данные
                </Button>
                <Button
                  id="bootDiagnosticsRefresh"
                  className="button"
                  type="button"
                  disabled={busy}
                  onClick={() => void refreshStorage()}
                >
                  {busy ? 'Проверяю…' : 'Проверить хранилище'}
                </Button>
                <Button
                  id="bootDiagnosticsCopy"
                  className="button"
                  type="button"
                  onClick={() => void copy()}
                >
                  {copied ? 'Скопировано' : 'Скопировать диагностику'}
                </Button>
                <Button
                  id="bootDiagnosticsExport"
                  className="button"
                  type="button"
                  onClick={exportReport}
                >
                  Скачать отчёт
                </Button>
              </ActionGroup>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Overlay>
    </Dialog.Root>
  );
}
