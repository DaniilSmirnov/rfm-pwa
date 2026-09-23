const API_ORIGIN = 'https://api.rallyfansmap.ru';
const BASEMAP_PM = 'https://data.source.coop/protomaps/openstreetmap/tiles/v3.pmtiles';
const RFM_ICON_URL = 'https://rallyfansmap.ru/assets/icons/apple-touch-icon.png';
const encoder = new TextEncoder();

function bytesToBase64Url(bytes) {
  let binary='';
  const view=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function textToBase64Url(value) {
  return bytesToBase64Url(encoder.encode(value));
}
async function sha256Base64Url(value) {
  return bytesToBase64Url(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
}
function pushEndpointAllowed(endpoint) {
  try {
    const u=new URL(endpoint);
    if (u.protocol!=='https:') return false;
    const h=u.hostname.toLowerCase();
    return h==='web.push.apple.com'
      || h.endsWith('.push.apple.com')
      || h==='fcm.googleapis.com'
      || h.endsWith('.googleapis.com')
      || h==='updates.push.services.mozilla.com'
      || h.endsWith('.push.services.mozilla.com');
  } catch { return false; }
}
function pushConfigured(env) {
  return Boolean(env?.VAPID_PUBLIC_KEY && env?.VAPID_PRIVATE_JWK && env?.VAPID_SUBJECT);
}
async function vapidJwt(endpoint, env) {
  if (!pushConfigured(env)) throw new Error('Push is not configured');
  const target=new URL(endpoint);
  const header=textToBase64Url(JSON.stringify({typ:'JWT',alg:'ES256'}));
  const payload=textToBase64Url(JSON.stringify({
    aud:target.origin,
    exp:Math.floor(Date.now()/1000)+(12*60*60),
    sub:env.VAPID_SUBJECT
  }));
  const input=`${header}.${payload}`;
  const jwk=JSON.parse(env.VAPID_PRIVATE_JWK);
  const key=await crypto.subtle.importKey(
    'jwk',
    jwk,
    {name:'ECDSA',namedCurve:'P-256'},
    false,
    ['sign']
  );
  const signature=await crypto.subtle.sign(
    {name:'ECDSA',hash:'SHA-256'},
    key,
    encoder.encode(input)
  );
  return `${input}.${bytesToBase64Url(signature)}`;
}
async function sendEmptyPush(endpoint, env, ttlSeconds=21600) {
  if (!pushEndpointAllowed(endpoint)) return {ok:false,status:400,error:'Unsupported push endpoint'};
  const token=await vapidJwt(endpoint,env);
  const response=await fetch(endpoint,{
    method:'POST',
    headers:{
      'TTL':String(Math.max(60,Math.min(172800,Number(ttlSeconds)||21600))),
      'Urgency':'normal',
      'Authorization':`vapid t=${token}, k=${env.VAPID_PUBLIC_KEY}`
    }
  });
  return {ok:response.ok,status:response.status};
}
async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}
async function subscriptionKey(endpoint) {
  return `sub:${await sha256Base64Url(endpoint)}`;
}
async function subscriptionHash(endpoint) {
  return await sha256Base64Url(endpoint);
}
function reminderPrefix(subHash, raceId='') {
  return `reminder:${subHash}:${raceId ? String(raceId)+':' : ''}`;
}
function validReminder(item) {
  const dueAt=Number(item?.dueAt);
  return Number.isFinite(dueAt)
    && dueAt>Date.now()-5*60*1000
    && dueAt<Date.now()+14*24*60*60*1000
    && String(item?.title||'').length<=120
    && String(item?.body||'').length<=240;
}
async function clearReminderPrefix(store,prefix) {
  let cursor;
  do {
    const page=await store.list({prefix,cursor});
    await Promise.all(page.keys.map(k=>store.delete(k.name)));
    cursor=page.list_complete?undefined:page.cursor;
  } while(cursor);
}
async function runDueReminders(env, now=Date.now()) {
  if (!pushConfigured(env) || !env?.PUSH_SUBSCRIPTIONS) {
    return {ok:false,error:'Push storage/config is missing'};
  }
  let cursor;
  let checked=0,sent=0,failed=0,removed=0;
  do {
    const page=await env.PUSH_SUBSCRIPTIONS.list({prefix:'reminder:',cursor,limit:1000});
    for (const key of page.keys) {
      checked++;
      const job=await env.PUSH_SUBSCRIPTIONS.get(key.name,'json');
      if(!job){ await env.PUSH_SUBSCRIPTIONS.delete(key.name); continue; }
      if(Number(job.dueAt)>now) continue;
      const endpoint=job?.subscription?.endpoint;
      if(!pushEndpointAllowed(endpoint)){
        await env.PUSH_SUBSCRIPTIONS.delete(key.name);
        removed++;
        continue;
      }
      try{
        const hash=await subscriptionHash(endpoint);
        await env.PUSH_SUBSCRIPTIONS.put(
          `pending:${hash}`,
          JSON.stringify({
            title:job.title||'Rally Fans Map',
            body:job.body||'Событие гонки скоро начнётся.',
            url:job.url||'/',
            tag:job.tag||`rfm-reminder-${job.raceId||'race'}`,
            dueAt:job.dueAt
          }),
          {expirationTtl:600}
        );
        const result=await sendEmptyPush(endpoint,env,Math.max(1800,Number(job.ttlSeconds)||21600));
        if(result.ok){
          sent++;
          await env.PUSH_SUBSCRIPTIONS.delete(key.name);
        } else {
          failed++;
          if([404,410].includes(result.status)){
            await env.PUSH_SUBSCRIPTIONS.delete(key.name);
            removed++;
          }
        }
      }catch{
        failed++;
      }
    }
    cursor=page.list_complete?undefined:page.cursor;
  } while(cursor);
  return {ok:true,checked,sent,failed,removed,now};
}
async function handlePushApi(request, env, url, ctx) {
  if (url.pathname==='/api/push/config') {
    if (request.method!=='GET') return json({ok:false,error:'Method not allowed'},405);
    return json({
      ok:true,
      enabled:pushConfigured(env),
      publicKey:pushConfigured(env)?env.VAPID_PUBLIC_KEY:null,
      storage:Boolean(env?.PUSH_SUBSCRIPTIONS)
    });
  }

  if (url.pathname==='/api/push/subscribe') {
    if (request.method!=='POST') return json({ok:false,error:'Method not allowed'},405);
    if (!pushConfigured(env)) return json({ok:false,error:'Push is not configured on Cloudflare Pages'},503);
    const body=await readJson(request);
    const subscription=body?.subscription || body;
    const endpoint=subscription?.endpoint;
    if (!pushEndpointAllowed(endpoint)) return json({ok:false,error:'Unsupported push endpoint'},400);
    let stored=false;
    if (env?.PUSH_SUBSCRIPTIONS) {
      await env.PUSH_SUBSCRIPTIONS.put(
        await subscriptionKey(endpoint),
        JSON.stringify({subscription,createdAt:new Date().toISOString()})
      );
      stored=true;
    }
    return json({ok:true,stored});
  }

  if (url.pathname==='/api/push/unsubscribe') {
    if (request.method!=='POST') return json({ok:false,error:'Method not allowed'},405);
    const body=await readJson(request);
    const endpoint=body?.endpoint;
    if (!pushEndpointAllowed(endpoint)) return json({ok:false,error:'Unsupported push endpoint'},400);
    if (env?.PUSH_SUBSCRIPTIONS) {
      const hash=await subscriptionHash(endpoint);
      await env.PUSH_SUBSCRIPTIONS.delete(await subscriptionKey(endpoint));
      await env.PUSH_SUBSCRIPTIONS.delete(`pending:${hash}`);
      await clearReminderPrefix(env.PUSH_SUBSCRIPTIONS,reminderPrefix(hash));
    }
    return json({ok:true});
  }

  if (url.pathname==='/api/push/test') {
    if (request.method!=='POST') return json({ok:false,error:'Method not allowed'},405);
    if (!pushConfigured(env)) return json({ok:false,error:'Push is not configured on Cloudflare Pages'},503);
    const body=await readJson(request);
    const endpoint=body?.subscription?.endpoint || body?.endpoint;
    if (!pushEndpointAllowed(endpoint)) return json({ok:false,error:'Unsupported push endpoint'},400);

    const delaySeconds=Math.max(0,Math.min(30,Number(body?.delaySeconds)||0));
    const sendTest=async()=>{
      if(delaySeconds) await new Promise(resolve=>setTimeout(resolve,delaySeconds*1000));

      if(env?.PUSH_SUBSCRIPTIONS){
        const hash=await subscriptionHash(endpoint);
        await env.PUSH_SUBSCRIPTIONS.put(
          `pending:${hash}`,
          JSON.stringify({
            title:'Rally Fans Map',
            body:delaySeconds
              ? `Тестовый push через ${delaySeconds} секунд работает 🎉`
              : 'Тестовый push работает 🎉',
            url:'/',
            tag:`rfm-test-${Date.now()}`
          }),
          {expirationTtl:600}
        );
      }

      return sendEmptyPush(endpoint,env,300);
    };

    if(delaySeconds){
      if(!ctx?.waitUntil) return json({ok:false,error:'Delayed push is unavailable in this runtime'},503);
      ctx.waitUntil(sendTest());
      return json({ok:true,scheduled:true,delaySeconds},202);
    }

    const result=await sendTest();
    return json({ok:result.ok,status:result.status},result.ok?200:502);
  }

  if (url.pathname==='/api/push/schedule') {
    if (request.method!=='POST') return json({ok:false,error:'Method not allowed'},405);
    if (!pushConfigured(env) || !env?.PUSH_SUBSCRIPTIONS) return json({ok:false,error:'Push storage/config is missing'},503);
    const body=await readJson(request);
    const subscription=body?.subscription;
    const endpoint=subscription?.endpoint;
    const raceId=String(body?.raceId||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64);
    const reminders=Array.isArray(body?.reminders)?body.reminders.filter(validReminder).slice(0,192):[];
    if(!pushEndpointAllowed(endpoint) || !raceId) return json({ok:false,error:'Invalid subscription or raceId'},400);
    const subHash=await subscriptionHash(endpoint);
    await clearReminderPrefix(env.PUSH_SUBSCRIPTIONS,reminderPrefix(subHash,raceId));
    let stored=0;
    for(const item of reminders){
      const eventId=await sha256Base64Url(`${item.dueAt}:${item.title||''}:${item.body||''}`);
      const key=`${reminderPrefix(subHash,raceId)}${String(item.dueAt).padStart(13,'0')}:${eventId.slice(0,16)}`;
      await env.PUSH_SUBSCRIPTIONS.put(key,JSON.stringify({
        subscription,
        raceId,
        dueAt:Number(item.dueAt),
        title:String(item.title||'Rally Fans Map').slice(0,120),
        body:String(item.body||'').slice(0,240),
        url:String(item.url||'/').slice(0,300),
        tag:String(item.tag||`rfm-race-${raceId}`).slice(0,100),
        ttlSeconds:Number(item.ttlSeconds)||21600
      }));
      stored++;
    }
    return json({ok:true,stored});
  }

  if (url.pathname==='/api/push/pending') {
    if (request.method!=='POST') return json({ok:false,error:'Method not allowed'},405);
    if (!env?.PUSH_SUBSCRIPTIONS) return json({ok:false,error:'Push storage is missing'},503);
    const body=await readJson(request);
    const endpoint=body?.endpoint;
    if(!pushEndpointAllowed(endpoint)) return json({ok:false,error:'Unsupported push endpoint'},400);
    const key=`pending:${await subscriptionHash(endpoint)}`;
    const pending=await env.PUSH_SUBSCRIPTIONS.get(key,'json');
    if(pending) await env.PUSH_SUBSCRIPTIONS.delete(key);
    return json({ok:true,pending:pending||null});
  }

  if (url.pathname==='/api/push/run-due') {
    if (!['POST','GET'].includes(request.method)) return json({ok:false,error:'Method not allowed'},405);
    const auth=request.headers.get('authorization')||'';
    const token=url.searchParams.get('token')||'';
    if (!env.PUSH_ADMIN_TOKEN || (auth!==`Bearer ${env.PUSH_ADMIN_TOKEN}` && token!==env.PUSH_ADMIN_TOKEN)) {
      return json({ok:false,error:'Unauthorized'},401);
    }
    const result=await runDueReminders(env);
    return json(result,result.ok?200:503);
  }

  if (url.pathname==='/api/push/broadcast') {
    if (request.method!=='POST') return json({ok:false,error:'Method not allowed'},405);
    if (!pushConfigured(env) || !env?.PUSH_SUBSCRIPTIONS) return json({ok:false,error:'Push storage/config is missing'},503);
    const auth=request.headers.get('authorization')||'';
    if (!env.PUSH_ADMIN_TOKEN || auth!==`Bearer ${env.PUSH_ADMIN_TOKEN}`) return json({ok:false,error:'Unauthorized'},401);

    const body=await readJson(request);
    const title=String(body?.title||'Rally Fans Map').trim().slice(0,120);
    const message=String(body?.body||'').trim().slice(0,240);
    const targetUrl=String(body?.url||'/').trim().slice(0,300);
    const tag=String(body?.tag||`rfm-broadcast-${Date.now()}`).trim().slice(0,100);
    const ttlSeconds=Math.max(300,Math.min(172800,Number(body?.ttlSeconds)||21600));

    if(!message) return json({ok:false,error:'Broadcast body is required'},400);
    if(!targetUrl.startsWith('/')) return json({ok:false,error:'Broadcast url must be a same-origin path'},400);

    let cursor=undefined;
    let sent=0,failed=0,removed=0;
    do {
      const page=await env.PUSH_SUBSCRIPTIONS.list({prefix:'sub:',cursor});
      for (const key of page.keys) {
        const record=await env.PUSH_SUBSCRIPTIONS.get(key.name,'json');
        const endpoint=record?.subscription?.endpoint;
        if (!pushEndpointAllowed(endpoint)) {
          await env.PUSH_SUBSCRIPTIONS.delete(key.name);
          removed++;
          continue;
        }
        try {
          const hash=await subscriptionHash(endpoint);
          await env.PUSH_SUBSCRIPTIONS.put(
            `pending:${hash}`,
            JSON.stringify({
              title,
              body:message,
              url:targetUrl,
              tag,
              createdAt:Date.now()
            }),
            {expirationTtl:ttlSeconds}
          );

          const result=await sendEmptyPush(endpoint,env,ttlSeconds);
          if (result.ok) sent++;
          else {
            failed++;
            await env.PUSH_SUBSCRIPTIONS.delete(`pending:${hash}`);
            if ([404,410].includes(result.status)) {
              await env.PUSH_SUBSCRIPTIONS.delete(key.name);
              removed++;
            }
          }
        } catch {
          failed++;
        }
      }
      cursor=page.list_complete?undefined:page.cursor;
    } while(cursor);

    return json({ok:true,sent,failed,removed,title,body:message,url:targetUrl,tag,ttlSeconds});
  }

  return json({ok:false,error:'Unsupported push API path'},404);
}


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


function apiTarget(pathname) {
  // Canonical routes used by the app, plus short aliases for easier diagnostics.
  if (pathname === '/api/rallyfans/race' || pathname === '/api/race') return new URL('/race', API_ORIGIN);

  let race = pathname.match(/^\/api\/rallyfans\/race\/(\d+)$/);
  if (!race) race = pathname.match(/^\/api\/race\/(\d+)$/);
  if (race) return new URL(`/race/${race[1]}`, API_ORIGIN);

  let asset = pathname.match(/^\/api\/rallyfans\/public\/([^/]+)$/);
  if (!asset) asset = pathname.match(/^\/api\/public\/([^/]+)$/);
  if (asset) {
    let filename;
    try { filename = decodeURIComponent(asset[1]); } catch { return null; }
    if (!filename || filename.includes('/') || filename.includes('\\') || filename === '.' || filename === '..') return null;
    return new URL(`/public/${encodeURIComponent(filename)}`, API_ORIGIN);
  }
  return null;
}

function commonHeaders(extra = {}) {
  return {
    'x-rfm-worker': 'rallyfans-companion-v0.5.5',
    'x-content-type-options': 'nosniff',
    ...extra,
  };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: commonHeaders({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }),
  });
}

function upstreamHeaders(response, isAsset) {
  const headers = new Headers(commonHeaders());
  const contentType = response.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  headers.set('cache-control', isAsset ? 'public, max-age=86400, s-maxage=86400' : 'no-store');
  return headers;
}

async function proxyRallyFans(request, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: commonHeaders({ allow: 'GET, HEAD' }) });
  }

  const target = apiTarget(url.pathname);
  if (!target) return json({ ok: false, error: 'Unsupported RallyFans API path', path: url.pathname }, 404);

  const isAsset = target.pathname.startsWith('/public/');
  const headers = new Headers();
  headers.set('accept', request.headers.get('accept') || '*/*');
  // This is not authorization; it simply makes the upstream request resemble the public site.
  headers.set('user-agent', 'RallyFans-Companion/0.3');

  let upstream;
  try {
    upstream = await fetch(target.toString(), {
      method: request.method,
      headers,
      redirect: 'follow',
      cf: isAsset ? { cacheEverything: true, cacheTtl: 86400 } : undefined,
    });
  } catch (error) {
    return json({ ok: false, error: 'RallyFans upstream unavailable', detail: String(error?.message || error) }, 502);
  }

  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstreamHeaders(upstream, isAsset),
  });
}

function allowedYandexConstructorUrl(raw) {
  try {
    const u = new URL(raw);
    if (!['yandex.ru','www.yandex.ru'].includes(u.hostname)) return null;
    if (!u.pathname.startsWith('/map-widget/v1/')) return null;
    const um = u.searchParams.get('um') || '';
    if (!um.startsWith('constructor:')) return null;
    return u;
  } catch { return null; }
}

function extractBalancedObject(text, marker) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return null;
  let start = text.indexOf('{', markerIndex + marker.length);
  if (start < 0) return null;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

async function importYandexConstructor(request, url) {
  if (request.method !== 'GET') return json({ok:false,error:'Method not allowed'},405);
  const target = allowedYandexConstructorUrl(url.searchParams.get('url') || '');
  if (!target) return json({ok:false,error:'Unsupported Yandex Constructor URL'},400);
  let upstream;
  try {
    upstream = await fetch(target.toString(), { headers:{ 'accept':'text/html,*/*', 'user-agent':'RallyFans-Companion/0.3.1' }, redirect:'follow' });
  } catch (e) { return json({ok:false,error:'Yandex Constructor unavailable',detail:String(e?.message||e)},502); }
  if (!upstream.ok) return json({ok:false,error:`Yandex HTTP ${upstream.status}`},502);
  const html = await upstream.text();
  if (html.length > 4_000_000) return json({ok:false,error:'Yandex response is too large'},502);
  const raw = extractBalancedObject(html, '"userMap":');
  if (!raw) return json({ok:false,error:'userMap data not found in Yandex widget'},422);
  let userMap;
  try { userMap = JSON.parse(raw); } catch { return json({ok:false,error:'Could not parse Yandex userMap'},422); }
  const features = Array.isArray(userMap?.features) ? userMap.features : [];
  return json({ok:true,constructorUrl:target.toString(),sourceFeatureCount:features.length,features});
}

async function proxyBasemap(request) {
  if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405,headers:commonHeaders({allow:'GET, HEAD'})});
  const headers=new Headers();
  const range=request.headers.get('range'); if(range) headers.set('range',range);
  headers.set('accept','application/octet-stream,*/*');
  let upstream;
  try { upstream=await fetch(BASEMAP_PM,{method:request.method,headers,redirect:'follow'}); }
  catch(e){ return json({ok:false,error:'Basemap upstream unavailable',detail:String(e?.message||e)},502); }
  const out=new Headers(commonHeaders({'content-type':upstream.headers.get('content-type')||'application/octet-stream','cache-control':'public, max-age=86400'}));
  for(const h of ['accept-ranges','content-range','content-length','etag','last-modified']){ const v=upstream.headers.get(h); if(v) out.set(h,v); }
  return new Response(request.method==='HEAD'?null:upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:out});
}

const RFM_FONTS = new Set([
  'RFDewiExpanded-Black.cd06241e.woff2',
  'RFDewiExpanded-BoldItalic.67413952.ttf',
  'RFDewiExpanded-Bold.ba737abf.ttf',
  'RFDewiExpanded-Semibold.eb002abf.ttf'
]);
async function proxyRfmFont(request,url){
  const name=url.pathname.split('/').pop();
  if(!RFM_FONTS.has(name)) return new Response('Not found',{status:404});
  const upstream=await fetch(`https://rallyfansmap.ru/fonts/${name}`,{cf:{cacheEverything:true,cacheTtl:604800}});
  const h=new Headers(commonHeaders({'content-type':upstream.headers.get('content-type')||'font/ttf','cache-control':'public, max-age=604800'}));
  return new Response(upstream.body,{status:upstream.status,headers:h});
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health' || url.pathname === '/api/rallyfans/health') {
      return json({
        ok: true,
        service: 'rallyfans-companion',
        version: '0.5.5',
        upstream: API_ORIGIN,
        basemap: BASEMAP_PM,
        hint: 'If this endpoint works, the Cloudflare Pages Worker is active.'
      });
    }

    if (url.pathname.startsWith('/api/push/')) return handlePushApi(request,env,url,ctx);
    if (url.pathname.startsWith('/api/wallet/')) return handleWalletApi(request,env,url);

    if (url.pathname === '/api/yandex/constructor') return importYandexConstructor(request, url);
    if (url.pathname === '/rfm/icon.png') {
      const upstream = await fetch(RFM_ICON_URL, { cf:{ cacheEverything:true, cacheTtl:604800 } });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: commonHeaders({
          'content-type': 'image/png',
          'cache-control': 'public, max-age=604800'
        })
      });
    }

    if (url.pathname === '/api/basemap.pmtiles') return proxyBasemap(request);
    if (url.pathname.startsWith('/rfm/fonts/')) return proxyRfmFont(request,url);

    if (url.pathname.startsWith('/api/rallyfans/') || url.pathname === '/api/race' || url.pathname.startsWith('/api/race/') || url.pathname.startsWith('/api/public/')) {
      return proxyRallyFans(request, url);
    }

    if (!env?.ASSETS) {
      return json({ ok: false, error: 'ASSETS binding missing. Deploy this as a Cloudflare Pages project, not as a plain Worker.' }, 500);
    }
    const asset = await env.ASSETS.fetch(request);
    if (['/sw.js','/index.html','/manifest.webmanifest','/'].includes(url.pathname)) {
      const headers = new Headers(asset.headers);
      headers.set('cache-control','no-cache, no-store, must-revalidate');
      headers.set('pragma','no-cache');
      headers.set('expires','0');
      return new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers});
    }
    return asset;
  },
};
