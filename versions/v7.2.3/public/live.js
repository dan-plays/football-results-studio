const out=document.getElementById('status');
async function refresh(){try{const r=await fetch('/live-status');const s=await r.json();out.textContent=JSON.stringify(s,null,2)}catch(e){out.textContent=e.message}}
async function action(a){out.textContent='Working...';try{const r=await fetch('/live-action',{method:'POST',headers:{'Content-Type':'application/json','x-ingest-token':document.getElementById('token').value},body:JSON.stringify({action:a,provider:document.getElementById('provider').value,intervalMinutes:Number(document.getElementById('minutes').value)})});const j=await r.json();out.textContent=JSON.stringify(j,null,2)}catch(e){out.textContent=e.message}}
for(const a of ['start','stop','refresh'])document.getElementById(a).onclick=()=>action(a);
refresh();setInterval(refresh,15000);

// Worldwide league discovery is based on competitions actually returned by SportScore.
let catalog=null,selectedWorld=new Set(),worldReady=false;
const liveStatuses=new Set(['LIVE','HT','1H','2H','ET','PEN_LIVE']);
const esc=s=>String(s??'');
async function loadWorld(initial=false){
 try{const r=await fetch('/competition-catalog');if(!r.ok)throw Error('Unable to load competitions');catalog=await r.json();
 const present=new Set(catalog.fixtures.map(f=>f.competition));
 const active=new Set(catalog.fixtures.filter(f=>liveStatuses.has(f.status)).map(f=>f.competition));
 if(!worldReady && present.size){selectedWorld=new Set(active.size?active:present);worldReady=true}
 renderWorld();
 document.getElementById('worldInfo').textContent=`${present.size} competitions with fixtures today · ${active.size} currently live · ${catalog.fixtures.length} fixtures loaded. ${active.size?'Live competitions preselected.':'No live competitions detected; available competitions preselected.'}`;
 }catch(e){document.getElementById('worldInfo').textContent=e.message}
}
function renderWorld(){if(!catalog)return;const root=document.getElementById('worldLeagues');root.replaceChildren();const q=document.getElementById('worldSearch').value.toLowerCase().trim();const counts=new Map(),active=new Set();for(const f of catalog.fixtures){counts.set(f.competition,(counts.get(f.competition)||0)+1);if(liveStatuses.has(f.status))active.add(f.competition)}
 const codes=Object.keys(catalog.competitions).filter(c=>counts.has(c)).filter(c=>{const v=catalog.competitions[c];return [v.name,v.country,...catalog.fixtures.filter(f=>f.competition===c).flatMap(f=>[f.home,f.away])].join(' ').toLowerCase().includes(q)}).sort((a,b)=>Number(active.has(b))-Number(active.has(a))||String(catalog.competitions[a].country||'').localeCompare(String(catalog.competitions[b].country||''))||catalog.competitions[a].name.localeCompare(catalog.competitions[b].name));
 for(const c of codes){const v=catalog.competitions[c];const label=document.createElement('label');label.style.cssText='display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid #35465d;cursor:pointer';const cb=document.createElement('input');cb.type='checkbox';cb.checked=selectedWorld.has(c);cb.onchange=()=>{cb.checked?selectedWorld.add(c):selectedWorld.delete(c)};const txt=document.createElement('span');txt.textContent=`${active.has(c)?'🔴 LIVE · ':''}${v.country?v.country+' · ':''}${v.name} (${counts.get(c)} matches)`;label.append(cb,txt);root.append(label)}if(!codes.length)root.textContent='No importable fixtures found. Check the diagnostics above; SportScore may have changed its match format.';
}
document.getElementById('discover').onclick=()=>loadWorld();
document.getElementById('worldSearch').oninput=renderWorld;
document.getElementById('selectLive').onclick=()=>{if(!catalog)return;selectedWorld=new Set(catalog.fixtures.filter(f=>liveStatuses.has(f.status)).map(f=>f.competition));renderWorld()};
document.getElementById('selectAll').onclick=()=>{if(!catalog)return;selectedWorld=new Set(catalog.fixtures.map(f=>f.competition));renderWorld()};
document.getElementById('saveWorld').onclick=async()=>{if(!catalog)return;const codes=Object.keys(catalog.competitions);const current=catalog.settings.enabledCompetitions||[];const present=new Set(catalog.fixtures.map(f=>f.competition));const enabled=[...new Set([...current.filter(c=>!present.has(c)),...selectedWorld])].filter(c=>codes.includes(c));try{const r=await fetch('/ingest',{method:'POST',headers:{'Content-Type':'application/json','x-ingest-token':document.getElementById('token').value},body:JSON.stringify({type:'settings',data:{enabledCompetitions:enabled}})});const j=await r.json();if(!r.ok)throw Error(j.error||'Save failed');document.getElementById('worldInfo').textContent=`Saved ${selectedWorld.size} selected competitions with today's fixtures. Other previously enabled competitions were retained.`}catch(e){document.getElementById('worldInfo').textContent=e.message}};
const originalAction=action;for(const a of ['start','refresh'])document.getElementById(a).onclick=async()=>{await originalAction(a);await loadWorld()};
loadWorld(true);
