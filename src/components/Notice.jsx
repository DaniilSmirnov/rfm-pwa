import React from 'react';
import './Notice.css';

export default function Notice({ children, variant = 'info', className = '', as: Element = 'aside', ...props }) {
  return <Element {...props} className={`notice notice--${variant} ${className}`.trim()}>{children}</Element>;
}
