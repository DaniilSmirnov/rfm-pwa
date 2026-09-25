import { commonHeaders, json } from './http.js';

const ASMG_ORIGIN='https://asmg.ru';

function balancedEnd(text,start){
  const opening=text[start];
  const closing=opening==='['?']':opening==='{'?'}':null;
  if(!closing)return -1;
  let depth=0,inString=false,escaped=false;
  for(let i=start;i<text.length;i++){
    const ch=text[i];
    if(inString){
      if(escaped)escaped=false;
      else if(ch==='\\')escaped=true;
      else if(ch==='"')inString=false;
      continue;
    }
    if(ch==='"')inString=true;
    else if(ch===opening)depth++;
    else if(ch===closing&&--depth===0)return i+1;
  }
  return -1;
}

function flightText(html){
  const chunks=[];
  const marker='self.__next_f.push(';
  let cursor=0;
  while((cursor=html.indexOf(marker,cursor))>=0){
    const start=cursor+marker.length;
    const end=balancedEnd(html,start);
    cursor=end>start?end:start+marker.length;
    if(end<0)continue;
    try{
      const entry=JSON.parse(html.slice(start,end));
      if(Array.isArray(entry)&&entry[0]===1&&typeof entry[1]==='string')chunks.push(entry[1]);
    }catch{}
  }
  return chunks.join('');
}

export function parseAsmgResultsHtml(html,eventId){
  if(typeof html!=='string'||html.length>5_000_000)throw new Error('ASMG results page is unavailable or too large');
  const payload=flightText(html);
  const property='"eventResults":';
  const marker=payload.indexOf(property);
  if(marker<0)throw new Error('ASMG results data was not found');
  let start=marker+property.length;
  while(/\s/.test(payload[start]||''))start++;
  const end=balancedEnd(payload,start);
  if(end<0)throw new Error('ASMG results data is incomplete');
  const eventResults=JSON.parse(payload.slice(start,end));
  if(!Array.isArray(eventResults))throw new Error('ASMG results have an unsupported format');
  const titleMatch=payload.match(/"tournamentTitle"\s*:\s*("(?:\\.|[^"\\])*")/);
  let tournamentTitle='';
  try{tournamentTitle=titleMatch?JSON.parse(titleMatch[1]):'';}catch{}
  return {
    eventId:String(eventId),
    tournamentTitle,
    eventResults:eventResults.slice(0,100).map(stage=>({
      specialStage:{
        id:String(stage?.specialStage?.id??''),
        name:String(stage?.specialStage?.name??''),
        distance:String(stage?.specialStage?.distance??'')
      },
      results:(Array.isArray(stage?.results)?stage.results:[]).slice(0,500).map(item=>({
        id:String(item?.id??''),
        time:Number(item?.time)||0,
        speed:Number(item?.speed)||0,
        goingOff:Boolean(item?.goingOff),
        goingOffAfterSu:Boolean(item?.goingOffAfterSu),
        reasonGoingOff:String(item?.reasonGoingOff??''),
        crew:{
          id:String(item?.crew?.id??''),
          number:String(item?.crew?.number??''),
          car:String(item?.crew?.car??''),
          pilot:{firstName:String(item?.crew?.pilot?.firstName??''),lastName:String(item?.crew?.pilot?.lastName??'')},
          navigator:{firstName:String(item?.crew?.navigator?.firstName??''),lastName:String(item?.crew?.navigator?.lastName??'')}
        },
        discipline:{name:String(item?.discipline?.name??'')},
        formattedTime:String(item?.formattedTime??''),
        formattedTimePenalty:String(item?.formattedTimePenalty??''),
        formattedFromLeader:String(item?.formattedFromLeader??''),
        formattedTimeFromPrevious:String(item?.formattedTimeFromPrevious??''),
        suStartTime:String(item?.suStartTime??''),
        suEndTime:String(item?.suEndTime??'')
      }))
    }))
  };
}

export async function proxyAsmgResults(request,url){
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:commonHeaders({allow:'GET, HEAD'})});
  const match=url.pathname.match(/^\/api\/asmg\/race\/(\d+)\/results$/);
  if(!match)return json({ok:false,error:'Unsupported ASMG API path'},404);
  const eventId=match[1];
  let response;
  try{
    response=await fetch(`${ASMG_ORIGIN}/race/${eventId}/results`,{
      method:'GET',headers:{accept:'text/html','user-agent':'RallyFans-Companion/0.9'},redirect:'follow',
      signal:AbortSignal.timeout(9000)
    });
  }catch(error){return json({ok:false,error:'ASMG results unavailable',detail:String(error?.message||error)},502);}
  if(!response.ok)return json({ok:false,error:`ASMG HTTP ${response.status}`},502);
  try{
    const results=parseAsmgResultsHtml(await response.text(),eventId);
    results.updatedAt=new Date().toISOString();
    return new Response(JSON.stringify(results),{status:200,headers:commonHeaders({'content-type':'application/json; charset=utf-8','cache-control':'no-store'})});
  }catch(error){return json({ok:false,error:'Could not parse ASMG results',detail:String(error?.message||error)},502);}
}
