import { classifyStageScheduleEvent } from '../../MapView/logic/schedule-stages.js';

export function reminderLeadLabel(minutes) {
  if (minutes === 60) return '1 час';
  return `${minutes} мин`;
}

export function buildRaceReminders(pkg, subscribed = new Set(), now = Date.now()) {
  const schedule = asArray(pkg?.original?.schedule);
  const raceId = pkg?.raceId ?? pkg?.id ?? 'race';
  const reminders = [];
  const leadTimes = [60, 30, 15];
  if (!subscribed.size) return reminders;

  for (const item of schedule) {
    for (const event of asArray(item?.events)) {
      const classified = classifyStageScheduleEvent(item, event);
      if (!classified || !subscribed.has(classified.stageKey)) continue;

      const startsAt = parseScheduleDateTime(item?.date, event?.time, pkg);
      if (!startsAt) continue;

      for (const leadMinutes of leadTimes) {
        const dueAt = startsAt.getTime() - leadMinutes * 60 * 1000;
        if (dueAt <= now || dueAt > now + 14 * 24 * 60 * 60 * 1000) continue;

        const action = classified.kind === 'close' ? 'Закрытие' : 'Открытие';
        const stageSlug =
          classified.stageName
            .toLowerCase()
            .replace(/[^a-zа-яё0-9]+/gi, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 40) || 'stage';

        reminders.push({
          dueAt,
          title: String(pkg?.name || 'Rally Fans Map'),
          body: `${action} ${classified.stageName} через ${reminderLeadLabel(leadMinutes)} · ${String(event?.time || '').trim()}`,
          url: '/',
          tag: `rfm-race-${raceId}-${classified.kind}-${stageSlug}-${leadMinutes}`,
          ttlSeconds: Math.max(1800, leadMinutes * 60),
        });
      }
    }
  }

  return reminders.sort((a, b) => a.dueAt - b.dueAt).slice(0, 192);
}
