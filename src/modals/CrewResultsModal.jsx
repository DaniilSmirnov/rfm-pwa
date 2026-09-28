import './CrewResultsModal.css';
import React, { useEffect, useRef } from 'react';
import SearchField from '../components/SearchField.jsx';
import Button from '../components/Button.jsx';

export default function CrewResultsModal({open,onClose,data,views,activeView,className,onClassChange,onStageChange,classes,query,onQueryChange,visible,selectedClassResults,subscriptions,onToggleSubscription,resultLabel,subscriptionKey}){
  const dialog=useRef(null);
  const searchRef=useRef(null);
  useEffect(()=>{
    const node=dialog.current;
    if(!node)return;
    if(open&&!node.open){node.showModal();requestAnimationFrame(()=>searchRef.current?.focus());}
    else if(!open&&node.open)node.close();
  },[open]);
  return (
    <dialog ref={dialog} className="crew-results-dialog" aria-labelledby="crewResultsDialogTitle" onClose={onClose}>
      <header className="crew-results-dialog-head"><div><h2 id="crewResultsDialogTitle">Результаты экипажей</h2><p className="muted small">Выбери класс, чтобы увидеть весь его состав.</p></div><Button className="button crew-results-close" type="button" aria-label="Закрыть результаты" onClick={()=>dialog.current?.close()}>×</Button></header>
      <div className="crew-results-toolbar"><label className="sr-only" htmlFor="crewResultsStage">Спецучасток</label><select id="crewResultsStage" className="crew-results-stage" value={activeView?.key||''} onChange={event=>{onStageChange(event.target.value);onClassChange('');}}>{views.map(view=><option key={view.key} value={view.key}>{view.name}</option>)}</select><label className="sr-only" htmlFor="crewResultsDialogClass">Класс</label><select id="crewResultsDialogClass" className="crew-results-stage" value={className} onChange={event=>onClassChange(event.target.value)}><option value="">Все классы</option>{classes.map(name=><option key={name} value={name}>{name}</option>)}</select><SearchField ref={searchRef} id="crewResultsSearch" placeholder="Поиск по экипажу, номеру или машине…" aria-label="Поиск экипажа" value={query} onChange={event=>onQueryChange(event.target.value)}/></div>
      <div className="crew-results-table-wrap"><table className="crew-results-table"><thead><tr><th scope="col">Место</th><th scope="col">Экипаж</th><th scope="col">Автомобиль / зачёт</th><th scope="col" id="crewResultsTimeHeading">{activeView?.name||'Время'}</th><th scope="col"><span className="sr-only">Подписка</span></th></tr></thead><tbody className="crew-results-body">
        {visible.length?visible.map(result=>{
          const crew=result?.crew||{};
          const id=String(crew.id||crew.number||resultLabel(result));
          const subscribed=subscriptions.some(item=>item.key===subscriptionKey(data.eventId,id));
          const place=selectedClassResults.indexOf(result)+1;
          const retired=result.goingOff||result.goingOffAfterSu;
          return <tr data-crew-row data-search={`${crew.number||''} ${resultLabel(result)} ${crew.car||''} ${result?.discipline?.name||''}`.toLocaleLowerCase('ru')} key={id}><td className="crew-results-place">{retired?'—':place}</td><td className="crew-results-name"><strong>{resultLabel(result)}</strong><small>№ {crew.number||'—'}</small></td><td>{crew.car||'Автомобиль не указан'}<small>{result?.discipline?.name||'Зачёт не указан'}</small></td><td className="crew-results-time">{retired?(result.reasonGoingOff||(result.goingOff?'Сход':'Сход после финиша')):(result.formattedTime||'Время пока недоступно')}{result.formattedTimePenalty&&<small>Штраф {result.formattedTimePenalty}</small>}</td><td><Button className={`button compact crew-subscribe-button ${subscribed?'downloaded':''}`} type="button" data-subscribe={id} data-name={resultLabel(result)} aria-label={`${subscribed?'Отписаться от экипажа':'Следить за экипажем'}: ${resultLabel(result)}`} onClick={()=>void onToggleSubscription(result)}>{subscribed?'Отписаться':'Подписаться'}</Button></td></tr>;
        }):<tr><td colSpan="5" className="crew-results-empty">Экипажи по этому запросу не найдены.</td></tr>}
      </tbody></table></div>
    </dialog>
  );
}
