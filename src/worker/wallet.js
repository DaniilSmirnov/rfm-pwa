import { bytesToBase64Url, readJson, commonHeaders, json } from './http.js';

function walletStore(env){
  return env?.WALLET_STORE || env?.PUSH_SUBSCRIPTIONS || null;
}

function walletConfigured(env){
  return Boolean(
    env?.WALLET_PASS_TYPE_IDENTIFIER &&
    env?.WALLET_TEAM_IDENTIFIER &&
    env?.WALLET_SIGNER_URL
  );
}

function walletSerialSafe(value){
  return String(value||'')
    .replace(/[^a-zA-Z0-9._-]/g,'-')
    .replace(/-+/g,'-')
    .slice(0,120);
}

function walletPassKey(serialNumber){
  return `wallet-pass:${walletSerialSafe(serialNumber)}`;
}

function walletRegPassKey(passTypeIdentifier,serialNumber,deviceLibraryIdentifier){
  return `wallet-reg-pass:${passTypeIdentifier}:${walletSerialSafe(serialNumber)}:${deviceLibraryIdentifier}`;
}

function walletRegDeviceKey(deviceLibraryIdentifier,passTypeIdentifier,serialNumber){
  return `wallet-reg-device:${deviceLibraryIdentifier}:${passTypeIdentifier}:${walletSerialSafe(serialNumber)}`;
}

function randomToken(bytes=24){
  const raw=new Uint8Array(bytes);
  crypto.getRandomValues(raw);
  return bytesToBase64Url(raw);
}

function walletAuthOk(request,record){
  const auth=request.headers.get('authorization')||'';
  return Boolean(record?.authenticationToken && auth===`ApplePass ${record.authenticationToken}`);
}

async function loadWalletPass(env,serialNumber){
  const store=walletStore(env);
  if(!store) return null;
  return store.get(walletPassKey(serialNumber),'json');
}

async function saveWalletPass(env,record){
  const store=walletStore(env);
  if(!store) throw new Error('Wallet storage binding is missing');
  await store.put(walletPassKey(record.serialNumber),JSON.stringify(record));
}

async function walletRegistrationsForPass(env,passTypeIdentifier,serialNumber){
  const store=walletStore(env);
  if(!store) return [];
  const prefix=`wallet-reg-pass:${passTypeIdentifier}:${walletSerialSafe(serialNumber)}:`;
  let cursor;
  const records=[];
  do{
    const page=await store.list({prefix,cursor,limit:1000});
    for(const key of page.keys){
      const value=await store.get(key.name,'json');
      if(value) records.push(value);
    }
    cursor=page.list_complete?undefined:page.cursor;
  }while(cursor);
  return records;
}

async function notifyWalletUpdate(env,record){
  if(!env?.WALLET_PUSH_PROVIDER_URL) return {ok:false,skipped:true,reason:'WALLET_PUSH_PROVIDER_URL is not configured'};
  const regs=await walletRegistrationsForPass(env,record.passTypeIdentifier,record.serialNumber);
  const pushTokens=[...new Set(regs.map(x=>x?.pushToken).filter(Boolean))];
  if(!pushTokens.length) return {ok:true,skipped:true,devices:0};

  const headers={'content-type':'application/json'};
  if(env.WALLET_PUSH_PROVIDER_TOKEN) headers.authorization=`Bearer ${env.WALLET_PUSH_PROVIDER_TOKEN}`;

  const res=await fetch(env.WALLET_PUSH_PROVIDER_URL,{
    method:'POST',
    headers,
    body:JSON.stringify({
      passTypeIdentifier:record.passTypeIdentifier,
      serialNumber:record.serialNumber,
      pushTokens
    })
  });
  return {ok:res.ok,status:res.status,devices:pushTokens.length};
}

function walletField(key,label,value,extra={}){
  if(value==null || value==='') return null;
  return {key,label,value:String(value),...extra};
}

function walletLocation(value,relevantText){
  const lat=Number(value?.lat),lon=Number(value?.lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)) return null;
  return {latitude:lat,longitude:lon,relevantText};
}

function buildWalletPassJson(env,requestUrl,record){
  const s=record.state||{};
  const locations=[
    walletLocation(s.startLocation,`${s.stageName||'СУ'} · старт`),
    walletLocation(s.finishLocation,`${s.stageName||'СУ'} · финиш`)
  ].filter(Boolean);

  const scheduleText=(Array.isArray(s.events)?s.events:[])
    .filter(e=>e?.time||e?.text)
    .map(e=>[e.time,e.text].filter(Boolean).join(' · '))
    .join('\n');

  const secondaryFields=[
    walletField('race','Ралли',s.raceName),
    walletField('date','Дата',s.date)
  ].filter(Boolean);

  const auxiliaryFields=[
    walletField('close','Закрытие',s.closeAt,{dateStyle:'PKDateStyleShort',timeStyle:'PKDateStyleShort'}),
    walletField('open','Открытие',s.openAt,{dateStyle:'PKDateStyleShort',timeStyle:'PKDateStyleShort'})
  ].filter(Boolean);

  const backFields=[
    walletField('start_time','Старт',s.startAt),
    walletField('finish_time','Финиш',s.finishAt),
    walletField('start_geo','Координаты старта',s.startLocation?`${s.startLocation.lat}, ${s.startLocation.lon}`:null),
    walletField('finish_geo','Координаты финиша',s.finishLocation?`${s.finishLocation.lat}, ${s.finishLocation.lon}`:null),
    walletField('schedule','Расписание',scheduleText)
  ].filter(Boolean);

  return {
    formatVersion:1,
    passTypeIdentifier:env.WALLET_PASS_TYPE_IDENTIFIER,
    serialNumber:record.serialNumber,
    teamIdentifier:env.WALLET_TEAM_IDENTIFIER,
    organizationName:'Rally Fans Map',
    description:`${s.raceName||'Rally Fans Map'} · ${s.stageName||'СУ'}`,
    logoText:'Rally Fans Map Offline',
    foregroundColor:'rgb(255,255,255)',
    backgroundColor:'rgb(15,15,15)',
    labelColor:'rgb(210,210,210)',
    webServiceURL:`${requestUrl.origin}/api/wallet/v1`,
    authenticationToken:record.authenticationToken,
    relevantDate:s.relevantAt||undefined,
    locations:locations.length?locations:undefined,
    eventTicket:{
      primaryFields:[walletField('stage','СУ',s.stageName)].filter(Boolean),
      secondaryFields,
      auxiliaryFields,
      backFields
    }
  };
}

async function signedWalletPassResponse(env,requestUrl,record){
  if(!walletConfigured(env)) {
    return json({
      ok:false,
      error:'Wallet signing is not configured',
      required:['WALLET_PASS_TYPE_IDENTIFIER','WALLET_TEAM_IDENTIFIER','WALLET_SIGNER_URL']
    },503);
  }

  const headers={'content-type':'application/json'};
  if(env.WALLET_SIGNER_TOKEN) headers.authorization=`Bearer ${env.WALLET_SIGNER_TOKEN}`;

  const pass=buildWalletPassJson(env,requestUrl,record);
  const signer=await fetch(env.WALLET_SIGNER_URL,{
    method:'POST',
    headers,
    body:JSON.stringify({
      pass,
      state:record.state,
      assets:{
        iconUrl:`${requestUrl.origin}/rfm/icon.png`,
        logoUrl:`${requestUrl.origin}/rfm/icon.png`
      }
    })
  });

  if(!signer.ok){
    const detail=await signer.text().catch(()=>'');
    return json({ok:false,error:'Wallet signer failed',status:signer.status,detail:detail.slice(0,500)},502);
  }

  const body=await signer.arrayBuffer();
  return new Response(body,{
    status:200,
    headers:commonHeaders({
      'content-type':'application/vnd.apple.pkpass',
      'content-disposition':`attachment; filename="${record.serialNumber}.pkpass"`,
      'cache-control':'no-store'
    })
  });
}

async function handleWalletApi(request,env,url){
  const store=walletStore(env);

  if(url.pathname==='/api/wallet/config'){
    if(request.method!=='GET') return json({ok:false,error:'Method not allowed'},405);
    return json({
      ok:true,
      enabled:walletConfigured(env),
      storage:Boolean(store),
      passTypeIdentifier:env?.WALLET_PASS_TYPE_IDENTIFIER||null,
      updates:{
        webService:true,
        pushProvider:Boolean(env?.WALLET_PUSH_PROVIDER_URL)
      }
    });
  }

  if(url.pathname==='/api/wallet/stage'){
    if(request.method!=='POST') return json({ok:false,error:'Method not allowed'},405);
    if(!store) return json({ok:false,error:'Wallet storage binding is missing'},503);

    const body=await readJson(request);
    const serialNumber=walletSerialSafe(body?.serialNumber);
    const stageKey=String(body?.stageKey||'').slice(0,100);
    const stageName=String(body?.stageName||'').slice(0,120);
    const raceId=String(body?.raceId||'').slice(0,120);
    if(!serialNumber || !stageKey || !stageName || !raceId) {
      return json({ok:false,error:'Invalid Wallet stage payload'},400);
    }

    const existing=await loadWalletPass(env,serialNumber);
    const now=Date.now();
    const record={
      serialNumber,
      passTypeIdentifier:env?.WALLET_PASS_TYPE_IDENTIFIER||'',
      authenticationToken:existing?.authenticationToken||randomToken(24),
      createdAt:existing?.createdAt||new Date(now).toISOString(),
      updatedAt:new Date(now).toISOString(),
      updateTag:String(now),
      state:{
        raceId,
        raceName:String(body?.raceName||'Rally Fans Map').slice(0,160),
        stageKey,
        stageName,
        date:String(body?.date||'').slice(0,80),
        startLocation:body?.startLocation||null,
        finishLocation:body?.finishLocation||null,
        startAt:body?.startAt||null,
        finishAt:body?.finishAt||null,
        closeAt:body?.closeAt||null,
        openAt:body?.openAt||null,
        relevantAt:body?.relevantAt||null,
        events:Array.isArray(body?.events)?body.events.slice(0,24).map(e=>({
          time:String(e?.time||'').slice(0,20),
          text:String(e?.text||'').slice(0,160),
          at:e?.at||null
        })):[]
      }
    };
    await saveWalletPass(env,record);

    let push={ok:true,skipped:true};
    if(existing) {
      try { push=await notifyWalletUpdate(env,record); }
      catch(e){ push={ok:false,error:String(e?.message||e)}; }
    }

    return json({
      ok:true,
      configured:walletConfigured(env),
      updated:Boolean(existing),
      serialNumber,
      addUrl:`/api/wallet/pass/${encodeURIComponent(serialNumber)}`,
      updateDelivery:push
    });
  }

  const addMatch=url.pathname.match(/^\/api\/wallet\/pass\/([^/]+)$/);
  if(addMatch){
    if(request.method!=='GET') return json({ok:false,error:'Method not allowed'},405);
    let serialNumber;
    try{ serialNumber=decodeURIComponent(addMatch[1]); }catch{return json({ok:false,error:'Invalid serial number'},400);}
    const record=await loadWalletPass(env,serialNumber);
    if(!record) return json({ok:false,error:'Wallet pass not found'},404);
    return signedWalletPassResponse(env,url,record);
  }

  const regMatch=url.pathname.match(/^\/api\/wallet\/v1\/devices\/([^/]+)\/registrations\/([^/]+)\/([^/]+)$/);
  if(regMatch){
    const [,deviceLibraryIdentifier,passTypeIdentifierRaw,serialRaw]=regMatch;
    const passTypeIdentifier=decodeURIComponent(passTypeIdentifierRaw);
    const serialNumber=decodeURIComponent(serialRaw);
    const record=await loadWalletPass(env,serialNumber);
    if(!record || !walletAuthOk(request,record)) return new Response(null,{status:401,headers:commonHeaders()});
    if(passTypeIdentifier!==record.passTypeIdentifier && env?.WALLET_PASS_TYPE_IDENTIFIER && passTypeIdentifier!==env.WALLET_PASS_TYPE_IDENTIFIER) {
      return new Response(null,{status:401,headers:commonHeaders()});
    }

    if(request.method==='POST'){
      if(!store) return new Response(null,{status:503,headers:commonHeaders()});
      const body=await readJson(request);
      const pushToken=String(body?.pushToken||'');
      if(!pushToken) return new Response(null,{status:400,headers:commonHeaders()});
      const registration={deviceLibraryIdentifier,passTypeIdentifier,serialNumber,pushToken,registeredAt:new Date().toISOString()};
      const passKey=walletRegPassKey(passTypeIdentifier,serialNumber,deviceLibraryIdentifier);
      const existed=Boolean(await store.get(passKey));
      await Promise.all([
        store.put(passKey,JSON.stringify(registration)),
        store.put(walletRegDeviceKey(deviceLibraryIdentifier,passTypeIdentifier,serialNumber),JSON.stringify(registration))
      ]);
      return new Response(null,{status:existed?200:201,headers:commonHeaders()});
    }

    if(request.method==='DELETE'){
      if(!store) return new Response(null,{status:503,headers:commonHeaders()});
      await Promise.all([
        store.delete(walletRegPassKey(passTypeIdentifier,serialNumber,deviceLibraryIdentifier)),
        store.delete(walletRegDeviceKey(deviceLibraryIdentifier,passTypeIdentifier,serialNumber))
      ]);
      return new Response(null,{status:200,headers:commonHeaders()});
    }

    return new Response(null,{status:405,headers:commonHeaders({allow:'POST, DELETE'})});
  }

  const listMatch=url.pathname.match(/^\/api\/wallet\/v1\/devices\/([^/]+)\/registrations\/([^/]+)$/);
  if(listMatch){
    if(request.method!=='GET') return new Response(null,{status:405,headers:commonHeaders({allow:'GET'})});
    if(!store) return new Response(null,{status:503,headers:commonHeaders()});
    const [,deviceLibraryIdentifier,passTypeIdentifierRaw]=listMatch;
    const passTypeIdentifier=decodeURIComponent(passTypeIdentifierRaw);
    const previous=url.searchParams.get('passesUpdatedSince') || url.searchParams.get('previousLastUpdated') || '';
    const prefix=`wallet-reg-device:${deviceLibraryIdentifier}:${passTypeIdentifier}:`;
    let cursor;
    const serialNumbers=[];
    let lastUpdated=previous||'0';
    do{
      const page=await store.list({prefix,cursor,limit:1000});
      for(const key of page.keys){
        const reg=await store.get(key.name,'json');
        if(!reg?.serialNumber) continue;
        const record=await loadWalletPass(env,reg.serialNumber);
        if(!record) continue;
        if(!previous || String(record.updateTag)>String(previous)) serialNumbers.push(reg.serialNumber);
        if(String(record.updateTag)>String(lastUpdated)) lastUpdated=String(record.updateTag);
      }
      cursor=page.list_complete?undefined:page.cursor;
    }while(cursor);

    if(!serialNumbers.length) return new Response(null,{status:204,headers:commonHeaders()});
    return json({serialNumbers:[...new Set(serialNumbers)],lastUpdated});
  }

  const passMatch=url.pathname.match(/^\/api\/wallet\/v1\/passes\/([^/]+)\/([^/]+)$/);
  if(passMatch){
    if(request.method!=='GET') return new Response(null,{status:405,headers:commonHeaders({allow:'GET'})});
    const [,passTypeIdentifierRaw,serialRaw]=passMatch;
    const passTypeIdentifier=decodeURIComponent(passTypeIdentifierRaw);
    const serialNumber=decodeURIComponent(serialRaw);
    const record=await loadWalletPass(env,serialNumber);
    if(!record || !walletAuthOk(request,record)) return new Response(null,{status:401,headers:commonHeaders()});
    if(env?.WALLET_PASS_TYPE_IDENTIFIER && passTypeIdentifier!==env.WALLET_PASS_TYPE_IDENTIFIER) return new Response(null,{status:404,headers:commonHeaders()});
    return signedWalletPassResponse(env,url,record);
  }

  if(url.pathname==='/api/wallet/v1/log'){
    if(request.method!=='POST') return new Response(null,{status:405,headers:commonHeaders({allow:'POST'})});
    const body=await readJson(request);
    console.log('Apple Wallet log',JSON.stringify(body||{}).slice(0,4000));
    return new Response(null,{status:200,headers:commonHeaders()});
  }

  return json({ok:false,error:'Unsupported Wallet API path'},404);
}


export { walletConfigured, walletSerialSafe, buildWalletPassJson, handleWalletApi };
