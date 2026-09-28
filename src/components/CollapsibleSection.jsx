import React from 'react';
import './CollapsibleSection.css';

export default function CollapsibleSection({
  summary,
  children,
  className = '',
  bodyClassName = '',
  open,
  onToggle,
  ...props
}) {
  return (
    <details {...props} className={`collapsible-section ${className}`.trim()} open={open} onToggle={onToggle}>
      <summary>{summary}</summary>
      <div className={`collapsible-body ${bodyClassName}`.trim()}>{children}</div>
    </details>
  );
}
