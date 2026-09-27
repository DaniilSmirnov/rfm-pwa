import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './react/App.jsx';
import { applyTheme, loadThemePreference, resolveTheme } from './app/preferences.js';

const systemTheme=window.matchMedia?.('(prefers-color-scheme: dark)');
systemTheme?.addEventListener?.('change',event=>{
  if(loadThemePreference()===null) applyTheme(resolveTheme(null,event.matches));
});

const root=document.getElementById('reactRoot');
if(!root) throw new Error('React root is missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
