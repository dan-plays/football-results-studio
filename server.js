'use strict';
// Local-first football event hub. Node.js 18+, no dependencies.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const HOST=process.env.HOST||'127.0.0.1',PORT=Number(process.env.PORT||8787),TOKEN=process.env.INGEST_TOKEN||'',DATA=path.join(__dirname,'state.json');
const codes=['PL','CH','L1','L2','FAC','EFLC','UCL'];
const names={PL:'Premier League',CH:'EFL Championship',L1:'EFL League One',L2:'EFL League Two',FAC:'FA Cup',EFLC:'EFL Cup',UCL:'UEFA Champions League'};
let fixtures=[],history=[],settings={rotationMs:12000,alertMs:7500,goalAlerts:true,ticker:true},seq=0;const clients=new Set(),seen=new Set();
try{const s=JSON.parse(fs.readFileSync(DATA,'utf8'));fixtures=s.fixtures||[];history=s.history||[];settings={...settings,...s.settings};for(const e of history)if(e.eventId)seen.add(e.eventId)}catch{}
let saveTimer;function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{fs.writeFile(DATA+'.tmp',JSON.stringify({fixtures,history,settings},null,2),e=>{if(!e)fs.rename(DATA+'.tmp',DATA,()=>{})})},150)}
function reply(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj))}
function push(message){const packet=`id: ${++seq}\ndata: ${JSON.stringify(message)}\n\n`;for(const c of clients){try{c.write(packet)}catch{clients.delete(c)}}}
function state(){return {type:'state',fixtures,history,settings,competitions:names}}
function checkFixture(f){return f&&typeof f.id==='string'&&f.id.length>0&&f.id.length<=120&&codes.includes(f.competition)&&typeof f.home==='string'&&f.home.length>0&&f.home.length<=100&&typeof f.away==='string'&&f.away.length>0&&f.away.length<=100&&Number.isInteger(f.homeScore)&&f.homeScore>=0&&f.homeScore<=99&&Number.isInteger(f.awayScore)&&f.awayScore>=0&&f.awayScore<=99&&typeof f.status==='string'&&f.status.length<=40}
function apply(msg){if(!msg||typeof msg!=='object')throw Error('Expected object');if(msg.type==='fixtures'){
 if(!Array.isArray(msg.data)||msg.data.length>500||!msg.data.every(checkFixture)||new Set(msg.data.map(x=>x.id)).size!==msg.data.length)throw Error('Invalid fixture list');
 fixtures=msg.data.map(f=>({id:f.id,competition:f.competition,home:f.home,away:f.away,homeScore:f.homeScore,awayScore:f.awayScore,status:f.status,minute:f.minute??null,kickoff:f.kickoff??null}));persist();push({type:'fixtures',fixtures});return {ok:true,count:fixtures.length};
}if(msg.type==='event'){
 const e=msg.data;if(!e||!['goal','red_card','half_time','full_time','var','info','kickoff','correction'].includes(e.kind)||typeof e.fixtureId!=='string')throw Error('Invalid event');
 const f=fixtures.find(x=>x.id===e.fixtureId);if(!f)throw Error('Unknown fixtureId');const id=typeof e.eventId==='string'&&e.eventId.length<=150?e.eventId:crypto.randomUUID();if(seen.has(id))return {ok:true,duplicate:true};
 for(const key of ['homeScore','awayScore'])if(e[key]!==undefined){if(!Number.isInteger(e[key])||e[key]<0||e[key]>99)throw Error('Invalid '+key);f[key]=e[key]}
 if(e.status!==undefined){if(typeof e.status!=='string'||e.status.length>40)throw Error('Invalid status');f.status=e.status}
 if(e.minute!==undefined)f.minute=e.minute;
 const clean=(v,n)=>typeof v==='string'?v.slice(0,n):'';
 const item={type:'event',eventId:id,kind:e.kind,fixtureId:f.id,competition:f.competition,home:f.home,away:f.away,homeScore:f.homeScore,awayScore:f.awayScore,team:clean(e.team,100),scorer:clean(e.scorer,100),minute:clean(String(e.minute??''),12),message:clean(e.message,250),time:Date.now()};
 seen.add(id);history.unshift(item);history=history.slice(0,100);if(seen.size>5000){seen.clear();for(const h of history)seen.add(h.eventId)}persist();push({type:'fixtures',fixtures});push(item);return {ok:true,eventId:id};
}if(msg.type==='settings'){
 const d=msg.data||{};for(const k of ['rotationMs','alertMs'])if(d[k]!==undefined){if(!Number.isInteger(d[k])||d[k]<1000||d[k]>120000)throw Error('Invalid '+k);settings[k]=d[k]}
 for(const k of ['goalAlerts','ticker'])if(d[k]!==undefined){if(typeof d[k]!=='boolean')throw Error('Invalid '+k);settings[k]=d[k]}
 persist();push({type:'settings',settings});return {ok:true,settings};
}if(msg.type==='clear'){fixtures=[];history=[];seen.clear();persist();push(state());return {ok:true}}throw Error('Unknown type')}
function authorized(req){if(!TOKEN)return false;const t=req.headers['x-ingest-token'];return typeof t==='string'&&Buffer.byteLength(t)===Buffer.byteLength(TOKEN)&&crypto.timingSafeEqual(Buffer.from(t),Buffer.from(TOKEN))}
const files={'/':'dashboard.html','/dashboard':'dashboard.html','/overlay':'overlay.html','/ticker':'ticker.html','/goal':'goal.html','/panels':'panels.html','/app.css':'app.css','/overlay.js':'overlay.js','/dashboard.js':'dashboard.js'};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server=http.createServer((req,res)=>{let url;try{url=new URL(req.url,'http://localhost')}catch{return reply(res,400,{error:'Bad URL'})}
 if(req.method==='GET'&&url.pathname==='/health')return reply(res,200,{ok:true,fixtures:fixtures.length,clients:clients.size});
 if(req.method==='GET'&&url.pathname==='/state')return reply(res,200,state());
 if(req.method==='GET'&&url.pathname==='/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(`data: ${JSON.stringify(state())}\n\n`);clients.add(res);req.on('close',()=>clients.delete(res));return}
 if(req.method==='POST'&&url.pathname==='/ingest'){if(!authorized(req))return reply(res,401,{error:'Missing/invalid x-ingest-token; set INGEST_TOKEN before starting'});let body='',tooBig=false;req.on('data',b=>{body+=b;if(body.length>1000000){tooBig=true;req.destroy()}});req.on('end',()=>{if(tooBig)return;try{return reply(res,200,apply(JSON.parse(body)))}catch(e){return reply(res,400,{error:e.message})}});return}
 if(req.method==='GET'&&files[url.pathname]){const file=path.join(__dirname,'public',files[url.pathname]);res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; object-src 'none'"});return fs.createReadStream(file).pipe(res)}
 return reply(res,404,{error:'Not found'})});
setInterval(()=>{for(const c of clients){try{c.write(': keepalive\n\n')}catch{clients.delete(c)}}},25000).unref();
server.listen(PORT,HOST,()=>console.log(`Football Results Studio at http://${HOST}:${PORT}/dashboard`));
