export function createStageSelection({onChange}={}) {
  let selectedStageKey=null;

  return {
    get key(){ return selectedStageKey; },
    select(stageKey,meta={}){
      const next=stageKey?String(stageKey):null;
      selectedStageKey=next;
      onChange?.(next,meta);
      return next;
    },
    clear(meta={}){
      selectedStageKey=null;
      onChange?.(null,meta);
    }
  };
}
