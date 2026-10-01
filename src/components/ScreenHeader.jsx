import React from 'react';
import { ArrowLeft } from 'lucide-react';
import Button from './Button.jsx';
import './ScreenHeader.css';

export function useEdgeSwipeBack(onBack, enabled = true) {
  React.useEffect(() => {
    if (!enabled) return undefined;
    let start = null;
    const onTouchStart = event => {
      const touch = event.changedTouches[0];
      if (touch && touch.clientX <= 48) start = { x: touch.clientX, y: touch.clientY };
    };
    const onTouchEnd = event => {
      if (!start) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      start = null;
      if (dx >= 60 && Math.abs(dy) <= 80) onBack();
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [enabled, onBack]);
}

export default function ScreenHeader({ title, onBack }) {
  return (
    <header className="screen-header" aria-label={title}>
      <Button className="screen-header-back" type="button" aria-label="Назад" onClick={onBack}>
        <ArrowLeft aria-hidden="true" size={22} strokeWidth={2.2} />
      </Button>
      <h1>{title}</h1>
    </header>
  );
}
