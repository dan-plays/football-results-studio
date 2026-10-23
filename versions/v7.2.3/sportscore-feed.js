'use strict';
const https=require('node:https'),crypto=require('node:crypto'),{COMPETITIONS}=require('./public/competitions.js'),{URL}=require('node:url');
const value=v=>v&&typeof v==='object'?(v.name||v.title||v.short_name||v.label||''):v;
const str=v=>String(value(v)??'').trim();
const canonical={
 england:{'fa cup':'FAC','efl cup':'EFLC','league cup':'EFLC','carabao cup':'EFLC','efl trophy':'EFLT','football league trophy':'EFLT','premier league':'PL','championship':'CH','efl championship':'CH','league one':'L1','efl league one':'L1','league two':'L2','efl league two':'L2','national league':'NL','national league north':'NLN','national league south':'NLS'},
 scotland:{'scottish cup':'SCUP','fa cup':'SCUP','scottish fa cup':'SCUP','league cup':'SLCUP','scottish league cup':'SLCUP','premier sports cup':'SLCUP','premiership':'SPL','scottish premiership':'SPL','championship':'SCH','scottish championship':'SCH','league one':'SL1','scottish league one':'SL1','league two':'SL2','scottish league two':'SL2'},
 uefa:{'uefa champions league':'UCL','champions league':'UCL','uefa europa league':'UEL','europa league':'UEL','uefa conference league':'UECL','conference league':'UECL','europa conference league':'UECL'}
};
function worldCode(country,name){const key=(country+'|'+name).toLowerCase();const code='W'+crypto.createHash('sha1').update(key).digest('hex').slice(0,12).toUpperCase();if(!COMPETITIONS[code])COMPETITIONS[code]={name:name.slice(0,100),country:country.slice(0,60),color:'#64748b'};return code}
function competitionCode(f){
 const c=f.competition||f.league||f.tournament||f.competition_name||f.league_name||{};
 const name=str(c).replace(/\s+/g,' ').trim(),country=str(f.country||c.country||c.country_name||f.region).replace(/\s+/g,' ').trim();
 if(!name)return null;
 const n=name.toLowerCase(),k=country.toLowerCase();
 let region=null;
 if(['england','english'].includes(k))region='england';
 else if(['scotland','scottish'].includes(k))region='scotland';
 else if(['uefa','europe','european'].includes(k))region='uefa';
 const exact=region&&canonical[region][n];if(exact)return exact;
 return worldCode(country||'Country unspecified',name);
}
function statusCode(raw){const s=str(raw).toLowerCase();if(/^(ft|finished|full.time|ended|after extra time|aet|penalties)$/.test(s))return 'FT';if(/half.time|^ht$|half time/.test(s))return 'HT';if(/live|in.progress|first.half|second.half|^1h$|^2h$|extra.time/.test(s))return 'LIVE';if(/postpon/.test(s))return 'PST';if(/cancel/.test(s))return 'CANC';return 'NS'}
function number(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isInteger(n)&&n>=0&&n<=99?n:null}
function normalize(f){if(!f||typeof f!=='object')return null;const code=competitionCode(f);if(!code)return null;
 const home=str(f.home||f.home_team||f.homeTeam||f.teams?.home),away=str(f.away||f.away_team||f.awayTeam||f.teams?.away);
 if(!home||!away)return null;
 const rawId=f.id??f.match_id??f.fixture_id??f.slug??f.match_slug??f.url??f.match_url??f.link??f.href;
 const stableId=rawId==null||!String(rawId).trim()?crypto.createHash('sha1').update([code,home,away,String(f.time||f.kickoff||f.start_time||f.date||'')].join('|')).digest('hex').slice(0,24):String(rawId).length>90?crypto.createHash('sha1').update(String(rawId)).digest('hex'):String(rawId);
 const status=statusCode(f.status_text||f.status?.short||f.status?.type||f.status);
 const hs=number(f.home_score??f.homeScore??f.scores?.home??f.goals?.home),as=number(f.away_score??f.awayScore??f.scores?.away??f.goals?.away);
 const minute=f.minute??f.elapsed??f.status?.elapsed??null;
 return {id:'ss-'+stableId.slice(0,110),competition:code,home:home.slice(0,100),away:away.slice(0,100),homeScore:hs??0,awayScore:as??0,status,minute,kickoff:f.time||f.kickoff||f.start_time||f.date||null,slug:f.slug||f.match_slug||null,scoreKnown:hs!==null&&as!==null};
}
function request(url){return new Promise((resolve,reject)=>{const u=new URL(url);if(u.hostname!=='sportscore.com'||u.protocol!=='https:')return reject(Error('Invalid SportScore URL'));
 const req=https.get(u,{headers:{Accept:'application/json','User-Agent':'FootballResultsStudio/7.1 (+local OBS overlay)'},timeout:15000},res=>{let chunks=[],size=0;res.on('data',c=>{size+=c.length;if(size>5000000){req.destroy(Error('Response too large'));return}chunks.push(c)});res.on('end',()=>{if(res.statusCode!==200)return reject(Error('SportScore HTTP '+res.statusCode));try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch(e){reject(Error('Invalid JSON from SportScore'))}})});req.on('timeout',()=>req.destroy(Error('SportScore timeout')));req.on('error',reject)})}
function extract(data){if(Array.isArray(data))return data;for(const a of [data?.fixtures,data?.matches,data?.results,data?.data?.fixtures,data?.data?.matches,data?.data?.results,data?.data])if(Array.isArray(a))return a;throw Error('Unknown SportScore response format; see diagnostics in live page')}
function londonDate(now=new Date()){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const get=x=>parts.find(p=>p.type===x)?.value;return get('year')+'-'+get('month')+'-'+get('day')}
function createSportScoreFeed({apply,getFixtures,notify,fetchJson=request,now=()=>new Date(),onCatalog=()=>{}}){
 let running=false,busy=false,lastSync=null,lastError=null,updated=0,intervalMinutes=2,timer=null,known=new Map(),eventsSeen=new Set(),requests=0,skipped=0,diagnostics=null,catalogFixtures=[];
 const status=()=>({provider:'SportScore',running,busy,configured:true,lastSync,lastError,updated,intervalMinutes,requests,skipped,diagnostics,availableCompetitions:Object.keys(COMPETITIONS).length,note:'No API key. 60-second cache; requires visible Powered by SportScore attribution. Event availability varies. Verify Twitch rights.'});
 function schedule(){clearInterval(timer);if(running)timer=setInterval(()=>sync().catch(()=>{}),intervalMinutes*60000)}
 async function sync(){if(busy)throw Error('Sync already in progress');busy=true;lastError=null;updated=0;
 try{
 const date=londonDate(now()),limit=200;
 const url='https://sportscore.com/api/v1/fixtures/?sport=football&date='+date+'&limit='+limit;
 const data=await fetchJson(url);requests++;const raw=extract(data);diagnostics={date,rawCount:raw.length,sampleFields:raw[0]?Object.keys(raw[0]).slice(0,30):[],truncatedPossible:raw.length>=limit,competitionSamples:raw.slice(0,8).map(f=>({competition:str(f.competition||f.league||f.tournament||f.competition_name||f.league_name),country:str(f.country||f.competition?.country||f.league?.country||f.region),mappedCode:competitionCode(f),home:str(f.home||f.home_team||f.homeTeam||f.teams?.home),away:str(f.away||f.away_team||f.awayTeam||f.teams?.away)}))};
 const mapped=raw.map(normalize).filter(Boolean);skipped=raw.length-mapped.length;catalogFixtures=mapped;onCatalog(mapped);
 diagnostics.imported=mapped.length;diagnostics.rejected=skipped;
 if(skipped)diagnostics.rejectedExamples=raw.filter(f=>!normalize(f)).slice(0,2).map(f=>({fields:Object.keys(f).slice(0,40),competition:String(value(f.competition||f.league||f.tournament||'')).slice(0,100),homeType:typeof f.home,awayType:typeof f.away,hasId:!!(f.id??f.match_id??f.fixture_id),hasUrl:!!(f.url??f.match_url)}));
 const dedup=[...new Map(mapped.map(x=>[x.id,x])).values()];
 const current=getFixtures();
 const merged=[...current.filter(x=>!x.id.startsWith('ss-')&&!x.id.startsWith('api-')),...dedup.map(({slug,scoreKnown,...f})=>f)];
 apply({type:'fixtures',data:merged});updated=dedup.length;
 for(const f of dedup){const p=known.get(f.id);if(!p||!f.scoreKnown)continue;
 const diff=(f.homeScore-p.homeScore)+(f.awayScore-p.awayScore);
 if(diff>0){const eid='ss-score-'+f.id+'-'+f.homeScore+'-'+f.awayScore;
  if(!eventsSeen.has(eid)){eventsSeen.add(eid);const team=f.homeScore>p.homeScore?f.home:f.awayScore>p.awayScore?f.away:'';
   apply({type:'event',data:{eventId:eid,fixtureId:f.id,kind:'goal',team,minute:String(f.minute??''),message:'Score update — goalscorer unconfirmed',homeScore:f.homeScore,awayScore:f.awayScore}});}
 }else if(diff<0){const eid='ss-correction-'+f.id+'-'+f.homeScore+'-'+f.awayScore;if(!eventsSeen.has(eid)){eventsSeen.add(eid);apply({type:'event',data:{eventId:eid,fixtureId:f.id,kind:'correction',message:'Score correction / possible VAR decision',homeScore:f.homeScore,awayScore:f.awayScore}})}}
 }
 for(const f of dedup)known.set(f.id,{homeScore:f.homeScore,awayScore:f.awayScore});
 lastSync=new Date().toISOString();notify({type:'live-status',status:status()});return status();
 }catch(e){lastError=e.message;notify({type:'live-status',status:status()});throw e}finally{busy=false}}
 async function action(a){if(a.action==='stop'){running=false;clearInterval(timer);notify({type:'live-status',status:status()});return status()}
 if(a.action==='start'){if(a.intervalMinutes!==undefined){const n=Number(a.intervalMinutes);if(!Number.isInteger(n)||n<1||n>120)throw Error('Interval must be 1–120 minutes');intervalMinutes=n}running=true;schedule();try{await sync()}catch(e){running=false;clearInterval(timer);throw e}return status()}
 if(a.action==='refresh')return sync();throw Error('Unknown action')}
 return {action,status,catalog:()=>catalogFixtures};
}
module.exports={createSportScoreFeed,competitionCode,normalize,extract,londonDate,statusCode};
