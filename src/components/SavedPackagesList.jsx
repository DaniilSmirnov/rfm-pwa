import React from 'react';
import Button from './Button.jsx';
import EmptyState from './EmptyState.jsx';
import { formatBytes } from '../app/format.js';
import './SavedPackages.css';

export default function SavedPackagesList({ app }) {
  if (!app.packages.length) return <EmptyState>Пока ничего не скачано.</EmptyState>;
  if (!app.visiblePackages.length) return <EmptyState>Ничего не найдено.</EmptyState>;
  return (
    <>
      {app.visiblePackages.map(p => {
        const summary = [p.summary?.stage, p.summary?.dates, p.summary?.city]
          .filter(Boolean)
          .join(' · ');
        return (
          <Button className="package-row" key={p.id} onClick={() => app.selectPackage(p.id)}>
            <span>
              <strong className="package-name">{p.name}</strong>
              <small className="package-meta">
                {summary || `${p.geojson?.features?.length || 0} объектов · ${formatBytes(p.size)}`}
              </small>
            </span>
            <img className="row-arrow" src="/assets/arrow-right.svg" alt="" />
          </Button>
        );
      })}
    </>
  );
}
