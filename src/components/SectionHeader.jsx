import React from 'react';
import './SectionHeader.css';

export default function SectionHeader({ children, className = '' }) {
  return <div className={`section-head ${className}`.trim()}>{children}</div>;
}
