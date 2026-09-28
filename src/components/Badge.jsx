import React from 'react';
import './Badge.css';

export default function Badge({ children, variant = '', className = '', ...props }) {
  return <span {...props} className={`badge ${variant} ${className}`.trim()}>{children}</span>;
}
