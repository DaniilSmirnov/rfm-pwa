import React from 'react';
import Button from '../Button/Button.jsx';
import './EmptyScreenState.css';

export default function EmptyScreenState({
  title = 'Нет скачанных гонок',
  description = 'Скачай Rally Pack в разделе управления гонками, чтобы открыть этот экран.',
  actionLabel = 'Перейти к скачиванию',
  onAction,
  className = '',
}) {
  return (
    <div className={`empty-screen-state ${className}`.trim()} role="region" aria-label={title}>
      <strong>{title}</strong>
      <p>{description}</p>
      {onAction && (
        <Button type="button" className="button primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
