import {
  basemapField,
  basemapNumber,
  featureSortRank,
  minZoomOpacity,
  roadClass,
  roadKind,
  poiIconExpression,
} from './expressions.js';

const BASEMAP_FONT_STACK = ['Roboto', 'Arial', 'Helvetica', 'Noto Sans'];

function labelNameExpression() {
  return [
    'to-string',
    [
      'coalesce',
      ['get', 'name:ru'],
      ['get', 'name_ru'],
      ['get', 'name'],
      ['get', 'name:en'],
      ['get', 'name_en'],
      '',
    ],
  ];
}

function labelRefExpression() {
  return ['to-string', ['coalesce', ['get', 'ref'], '']];
}

function roadLabelExpression() {
  const name = labelNameExpression();
  const ref = labelRefExpression();
  return ['case', ['!=', name, ''], name, ref];
}

function placeClassExpression() {
  return basemapField('kind_detail', 'kind', 'place', 'class', 'type', 'category', 'subclass');
}

function placeSortKey() {
  const populationRank = basemapNumber(['population_rank'], 0);
  return [
    'case',
    ['!=', basemapField('capital'), ''],
    -1000,
    ['>', populationRank, 0],
    ['-', 100, populationRank],
    featureSortRank(9999),
  ];
}

function placeTextSize(major = true) {
  const populationRank = basemapNumber(['population_rank'], 0);
  const capital = ['!=', basemapField('capital'), ''];
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    major ? 5 : 9,
    [
      'case',
      capital,
      major ? 13 : 11,
      ['>=', populationRank, 14],
      major ? 12 : 10.5,
      ['>=', populationRank, 10],
      major ? 11 : 10,
      major ? 10.5 : 9.5,
    ],
    14,
    [
      'case',
      capital,
      major ? 16 : 13,
      ['>=', populationRank, 14],
      major ? 15 : 12.5,
      ['>=', populationRank, 10],
      major ? 14 : 12,
      major ? 13 : 11,
    ],
  ];
}

function nativeTextPaint(color = '#45484c', haloWidth = 1) {
  return {
    'text-color': color,
    'text-halo-color': 'rgba(255,255,255,0.96)',
    'text-halo-width': haloWidth,
    'text-halo-blur': 0.35,
    'text-opacity': minZoomOpacity(1),
  };
}

function nativePointLabelLayout(textField, textSize, sortKey = featureSortRank(9999)) {
  return {
    'text-field': textField,
    'text-font': BASEMAP_FONT_STACK,
    'text-size': textSize,
    'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
    'text-radial-offset': 0.65,
    'text-padding': 2,
    'text-max-width': 12,
    'text-allow-overlap': false,
    'text-ignore-placement': false,
    'symbol-sort-key': sortKey,
  };
}

function poiDetailedLabel() {
  const name = labelNameExpression();
  const iata = basemapField('iata');
  const cuisine = basemapField('cuisine');
  const religion = basemapField('religion');
  const sport = basemapField('sport');
  return [
    'concat',
    name,
    ['case', ['!=', iata, ''], ['concat', '\nIATA ', iata], ''],
    ['case', ['!=', cuisine, ''], ['concat', '\n', cuisine], ''],
    ['case', ['!=', religion, ''], ['concat', '\n', religion], ''],
    ['case', ['!=', sport, ''], ['concat', '\n', sport], ''],
  ];
}

export function nativeBasemapLabelLayers(source, layerName, index) {
  const id = String(layerName).replace(/[^a-z0-9_-]/gi, '-');
  const n = String(layerName || '').toLowerCase();
  const prefix = `base-label-${index}-${id}`;
  const name = labelNameExpression();
  const hasName = ['!=', name, ''];
  const klass = roadClass();
  const sortKey = featureSortRank(9999);

  if (n.includes('place')) {
    const place = placeClassExpression();
    const label = ['case', ['!=', basemapField('capital'), ''], ['concat', '★ ', name], name];
    const major = ['country', 'state', 'province', 'city', 'town'];
    return [
      {
        id: `${prefix}-major`,
        type: 'symbol',
        source,
        'source-layer': layerName,
        minzoom: 5,
        filter: ['all', hasName, ['in', place, ['literal', major]]],
        layout: {
          ...nativePointLabelLayout(label, placeTextSize(true), placeSortKey()),
          'text-padding': 4,
        },
        paint: nativeTextPaint('#25282c', 1),
      },
      {
        id: `${prefix}-minor`,
        type: 'symbol',
        source,
        'source-layer': layerName,
        minzoom: 8,
        filter: ['all', hasName, ['!', ['in', place, ['literal', major]]]],
        layout: nativePointLabelLayout(label, placeTextSize(false), placeSortKey()),
        paint: nativeTextPaint('#4d5156', 0.8),
      },
    ];
  }

  if (n.includes('road')) {
    const roadText = roadLabelExpression();
    const shield = basemapField('shield_text');
    const oneway = basemapField('oneway');
    const hasRoadText = ['!=', roadText, ''];
    const major = [
      'motorway',
      'motorway_link',
      'trunk',
      'trunk_link',
      'primary',
      'primary_link',
      'secondary',
      'secondary_link',
      'tertiary',
      'tertiary_link',
    ];
    const notRail = ['!', ['in', roadKind(), ['literal', ['rail', 'aeroway', 'ferry']]]];
    return [
      {
        id: `${prefix}-major`,
        type: 'symbol',
        source,
        'source-layer': layerName,
        minzoom: 8,
        filter: [
          'all',
          ['==', ['geometry-type'], 'LineString'],
          notRail,
          hasRoadText,
          ['in', klass, ['literal', major]],
        ],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 320,
          'symbol-sort-key': sortKey,
          'text-field': roadText,
          'text-font': BASEMAP_FONT_STACK,
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9.5, 12, 10.5, 16, 12.5],
          'text-letter-spacing': 0.01,
          'text-max-angle': 35,
          'text-keep-upright': true,
          'text-padding': 2,
        },
        paint: nativeTextPaint('#5f5b55', 0.9),
      },
      {
        id: `${prefix}-local`,
        type: 'symbol',
        source,
        'source-layer': layerName,
        minzoom: 11,
        filter: [
          'all',
          ['==', ['geometry-type'], 'LineString'],
          notRail,
          hasRoadText,
          ['!', ['in', klass, ['literal', major]]],
        ],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 230,
          'symbol-sort-key': sortKey,
          'text-field': roadText,
          'text-font': BASEMAP_FONT_STACK,
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 8.8, 14, 11.2],
          'text-letter-spacing': 0.01,
          'text-max-angle': 40,
          'text-keep-upright': true,
          'text-padding': 1,
        },
        paint: nativeTextPaint('#64615c', 0.8),
      },
      {
        id: `${prefix}-shield`,
        type: 'symbol',
        source,
        'source-layer': layerName,
        minzoom: 8,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], notRail, ['!=', shield, '']],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 520,
          'symbol-sort-key': sortKey,
          'text-field': shield,
          'text-font': BASEMAP_FONT_STACK,
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 8.5, 14, 10.5],
          'text-padding': 5,
          'text-keep-upright': true,
        },
        paint: {
          ...nativeTextPaint('#3d5064', 2.2),
          'text-halo-color': 'rgba(255,255,255,.98)',
        },
      },
      {
        id: `${prefix}-oneway`,
        type: 'symbol',
        source,
        'source-layer': layerName,
        minzoom: 12,
        filter: [
          'all',
          ['==', ['geometry-type'], 'LineString'],
          notRail,
          ['!', ['in', oneway, ['literal', ['', '0', 'false', 'no']]]],
        ],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 130,
          'symbol-sort-key': sortKey,
          'text-field': ['case', ['==', oneway, '-1'], '←', '→'],
          'text-font': BASEMAP_FONT_STACK,
          'text-size': 13,
          'text-keep-upright': false,
          'text-padding': 1,
        },
        paint: {
          ...nativeTextPaint('#77736c', 0.6),
          'text-opacity': minZoomOpacity(0.7),
        },
      },
    ];
  }

  if (n.includes('poi')) {
    const iata = basemapField('iata');
    const hasUseful = ['any', hasName, ['!=', iata, '']];
    return [
      {
        id: `${prefix}-icon`,
        type: 'symbol',
        source,
        'source-layer': layerName,
        minzoom: 10,
        filter: ['==', ['geometry-type'], 'Point'],
        layout: {
          ...nativePointLabelLayout(
            poiIconExpression(),
            ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 10.5],
            sortKey,
          ),
          'text-radial-offset': 0,
        },
        paint: {
          ...nativeTextPaint('#394047', 0.8),
          'text-opacity': minZoomOpacity(0.92),
        },
      },
      {
        id: `${prefix}-label`,
        type: 'symbol',
        source,
        'source-layer': layerName,
        minzoom: 11,
        filter: ['all', ['==', ['geometry-type'], 'Point'], hasUseful],
        layout: nativePointLabelLayout(
          ['step', ['zoom'], ['case', hasName, name, iata], 14, poiDetailedLabel()],
          ['interpolate', ['linear'], ['zoom'], 11, 8.8, 14, 10.8],
          sortKey,
        ),
        paint: nativeTextPaint('#4d5156', 0.8),
      },
    ];
  }

  if (n.includes('physical_point')) {
    const ele = basemapField('ele', 'elevation');
    const text = [
      'case',
      ['all', hasName, ['!=', ele, '']],
      ['concat', name, ' · ', ele, ' м'],
      name,
    ];
    return [
      {
        id: `${prefix}-physical`,
        type: 'symbol',
        source,
        'source-layer': layerName,
        minzoom: 9,
        filter: ['all', ['==', ['geometry-type'], 'Point'], hasName],
        layout: nativePointLabelLayout(
          text,
          ['interpolate', ['linear'], ['zoom'], 9, 9.2, 14, 11],
          sortKey,
        ),
        paint: nativeTextPaint('#625b50', 0.8),
      },
    ];
  }

  if (n.includes('water')) {
    return [
      {
        id: `${prefix}-water-line`,
        type: 'symbol',
        source,
        'source-layer': layerName,
        minzoom: 9,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], hasName],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 320,
          'symbol-sort-key': sortKey,
          'text-field': name,
          'text-font': BASEMAP_FONT_STACK,
          'text-size': ['interpolate', ['linear'], ['zoom'], 9, 9.2, 14, 11.5],
          'text-max-angle': 35,
          'text-keep-upright': true,
          'text-padding': 2,
        },
        paint: nativeTextPaint('#47798f', 0.7),
      },
      {
        id: `${prefix}-water-area`,
        type: 'symbol',
        source,
        'source-layer': layerName,
        minzoom: 8,
        filter: ['all', ['!=', ['geometry-type'], 'LineString'], hasName],
        layout: nativePointLabelLayout(
          name,
          ['interpolate', ['linear'], ['zoom'], 8, 9.2, 14, 11.5],
          sortKey,
        ),
        paint: nativeTextPaint('#47798f', 0.7),
      },
    ];
  }

  if (n.includes('transit') || n.includes('rail')) {
    const text = ['case', hasName, name, labelRefExpression()];
    return [
      {
        id: `${prefix}-transit`,
        type: 'symbol',
        source,
        'source-layer': layerName,
        minzoom: 10,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!=', text, '']],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 360,
          'symbol-sort-key': sortKey,
          'text-field': text,
          'text-font': BASEMAP_FONT_STACK,
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 14, 10.5],
          'text-max-angle': 35,
          'text-keep-upright': true,
          'text-padding': 2,
        },
        paint: nativeTextPaint('#5a5855', 0.75),
      },
    ];
  }

  if (n.includes('boundar')) {
    return [
      {
        id: `${prefix}-boundary`,
        type: 'symbol',
        source,
        'source-layer': layerName,
        minzoom: 7,
        filter: ['all', ['==', ['geometry-type'], 'LineString'], hasName],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 600,
          'symbol-sort-key': sortKey,
          'text-field': name,
          'text-font': BASEMAP_FONT_STACK,
          'text-size': ['interpolate', ['linear'], ['zoom'], 7, 8.5, 14, 10.5],
          'text-max-angle': 35,
          'text-keep-upright': true,
          'text-padding': 3,
        },
        paint: nativeTextPaint('#72777d', 0.75),
      },
    ];
  }

  if (n.includes('natural') || n.includes('landuse') || n.includes('landcover')) {
    const sport = basemapField('sport');
    const text = [
      'step',
      ['zoom'],
      name,
      13,
      [
        'case',
        ['all', hasName, ['!=', sport, '']],
        ['concat', name, '\n', sport],
        hasName,
        name,
        sport,
      ],
    ];
    return [
      {
        id: `${prefix}-land`,
        type: 'symbol',
        source,
        'source-layer': layerName,
        minzoom: 10,
        filter: ['any', hasName, ['!=', sport, '']],
        layout: nativePointLabelLayout(
          text,
          ['interpolate', ['linear'], ['zoom'], 10, 8.8, 14, 10.5],
          sortKey,
        ),
        paint: nativeTextPaint('#5f7259', 0.7),
      },
    ];
  }

  if (n.includes('building')) {
    const number = basemapField('addr_housenumber');
    const buildingKind = basemapField('kind');
    return [
      {
        id: `${prefix}-building`,
        type: 'symbol',
        source,
        'source-layer': layerName,
        minzoom: 14,
        filter: ['all', hasName, ['!=', buildingKind, 'address']],
        layout: nativePointLabelLayout(name, 9.2, sortKey),
        paint: nativeTextPaint('#69645e', 0.7),
      },
      {
        id: `${prefix}-address`,
        type: 'symbol',
        source,
        'source-layer': layerName,
        minzoom: 14,
        filter: ['all', ['==', buildingKind, 'address'], ['!=', number, '']],
        layout: nativePointLabelLayout(number, 9, sortKey),
        paint: nativeTextPaint('#5e5a55', 0.7),
      },
    ];
  }

  return [];
}
