const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function labels(changes=[]){return changes.map(x=>esc(x.label||x.key)).join(' · ');}

export function renderRallyPackUpdateStatus(pkg){
  const panel=$('rallyPackUpdatePanel'),title=$('rallyPackUpdateTitle'),body=$('rallyPackUpdateBody');
  if(!panel||!title||!body) return;
  const pending=pkg?.pendingUpdate;
  const applied=pkg?.lastSmartUpdate;
  if(pending?.changes?.length){
    panel.hidden=false;
    title.textContent='ЕСТЬ ОБНОВЛЕНИЕ RALLY PACK';
    const reason=pending.reason==='geometry'
      ? 'Изменилась геометрия: нужен полный Rally Pack update.'
      : pending.reason==='yandex'
        ? 'Изменилась карта Yandex Constructor: нужен полный Rally Pack update.'
        : 'Не все новые материалы удалось скачать в фоне.';
    body.innerHTML=`<strong>${labels(pending.changes)}</strong><p class="muted small">${esc(reason)} Старый офлайн-пакет остаётся активным.</p>`;
    return;
  }
  if(applied?.changes?.length){
    panel.hidden=false;
    title.textContent='RALLY PACK ОБНОВЛЁН В ФОНЕ';
    body.innerHTML=`<strong>${labels(applied.changes)}</strong><p class="muted small">Все необходимые данные были скачаны, поэтому изменения уже применены.</p>`;
    return;
  }
  panel.hidden=true;
  body.innerHTML='';
}
