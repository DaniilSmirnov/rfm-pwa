import React, { forwardRef } from 'react';
import './SearchField.css';

const SearchField = forwardRef(function SearchField({ className = '', ...props }, ref) {
  return <input {...props} ref={ref} type={props.type || 'search'} className={`search ${className}`.trim()} />;
});

export default SearchField;
