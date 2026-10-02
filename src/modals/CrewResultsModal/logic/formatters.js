import { formatRetirementReason } from '../../../../views/ResultsScreen/logic/crew-results.js';

export function gapFromLeaderresult, rows) {
  if (result?.goingOff || result?.goingOffAfterSu) return '—';
  if (result?.formattedFromLeader) return crewTimeLabel(result.formattedFromLeader);
  const resultTime = Number(result?.time);
  if (!Number.isFinite(resultTime)) return 'Нет информации';
  const leader = rows.find(row => !row?.goingOff && !row?.goingOffAfterSu && Number(row?.time) > 0);
  if (!leader || leader === result) return 'лидер';
  const difference = Math.max(0, resultTime - Number(leader.time));
  if (!Number.isFinite(difference)) return 'Нет информации';
  return `+${(difference / 1000).toFixed(1)} с`;
}

export function retirementLabelresult) {
  return formatRetirementReason(result);
}

export function crewTimeLabelvalue) {
  const text = String(value ?? '').trim();
  return text && !text.includes('NaN') ? text : 'Нет информации';
}

export function crewIdOfresult, resultLabel) {
  return String(result?.crew?.id || result?.crew?.number || resultLabel(result));
}
