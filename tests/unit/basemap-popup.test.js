import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import BasemapPopup, { getBasemapPopupData } from '../../src/components/BasemapPopup/BasemapPopup.jsx';

describe('basemap popup component', () => {
  it('renders feature values as text and preserves the displayed metadata', () => {
    const feature = {
      properties: {
        'name:ru': '<Участок>',
        kind: 'highway',
        is_bridge: true,
        population: 1200,
        empty: '',
      },
      layer: { 'source-layer': 'transportation' },
    };
    const markup = renderToStaticMarkup(React.createElement(BasemapPopup, { feature }));

    expect(markup).toContain('&lt;Участок&gt;');
    expect(markup).not.toContain('Объект карты');
    expect(markup).toContain('<b>да</b>');
    expect(markup).toContain('<b>1200</b>');
    expect(markup).toContain('transportation');
    expect(markup).not.toContain('empty');
  });

  it('includes administrative level only for boundary source layers', () => {
    const data = getBasemapPopupData({
      properties: { kind_detail: '4' },
      layer: { 'source-layer': 'boundary' },
    });

    expect(data.fields).toContainEqual(['Admin level', '4']);
  });
});
