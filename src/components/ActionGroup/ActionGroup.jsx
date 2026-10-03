import React from 'react';
import './ActionGroup.css';

export default function ActionGroup({ children, className = '', ...props }) {
  return (
    <div {...props} role={props.role || 'group'} className={`actions ${className}`.trim()}>
      {children}
    </div>
  );
}
