import React from 'react';
import './Notice.css';

export default function Notice({ children, variant = 'info', className = '', as: Element = 'div', ...props }) {
  return <Element {...props} className={`notice notice--${variant} ${className}`.trim()}>{children}</Element>;
}
