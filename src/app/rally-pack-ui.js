import { RALLY_PACK_PHASES } from './rally-pack.js';

function progressPercent(done,total){
  const safeDone=Number(done)||0;
  const safeTotal=Number(total)||0;
  if(safeTotal<=0) return 0;
  if(safeDone>=safeTotal) return 100;
  return Math.max(0,Math.floor((safeDone/safeTotal)*100));
}

export function rallyPackProgressText(event,formatBytes=value=>String(value||0)){
  switch(event?.phase){
    case RALLY_PACK_PHASES.RACE: return 'Данные гонки…';
    case RALLY_PACK_PHASES.YANDEX: return 'Точки Yandex…';
    case RALLY_PACK_PHASES.MAP:
      if(event.status==='progress') return `Карта ${progressPercent(event.done,event.total)}% · ${formatBytes(event.bytes||0)}`;
      return 'Офлайн-карта…';
    case RALLY_PACK_PHASES.ASSETS:
      if(event.background) return 'Материалы скачиваются в фоне…';
      if(event.status==='progress') return `Материалы ${progressPercent(event.done,event.total)}%`;
      return 'Материалы 0%';
    case RALLY_PACK_PHASES.SAVE: return 'Сохраняю Rally Pack…';
    case RALLY_PACK_PHASES.REMINDERS: return 'Обновляю напоминания…';
    case RALLY_PACK_PHASES.CLEANUP: return 'Завершаю обновление…';
    case RALLY_PACK_PHASES.DONE: return event.assetDownload?.background?'Rally Pack сохранён · файлы в фоне':'Rally Pack готов ✓';
    default: return 'Собираю Rally Pack…';
  }
}
