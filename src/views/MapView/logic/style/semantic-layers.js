import { basemapField, basemapNumber, basemapTruthy, featureSortRank, minZoomOpacity, basemapClass, roadClass, roadKind, roadWidth, roadColor, landColor, poiColor, waterClass, waterWidth, boundaryWidth } from './expressions.js';

export function semanticBasemapLayers(source, layerName, index) {
  const id = String(layerName).replace(/[^a-z0-9_-]/gi, '-');
  const n = String(layerName || '').toLowerCase();
  const prefix = `base-${index}-${id}`;
  const sortKey = featureSortRank(0);

  if (n.includes('earth') || n === 'land' || n.includes('mask')) {
    return [
      {
        id: `${prefix}-fill`,
        type: 'fill',
        source,
        'source-layer': layerName,
        filter: ['==', ['geometry-type'], 'Polygon'],
        layout: { 'fill-sort-key': sortKey },
        paint: { 'fill-color': '#f2f0e9', 'fill-opacity': minZoomOpacity(1) },
      },
    ];
  }

  if (n.includes('water')) {
    const reservoir = ['any', basemapTruthy('reservoir'), ['==', waterClass(), 'reservoir']];
    const tunneled = basemapTruthy('tunnel');
    const bridged = basemapTruthy('bridge');
    return [
      {
        id: `${prefix}-fill`,
        type: 'fill',
        source,
        'source-layer': layerName,
        filter: ['==', ['geometry-type'], 'Polygon'],
        layout: { 'fill-sort-key': sortKey },
        paint: {
          'fill-color': [
            'case',
            basemapTruthy('alkaline'),
            '#c9d8cf',
            reservoir,
            '#b3d5e4',
            '#b9dce9',
          ],
          'fill-opacity': minZoomOpacity(0.96),
        },
      },
      {
        id: `${prefix}-line`,
        type: 'line',
        source,
        'source-layer': layerName,
        filter: [
          'all',
          ['==', ['geometry-type'], 'LineString'],
          ['!', basemapTruthy('intermittent')],
        ],
        layout: { 'line-sort-key': sortKey },
        paint: {
          'line-color': ['case', tunneled, '#9ab7c2', bridged, '#5f9eb8', '#79afc5'],
          'line-width': waterWidth(),
          'line-opacity': minZoomOpacity(0.95),
        },
      },
      {
        id: `${prefix}-intermittent`,
        type: 'line',
        source,
        'source-layer': layerName,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], basemapTruthy('intermittent')],
        layout: { 'line-sort-key': sortKey },
        paint: {
          'line-color': '#79afc5',
          'line-width': waterWidth(),
          'line-dasharray': [2, 2],
          'line-opacity': minZoomOpacity(0.8),
        },
      },
    ];
  }

  if (n.includes('landuse') || n.includes('landcover') || n.includes('natural')) {
    return [
      {
        id: `${prefix}-fill`,
        type: 'fill',
        source,
        'source-layer': layerName,
        filter: ['==', ['geometry-type'], 'Polygon'],
        layout: { 'fill-sort-key': sortKey },
        paint: { 'fill-color': landColor(), 'fill-opacity': minZoomOpacity(0.9) },
      },
      {
        id: `${prefix}-line`,
        type: 'line',
        source,
        'source-layer': layerName,
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { 'line-sort-key': sortKey },
        paint: {
          'line-color': '#a9b69d',
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 14, 1.4],
          'line-opacity': minZoomOpacity(0.85),
        },
      },
      {
        id: `${prefix}-point`,
        type: 'circle',
        source,
        'source-layer': layerName,
        filter: ['==', ['geometry-type'], 'Point'],
        layout: { 'circle-sort-key': sortKey },
        paint: {
          'circle-color': '#78906f',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 1.5, 14, 3.5],
          'circle-opacity': minZoomOpacity(0.8),
        },
      },
    ];
  }

  if (n.includes('building')) {
    const buildingSort = ['+', ['*', basemapNumber(['layer'], 0), 10000], sortKey];
    return [
      {
        id: `${prefix}-fill`,
        type: 'fill',
        source,
        'source-layer': layerName,
        filter: ['==', ['geometry-type'], 'Polygon'],
        minzoom: 12,
        layout: { 'fill-sort-key': buildingSort },
        paint: {
          'fill-color': '#d6d0c9',
          'fill-opacity': minZoomOpacity(0.92),
          'fill-outline-color': '#bcb4ac',
        },
      },
    ];
  }

  if (n.includes('road')) {
    const kind = roadKind();
    const cls = roadClass();
    const railDetails = [
      'disused',
      'funicular',
      'light_rail',
      'miniature',
      'monorail',
      'narrow_gauge',
      'preserved',
      'subway',
      'tram',
    ];
    const isRail = ['any', ['==', kind, 'rail'], ['in', cls, ['literal', railDetails]]];
    const isAeroway = [
      'any',
      ['==', kind, 'aeroway'],
      ['in', cls, ['literal', ['runway', 'taxiway']]],
    ];
    const isFerry = ['==', kind, 'ferry'];
    const roadFilter = [
      'all',
      ['==', ['geometry-type'], 'LineString'],
      ['!', isRail],
      ['!', isAeroway],
      ['!', isFerry],
    ];
    const bridgeFilter = ['all', ...roadFilter.slice(1), basemapTruthy('is_bridge')];
    const tunnelFilter = ['all', ...roadFilter.slice(1), basemapTruthy('is_tunnel')];

    return [
      {
        id: `${prefix}-casing`,
        type: 'line',
        source,
        'source-layer': layerName,
        filter: roadFilter,
        layout: { 'line-sort-key': sortKey },
        paint: {
          'line-color': '#aaa49b',
          'line-width': roadWidth(1.6),
          'line-opacity': minZoomOpacity(0.95),
        },
      },
      {
        id: `${prefix}-bridge-casing`,
        type: 'line',
        source,
        'source-layer': layerName,
        filter: bridgeFilter,
        layout: { 'line-sort-key': sortKey },
        paint: {
          'line-color': '#817b73',
          'line-width': roadWidth(2.6),
          'line-opacity': minZoomOpacity(0.9),
        },
      },
      {
        id: `${prefix}-road`,
        type: 'line',
        source,
        'source-layer': layerName,
        filter: roadFilter,
        layout: { 'line-sort-key': sortKey },
        paint: {
          'line-color': roadColor(),
          'line-width': roadWidth(),
          'line-opacity': minZoomOpacity(0.98),
        },
      },
      {
        id: `${prefix}-tunnel`,
        type: 'line',
        source,
        'source-layer': layerName,
        filter: tunnelFilter,
        layout: { 'line-sort-key': sortKey },
        paint: {
          'line-color': '#8e8a83',
          'line-width': roadWidth(0.3),
          'line-dasharray': [2, 2],
          'line-opacity': minZoomOpacity(0.55),
        },
      },
      {
        id: `${prefix}-rail`,
        type: 'line',
        source,
        'source-layer': layerName,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], isRail],
        layout: { 'line-sort-key': sortKey },
        paint: {
          'line-color': ['case', ['!=', basemapField('service'), ''], '#85817b', '#66635f'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.8, 14, 2.4],
          'line-dasharray': [2, 1.5],
          'line-opacity': minZoomOpacity(0.92),
        },
      },
      {
        id: `${prefix}-aeroway`,
        type: 'line',
        source,
        'source-layer': layerName,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], isAeroway],
        layout: { 'line-sort-key': sortKey },
        paint: {
          'line-color': ['match', cls, 'runway', '#aaa7a3', 'taxiway', '#c1beb9', '#b5b2ad'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.3, 14, 5],
          'line-opacity': minZoomOpacity(0.9),
        },
      },
      {
        id: `${prefix}-ferry`,
        type: 'line',
        source,
        'source-layer': layerName,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], isFerry],
        layout: { 'line-sort-key': sortKey },
        paint: {
          'line-color': '#4f91ad',
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 14, 2.2],
          'line-dasharray': [3, 2],
          'line-opacity': minZoomOpacity(0.85),
        },
      },
    ];
  }

  if (n.includes('transit') || n.includes('rail')) {
    return [
      {
        id: `${prefix}-rail`,
        type: 'line',
        source,
        'source-layer': layerName,
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { 'line-sort-key': sortKey },
        paint: {
          'line-color': '#72706d',
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.7, 14, 2.2],
          'line-dasharray': [2, 1.5],
          'line-opacity': minZoomOpacity(0.9),
        },
      },
    ];
  }

  if (n.includes('boundar')) {
    const common = {
      type: 'line',
      source,
      'source-layer': layerName,
      layout: { 'line-sort-key': sortKey },
    };
    return [
      {
        id: `${prefix}-line`,
        ...common,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!', basemapTruthy('disputed')]],
        paint: {
          'line-color': [
            'match',
            basemapField('kind'),
            'country',
            '#777d85',
            'region',
            '#8e949b',
            'county',
            '#a8adb2',
            'locality',
            '#b7bbc0',
            '#9ea2a8',
          ],
          'line-width': boundaryWidth(),
          'line-opacity': minZoomOpacity(0.82),
        },
      },
      {
        id: `${prefix}-disputed`,
        ...common,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], basemapTruthy('disputed')],
        paint: {
          'line-color': '#9b7777',
          'line-width': boundaryWidth(),
          'line-dasharray': [3, 2],
          'line-opacity': minZoomOpacity(0.9),
        },
      },
    ];
  }

  if (n.includes('physical_line')) {
    return [
      {
        id: `${prefix}-line`,
        type: 'line',
        source,
        'source-layer': layerName,
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { 'line-sort-key': sortKey },
        paint: {
          'line-color': [
            'match',
            basemapClass(),
            'cliff',
            '#857c72',
            'ridge',
            '#9b8b76',
            'river',
            '#79afc5',
            'stream',
            '#79afc5',
            '#aaa49b',
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.5, 14, 1.8],
          'line-opacity': minZoomOpacity(0.82),
        },
      },
    ];
  }

  if (n.includes('poi')) {
    return [
      {
        id: `${prefix}-point`,
        type: 'circle',
        source,
        'source-layer': layerName,
        filter: ['==', ['geometry-type'], 'Point'],
        minzoom: 10,
        layout: { 'circle-sort-key': sortKey },
        paint: {
          'circle-color': poiColor(),
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2.4, 14, 4.8],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.2,
          'circle-opacity': minZoomOpacity(0.96),
        },
      },
    ];
  }

  if (n.includes('place')) {
    return [
      {
        id: `${prefix}-point`,
        type: 'circle',
        source,
        'source-layer': layerName,
        filter: ['==', ['geometry-type'], 'Point'],
        layout: { 'circle-sort-key': sortKey },
        paint: {
          'circle-color': ['case', ['!=', basemapField('capital'), ''], '#34383c', '#555b61'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 14, 3.4],
          'circle-opacity': minZoomOpacity(0.8),
        },
      },
    ];
  }

  if (n.includes('physical_point')) {
    return [
      {
        id: `${prefix}-point`,
        type: 'circle',
        source,
        'source-layer': layerName,
        filter: ['==', ['geometry-type'], 'Point'],
        minzoom: 9,
        layout: { 'circle-sort-key': sortKey },
        paint: {
          'circle-color': '#706756',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 2, 14, 4],
          'circle-stroke-color': '#f7f4ed',
          'circle-stroke-width': 1,
          'circle-opacity': minZoomOpacity(0.95),
        },
      },
    ];
  }

  return [
    {
      id: `${prefix}-fill`,
      type: 'fill',
      source,
      'source-layer': layerName,
      filter: ['==', ['geometry-type'], 'Polygon'],
      layout: { 'fill-sort-key': sortKey },
      paint: { 'fill-color': '#e5e5e5', 'fill-opacity': minZoomOpacity(0.72) },
    },
    {
      id: `${prefix}-line`,
      type: 'line',
      source,
      'source-layer': layerName,
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-sort-key': sortKey },
      paint: {
        'line-color': '#9ca3aa',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 14, 1.4],
        'line-opacity': minZoomOpacity(0.82),
      },
    },
    {
      id: `${prefix}-point`,
      type: 'circle',
      source,
      'source-layer': layerName,
      filter: ['==', ['geometry-type'], 'Point'],
      layout: { 'circle-sort-key': sortKey },
      paint: {
        'circle-color': '#7f878e',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 1.4, 14, 3.2],
        'circle-opacity': minZoomOpacity(0.8),
      },
    },
  ];
}
