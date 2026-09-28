import React from 'react';
import './Button.css';

export default function Button({
  type = 'button',
  className = 'button',
  loading = false,
  disabled = false,
  children,
  ...props
}) {
  return (
    <button
      {...props}
      type={type}
      className={className}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {children}
    </button>
  );
}
