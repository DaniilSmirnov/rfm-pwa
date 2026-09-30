import React, { forwardRef } from 'react';
import './Button.css';

const Button = forwardRef(function Button(
  { type = 'button', className = 'button', loading = false, disabled = false, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      {...props}
      type={type}
      className={className}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {children}
    </button>
  );
});

export default Button;
