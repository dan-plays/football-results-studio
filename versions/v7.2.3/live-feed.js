'use strict';
// API-Football / API-Sports adapter. Server-side key only; no browser credential exposure.
const https=require('node:https');
const {DEFAULT_ORDER}=require('./public/competitions');
const MATCH=[
 ['UCL','UEFA','Champions League'],['UEL','UEFA','Europa League'],['UECL','UEFA','Europa Conference League'],
 ['FAC','England','FA Cup'],['EFLC','England','League Cup'],['PL','England','Premier League'],
 ['CH','England','Championship'],['L1','England','League One'],['L2','England','League Two'],
 ['EFLT','England','EFL Trophy'],['NL','England','National League'],['NLN','England','National League - North'],
 ['NLS','England','National League - South'],['SPL','Scotland','Premiership'],
 ['SCH','Scotland','Championship'],['SL1','Scotland','League One'],['SL2','Scotland','League Two'],
 ['SCUP','Scotland','FA Cup'],['SLCUP','Scotland','League Cup'] ];
const names={ 'FA Cup':'FAC','League Cup':'EFLC' };
function code(league){const country=String(league.country||'').toLowerCase(),name=String(league.name||'').toLowerCase();
 for(const [c,co,n] of MATCH){if(country===co.toLowerCase()&&name===n.toLowerCase())return c}
 // Conservative aliases; do not silently classify unknown competitions.
 if(country==='england'&&name==='national league north')return 'NLN';
 if(country==='england'&&name==='national league south')return 'NLS';
 if(country==='england'&&name==='football league trophy')return 'EFLT';
 if(country==='scotland'&&name==='premier league')return 'SPL';
 if(country==='uefa'&&name==='conference league')return 'UECL';
 return null;
}
function api(key,endpoint){return new Promise((resolve,reject)=>{const r=https.get('https://v3.football.api-sports.io'+endpoint,{headers:{'x-apisports-key':key,'Accept':'application/json'},timeout:20000},res=>{let body='';res.on('data',d=>{body+=d;if(body.length>10000000)res.destroy()});res.on('end',()=>{try{const data=JSON.parse(body);if(res.statusCode!==200||Object.keys(data.errors||{}).length)throw Error('API-Football: '+JSON.stringify(data.errors||res.statusCode));resolve({response:data.response||[],paging:data.paging||{},requests:data.results||0,remaining:res.headers['x-ratelimit-requests-remaining']})}catch(e){reject(e)}})});r.on('timeout',()=>r.destroy(Error('API timeout')));r.on('error',reject)})}
function fixture(f){const c=code(f.league||{});if(!c)return null;return {id:'api-'+f.fixture.id,competition:c,home:f.teams.home.name,away:f.teams.away.name,homeScore:f.goals.home??0,awayScore:f.goals.away??0,status:f.fixture.status.short||'NS',minute:f.fixture.status.elapsed??null,kickoff:f.fixture.date}}
function createLiveFeed({apply,getFixtures,notify}){
 let running=false,busy=false,lastSync=null,lastError=null,remaining=null,updated=0,intervalMinutes=15,timer=null,known=new Map(),eventSeen=new Set();
 const key=()=>process.env.API_FOOTBALL_KEY||'';
 const status=()=>({running,busy,configured:!!key(),lastSync,lastError,remaining,updated,intervalMinutes,provider:'API-Football',note:'Free tier: 100 requests/day. Fixture refresh is 1 request; scorer event lookups use additional requests. Live data may be delayed.'});
 function setTimer(){clearInterval(timer);if(running)timer=setInterval(()=>sync().catch(()=>{}),intervalMinutes*60000)}
 async function sync(){if(busy)throw Error('A sync is already running');if(!key())throw Error('Set API_FOOTBALL_KEY in START-WINDOWS.bat');busy=true;lastError=null;updated=0;
 try{
  const now=new Date();const london=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  // Fetch today's fixtures (includes upcoming/final) once; no unsupported guessing.
  const result=await api(key(),'/fixtures?date='+encodeURIComponent(london));remaining=result.remaining??remaining;
  const incoming=result.response.map(fixture).filter(Boolean);
  const old=new Map(getFixtures().filter(f=>f.id.startsWith('api-')).map(f=>[f.id,f]));
  const merged=[...getFixtures().filter(f=>!f.id.startsWith('api-')),...incoming];
  apply({type:'fixtures',data:merged});updated=incoming.length;
  // For known games, request confirmed event details when a score changes.
  // We do not fabricate goals from score differences; no event => no goal alert.
  for(const f of incoming){const previous=old.get(f.id);if(!previous||previous.homeScore===f.homeScore&&previous.awayScore===f.awayScore)continue;
   if(remaining!==null&&Number(remaining)<3)continue;
   try{const ev=await api(key(),'/fixtures/events?fixture='+encodeURIComponent(f.id.slice(4)));remaining=ev.remaining??remaining;
    for(const x of ev.response){const type=String(x.type||'').toLowerCase();const detail=String(x.detail||'').toLowerCase();const kind=type==='goal'?'goal':type==='card'&&detail.includes('red')?'red_card':null;if(!kind)continue;
     const eid=['api-event',f.id,x.time.elapsed,x.time.extra,x.team.id,x.player.id,x.type,x.detail].join(':');if(eventSeen.has(eid))continue;
     // Only announce newly observed events; suppress historical events on initial discovery.
     if(!known.has(f.id)){eventSeen.add(eid);continue}
     eventSeen.add(eid);
     apply({type:'event',data:{eventId:eid,fixtureId:f.id,kind,team:x.team.name||'',scorer:x.player.name||'',minute:x.time.elapsed??'',message:x.detail||'',homeScore:f.homeScore,awayScore:f.awayScore}});
    }
   }catch(e){lastError='Events unavailable: '+e.message}
  }
  for(const f of incoming)known.set(f.id,{homeScore:f.homeScore,awayScore:f.awayScore});
  lastSync=new Date().toISOString();notify({type:'live-status',status:status()});return status();
 }catch(e){lastError=e.message;throw e}finally{busy=false}}
 async function action(a){if(a.action==='stop'){running=false;clearInterval(timer);notify({type:'live-status',status:status()});return status()}
  if(a.action==='start'){if(!key())throw Error('Missing API_FOOTBALL_KEY. See LIVE-SETUP.txt');if(a.intervalMinutes!==undefined){const n=Number(a.intervalMinutes);if(!Number.isInteger(n)||n<1||n>120)throw Error('Interval must be 1–120 minutes');intervalMinutes=n}running=true;setTimer();try{await sync()}catch(e){running=false;clearInterval(timer);throw e}return status()}
  if(a.action==='refresh')return sync();throw Error('Unknown action')}
 return {action,status};
}
module.exports={createLiveFeed,code,fixture};

