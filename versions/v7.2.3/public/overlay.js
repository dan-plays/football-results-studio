'use strict';
const names=Object.fromEntries(Object.entries(COMPETITIONS).map(([k,v])=>[k,v.name.toUpperCase()]));names.RESULTS='EARLIER RESULTS';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);let fixtures=[],history=[],settings={rotationMs:12000,alertMs:7500,goalAlerts:true,ticker:true},position=0,paused=false,queue=[],seen=new Set(),timer=null;
const text=(el,val)=>{el.textContent=String(val??'')};const mode=params.get('mode')||location.pathname.slice(1)||'all';if(mode==='panels'){$('alert').remove();$('ticker').remove()}else if(mode==='goal'){$('board').remove();$('ticker').remove()}else if(mode==='ticker'){$('board').remove();$('alert').remove()}
function leagueColor(code){return settings.competitionColors?.[code]||COMPETITIONS[code]?.color||'#cbd5e1'}
function applyTheme(){const th=settings.theme||{};const keys={panel:'--frs-panel',row:'--frs-row',accent:'--frs-accent',ticker:'--frs-ticker',text:'--frs-text',label:'--frs-label'};for(const [k,v] of Object.entries(keys))if(/^#[0-9a-fA-F]{6}$/.test(th[k]||''))document.documentElement.style.setProperty(v,th[k])}
function pages(){return FRS.pages(fixtures,settings)}
function draw(){if(!$('board'))return;const p=pages();if(!p.length){text($('competition'),'FOOTBALL LIVE');text($('page'),'No fixtures loaded');$('fixtures').replaceChildren();return}position%=p.length;const item=p[position];text($('competition'),names[item.code]||COMPETITIONS[item.code]?.name||item.code||'FOOTBALL');text($('page'),`${item.finished?'Final results · ':''}Page ${item.page} of ${item.total}`);$('board').style.borderTop=`5px solid ${leagueColor(item.code)}`;$('fixtures').replaceChildren(...item.items.map(f=>{const card=document.createElement('div');card.className='fixture';card.style.borderLeft=`5px solid ${leagueColor(f.competition)}`;for(const [team,score] of [[f.home,f.homeScore],[f.away,f.awayScore]]){const line=document.createElement('div');line.className='line';const name=document.createElement('span');name.className='team';text(name,team);const num=document.createElement('span');num.className='score';text(num,score);line.append(name,num);card.append(line)}const status=document.createElement('div');status.className='status';text(status,f.minute?`${f.minute}' · ${f.status}`:f.status);card.append(status);return card}))}
function describe(e){const kinds={goal:'GOAL',red_card:'RED CARD',half_time:'HALF-TIME',full_time:'FULL-TIME',var:'VAR',info:'UPDATE',kickoff:'KICK-OFF',correction:'CORRECTION'};return e.message||`${kinds[e.kind]||'UPDATE'} · ${e.home} ${e.homeScore}–${e.awayScore} ${e.away}${e.scorer?' · '+e.scorer:''}${e.minute?` (${e.minute}')`:''}`}
// Persistent BBC/Soccer Saturday-inspired four-line vidiprinter.
// Events are queued and never overwritten by an incoming incident.
let tickerQueue=[],tickerBusy=false,tickerTimeout=null,feed=[];
const MAX_FEED=4,FEED_DELAY=1650;
function tickerLabel(e){return `${names[e.competition]||e.competition}  |  ${describe(e)}`}
function paintFeed(animate=false){
 if(!$('ticker'))return;
 const track=$('tickertrack');track.replaceChildren();
 const visible=feed.slice(-MAX_FEED);
 for(const [index,e] of visible.entries()){
  const line=document.createElement('div');line.className='vidi-line';
  if(animate&&index===visible.length-1)line.classList.add('vidi-enter');
  line.style.setProperty('--league-color',leagueColor(e.competition));
  const league=document.createElement('span');league.className='vidi-league';
  text(league,(names[e.competition]||COMPETITIONS[e.competition]?.name||e.competition||'FOOTBALL').replace(/^EFL /,'').slice(0,24));
  const message=document.createElement('span');message.className='vidi-message';text(message,describe(e));message.title=describe(e);
  line.append(league,message);line.title=describe(e);track.append(line);
 }
 if(!visible.length){const empty=document.createElement('div');empty.className='vidi-empty';text(empty,'AWAITING FOOTBALL UPDATES');track.append(empty)}
}
function drawTicker(){if(!$('ticker'))return;$('ticker').classList.toggle('hide',!settings.ticker);paintFeed()}
function nextTicker(){
 if(!tickerQueue.length){tickerBusy=false;return}
 tickerBusy=true;feed.push(tickerQueue.shift());feed=feed.slice(-MAX_FEED);paintFeed(true);
 clearTimeout(tickerTimeout);tickerTimeout=setTimeout(nextTicker,FEED_DELAY);
}
function nextAlert(){if(!$('alert'))return;if(!queue.length){paused=false;$('alert').classList.remove('active');return}paused=true;const e=queue.shift();text($('alertcomp'),names[e.competition]||e.competition);$('alert').style.borderColor=leagueColor(e.competition);text($('alerttitle'),e.kind==='red_card'?'RED CARD!':'GOAL!');$('alert').classList.toggle('red-card',e.kind==='red_card');text($('alertmatch'),`${e.home} ${e.homeScore} – ${e.awayScore} ${e.away}`);text($('alertdetail'),[e.team,e.scorer,e.minute?`${e.minute}'`:null].filter(Boolean).join(' · '));$('alert').classList.add('active');clearTimeout(timer);timer=setTimeout(nextAlert,Number(params.get('alert'))||settings.alertMs)}
function handleEvent(e){if(seen.has(e.eventId))return;seen.add(e.eventId);history.unshift(e);history=history.slice(0,100);if($('ticker')){tickerQueue.push(e);if(!tickerBusy)nextTicker()}if(['goal','red_card'].includes(e.kind)&&settings.goalAlerts&&$('alert')){queue.push(e);if(!paused)nextAlert()}}
new EventSource('/events').onmessage=m=>{try{const x=JSON.parse(m.data);if(x.type==='state'){Object.assign(COMPETITIONS,x.competitions||{});for(const [k,v] of Object.entries(COMPETITIONS))names[k]=v.name.toUpperCase();fixtures=x.fixtures;history=x.history;settings=x.settings;applyTheme();for(const e of history)seen.add(e.eventId);tickerQueue=[];tickerBusy=false;clearTimeout(tickerTimeout);feed=[...history].reverse().slice(-MAX_FEED);queue=[];paused=false;clearTimeout(timer);if($('alert'))$('alert').classList.remove('active');draw();drawTicker()}else if(x.type==='catalog'){Object.assign(COMPETITIONS,x.competitions||{});for(const [k,v] of Object.entries(COMPETITIONS))names[k]=v.name.toUpperCase();settings=x.settings;draw()}else if(x.type==='fixtures'){fixtures=x.fixtures;draw()}else if(x.type==='event'){handleEvent(x)}else if(x.type==='settings'){settings=x.settings;applyTheme();position=0;draw();drawTicker()}}catch(e){console.error(e)}};
let last=Date.now();setInterval(()=>{const now=Date.now();if(!paused&&now-last>=(Number(params.get('rotate'))||settings.rotationMs)){const p=pages();if(p.length){position=(position+1)%p.length;draw()}last=now}},500);
