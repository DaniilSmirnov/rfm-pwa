import React from 'react';
import './EmptyState.css';

export default function EmptyState({ children, className = '', as: Element = 'p', ...props }) {
  return (
    <Element {...props} className={`empty-state muted ${className}`.trim()}>
      {children}
    </Element>
  );
}
