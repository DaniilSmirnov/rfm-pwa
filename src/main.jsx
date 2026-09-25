import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './react/App.jsx';

const root=document.getElementById('reactRoot');
if(!root) throw new Error('React root is missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
