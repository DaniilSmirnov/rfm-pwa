import { RALLY_PACK_PHASES } from './rally-pack.js';

export function rallyPackProgressText(event,formatBytes=value=>String(value||0)){
  switch(event?.phase){
    case RALLY_PACK_PHASES.RACE: return 'Данные гонки…';
    case RALLY_PACK_PHASES.YANDEX: return 'Точки Yandex…';
    case RALLY_PACK_PHASES.MAP:
      if(event.status==='progress') return `Карта ${event.done||0}/${event.total||0} · ${formatBytes(event.bytes||0)}`;
      return 'Офлайн-карта…';
    case RALLY_PACK_PHASES.ASSETS:
      if(event.background) return 'Материалы скачиваются в фоне…';
      if(event.status==='progress') return `Материалы ${event.done||0}/${event.total||0}`;
      return `Материалы 0/${event.total||0}`;
    case RALLY_PACK_PHASES.SAVE: return 'Сохраняю Rally Pack…';
    case RALLY_PACK_PHASES.REMINDERS: return 'Обновляю напоминания…';
    case RALLY_PACK_PHASES.CLEANUP: return 'Завершаю обновление…';
    case RALLY_PACK_PHASES.DONE: return event.assetDownload?.background?'Rally Pack сохранён · файлы в фоне':'Rally Pack готов ✓';
    default: return 'Собираю Rally Pack…';
  }
}
