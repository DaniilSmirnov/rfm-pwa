export function elevationGridStep(min, max) {
  const span = Math.max(0, Number(max) - Number(min));
  if (span > 600) return 100;
  if (span > 300) return 50;
  return 25;
}

export function elevationGridLevels(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  const step = elevationGridStep(min, max);
  const gridMin = Math.floor(min / step) * step;
  const gridMax = Math.ceil(max / step) * step;
  const levels = [];
  for (let h = gridMin; h <= gridMax; h += step) levels.push(h);
  return levels;
}

export function profileChartGeometry(profile) {
  const pts = profile.points || [];
  if (pts.length < 2) return null;
  const levels = elevationGridLevels(profile.min, profile.max);
  const gridMin = levels[0] ?? profile.min;
  const gridMax = levels.at(-1) ?? profile.max;
  const W = 900,
    H = 240,
    PL = 58,
    PR = 24,
    PT = 18,
    PB = 30;
  const range = Math.max(1, gridMax - gridMin),
    distance = Math.max(1, profile.distance);
  const x = d => PL + (W - PL - PR) * (d / distance);
  const y = h => PT + (H - PT - PB) * (1 - (h - gridMin) / range);
  return {
    width: W,
    height: H,
    left: PL,
    right: W - PR,
    distanceLabel: `${(profile.distance / 1000).toFixed(1)} км`,
    points: pts.map(point => ({
      x: Number(x(point.distance).toFixed(1)),
      y: Number(y(point.elevation).toFixed(1)),
    })),
    levels: levels.map(value => ({ value, y: Number(y(value).toFixed(1)) })),
  };
}
