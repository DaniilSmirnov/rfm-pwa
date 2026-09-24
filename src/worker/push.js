import { bytesToBase64Url, textToBase64Url, sha256Base64Url, readJson, json } from './http.js';

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
  let token;
  try {
    token=await vapidJwt(endpoint,env);
  } catch {
    return {ok:false,status:0,error:'vapid'};
  }
  try {
    const response=await fetch(endpoint,{
      method:'POST',
      headers:{
        'TTL':String(Math.max(60,Math.min(172800,Number(ttlSeconds)||21600))),
        'Urgency':'normal',
        'Authorization':`vapid t=${token}, k=${env.VAPID_PUBLIC_KEY}`
      }
    });
    return {ok:response.ok,status:response.status};
  } catch {
    return {ok:false,status:0,error:'fetch'};
  }
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
    const failedStatuses={};
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
            const statusKey=result.error ? `error:${result.error}` : String(result.status||'unknown');
            failedStatuses[statusKey]=(failedStatuses[statusKey]||0)+1;
            await env.PUSH_SUBSCRIPTIONS.delete(`pending:${hash}`);
            if ([404,410].includes(result.status)) {
              await env.PUSH_SUBSCRIPTIONS.delete(key.name);
              removed++;
            }
          }
        } catch {
          failed++;
          failedStatuses.exception=(failedStatuses.exception||0)+1;
        }
      }
      cursor=page.list_complete?undefined:page.cursor;
    } while(cursor);

    return json({ok:true,sent,failed,removed,failedStatuses,title,body:message,url:targetUrl,tag,ttlSeconds});
  }

  return json({ok:false,error:'Unsupported push API path'},404);
}


export { pushEndpointAllowed, pushConfigured, validReminder, reminderPrefix, runDueReminders, handlePushApi };
