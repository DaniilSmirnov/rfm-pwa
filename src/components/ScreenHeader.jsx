import React from 'react';
import { ArrowLeft } from 'lucide-react';
import Button from './Button.jsx';
import './ScreenHeader.css';

export default function ScreenHeader({ title, onBack }) {
  return (
    <header className="screen-header" aria-label={title}>
      <Button
        className="screen-header-back"
        type="button"
        aria-label="Назад"
        onClick={onBack}
      >
        <ArrowLeft aria-hidden="true" size={22} strokeWidth={2.2} />
      </Button>
      <h1>{title}</h1>
    </header>
  );
}
