import React from 'react';
import './Panel.css';

export default function Panel({ as: Element = 'section', className = '', children, ...props }) {
  return <Element {...props} className={`rfm-section ${className}`.trim()}>{children}</Element>;
}
