import React, { forwardRef } from 'react';
import './SelectField.css';

const SelectField = forwardRef(function SelectField({ className = '', ...props }, ref) {
  return <select {...props} ref={ref} className={`select-field ${className}`.trim()} />;
});

export default SelectField;
