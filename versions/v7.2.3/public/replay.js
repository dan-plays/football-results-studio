'use strict';
// v4: real match minutes, no invented scorer/times, sequential network operations.
(()=>{let timer=null,minute=0,source=null,goals=[],running=false,working=false,localFixtures=[];const el=id=>document.getElementById(id);const say=t=>el('replaystatus').textContent=t;
async function load(){const r=await fetch('/replay-data');if(!r.ok)throw Error('Cannot load replay data');return r.json()}
async function reset(){if(timer)clearInterval(timer);timer=null;running=false;minute=0;source=await load();await ingest('clear',{});const all=source.fixtures.map(f=>({...f,homeScore:f.kickoff.includes('12:30')?f.homeScore:0,awayScore:f.kickoff.includes('12:30')?f.awayScore:0,status:f.kickoff.includes('12:30')?'FT':'NS',minute:null}));await ingest('fixtures',all);localFixtures=all;goals=source.events.filter(e=>all.some(f=>f.id===e.fixtureId&&f.status==='NS'));say(`Ready: ${all.length} fixtures; ${goals.length} verified timed incidents. Press Start to kick off.`)}
async function tick(){if(working||!running)return;working=true;minute++;const now=minute;try{
if(now===1){localFixtures=localFixtures.map(f=>f.status==='NS'?{...f,status:'LIVE',minute:1}:f);await ingest('fixtures',localFixtures)}
for(const e of goals.filter(e=>e.minute===now)){
 const f=localFixtures.find(f=>f.id===e.fixtureId);if(!f)continue;
 const key=e.side==='home'?'homeScore':'awayScore';
 const payload={kind:e.kind||'goal',eventId:`historical-v5-${e.fixtureId}-${e.minute}-${e.kind||'goal'}-${e.scorer}`,fixtureId:e.fixtureId,minute:e.displayMinute||String(e.minute),scorer:e.scorer,team:e.side==='home'?f.home:f.away};
 if(payload.kind==='goal')payload[key]=f[key]+1;
 await ingest('event',payload);
 if(payload.kind==='goal')f[key]++;
}
if(now===45){localFixtures=localFixtures.map(f=>f.status==='LIVE'?{...f,status:'HT',minute:45}:f);await ingest('fixtures',localFixtures)}
if(now===46){localFixtures=localFixtures.map(f=>f.status==='HT'?{...f,status:'LIVE',minute:46}:f);await ingest('fixtures',localFixtures)}
if(now===100){localFixtures=source.fixtures.map(f=>({...f,status:'FT',minute:90}));await ingest('fixtures',localFixtures);say('Final results reconciled; unverified goal times were not invented.')}
if(now>=120){clearInterval(timer);timer=null;running=false;say('Replay finished — 120 seconds. Ready for OBS review.')}
else say(`Replay ${now}/120 seconds · ${now<=90?`match minute ${now}`:'post-match results'} · ${goals.filter(e=>e.minute<=now).length} verified timed incidents delivered`);
}catch(err){clearInterval(timer);timer=null;running=false;say('Replay stopped: '+err.message)}finally{working=false}}
el('replaystart').onclick=async()=>{try{if(running)return;await reset();running=true;say('Starting replay…');timer=setInterval(()=>{void tick()},1000)}catch(e){say(e.message)}};
el('replaystop').onclick=()=>{running=false;if(timer)clearInterval(timer);timer=null;say(`Stopped at ${minute}/120 seconds`)};
el('replayreset').onclick=async()=>{try{await reset()}catch(e){say(e.message)}};
})();
