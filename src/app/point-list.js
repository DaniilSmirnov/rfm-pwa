export function pointFeatures(featureCollection) {
  return (featureCollection?.features || []).filter(
    feature =>
      feature?.geometry?.type === 'Point' &&
      Array.isArray(feature.geometry.coordinates) &&
      feature.geometry.coordinates.length >= 2,
  );
}

export function pointFromFeature(feature) {
  return {
    lat: Number(feature.geometry.coordinates[1]),
    lon: Number(feature.geometry.coordinates[0]),
    name: String(feature.properties?.name || feature.properties?.title || 'Точка'),
  };
}
