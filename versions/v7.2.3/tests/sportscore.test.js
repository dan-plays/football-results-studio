'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createSportScoreFeed,normalize,competitionCode,londonDate}=require('../sportscore-feed');
test('classifies leagues without mixing Scottish and English divisions',()=>{
 assert.equal(competitionCode({competition:{name:'Premier League',country:'England'}}),'PL');
 assert.equal(competitionCode({competition:{name:'League One',country:'Scotland'}}),'SL1');
 assert.equal(competitionCode({competition:{name:'Championship',country:'England'}}),'CH');
 assert.match(competitionCode({competition:{name:'League One',country:'France'}}),/^W[A-F0-9]{12}$/);
});
test('normalizes a fixture',()=>{const x=normalize({id:15,competition:{name:'Championship',country:'England'},home:'Hull City',away:'Derby County',home_score:2,away_score:1,status:'live'});assert.equal(x.id,'ss-15');assert.equal(x.homeScore,2);assert.equal(x.status,'LIVE')});
test('polling baseline and score change emits one goal',async()=>{
 let fixtures=[],events=[],count=0;const base={id:15,competition:{name:'Championship',country:'England'},home:'Hull City',away:'Derby County',home_score:0,away_score:0,status:'live'};
 const feed=createSportScoreFeed({apply:m=>{if(m.type==='fixtures')fixtures=m.data;else events.push(m.data)},getFixtures:()=>fixtures,notify:()=>{},fetchJson:async()=>({fixtures:[{...base,home_score:count++?1:0}]}),now:()=>new Date('2026-10-20T12:00:00Z')});
 await feed.action({action:'refresh'});assert.equal(events.length,0);
 await feed.action({action:'refresh'});assert.equal(events.length,1);assert.equal(events[0].kind,'goal');
 await feed.action({action:'refresh'});assert.equal(events.length,1);
});
test('worldwide fixtures from multiple countries normalize and remain distinct',()=>{
 const france=normalize({id:91,competition:{name:'Ligue 1',country:'France'},home:'Paris',away:'Lyon',home_score:1,away_score:0,status:'live'});
 const brazil=normalize({id:92,competition:{name:'Serie A',country:'Brazil'},home:'Flamengo',away:'Palmeiras',home_score:0,away_score:0,status:'half time'});
 assert.match(france.competition,/^W/);assert.match(brazil.competition,/^W/);assert.notEqual(france.competition,brazil.competition);
 assert.equal(france.status,'LIVE');assert.equal(brazil.status,'HT');
});

test('uses a stable URL identifier when SportScore omits match id',()=>{
 const f={competition:{name:'Serie A',country:'Brazil'},home:'Flamengo',away:'Palmeiras',url:'/football/game/123',status:'live'};
 assert.equal(normalize(f).id,'ss-/football/game/123');
});
test('worldwide catalog exposes normalized fixtures',async()=>{
 let fixtures=[];const feed=createSportScoreFeed({apply:m=>{if(m.type==='fixtures')fixtures=m.data},getFixtures:()=>fixtures,notify:()=>{},fetchJson:async()=>({fixtures:[{competition:{name:'Serie A',country:'Brazil'},home:'Flamengo',away:'Palmeiras',url:'/game/123',status:'live'}]})});
 await feed.action({action:'refresh'});assert.equal(feed.catalog().length,1);assert.equal(fixtures.length,1);
});

test('unknown country cannot become English FA Cup by name alone',()=>{assert.match(competitionCode({competition:{name:'FA Cup'}}),/^W[A-F0-9]{12}$/)});

test('regional Champions Leagues never become UEFA Champions League',()=>{
 for(const country of ['China','Thailand','Asia','Africa','Country unspecified']){
  assert.match(competitionCode({competition:{name:'Champions League',country}}),/^W[A-F0-9]{12}$/);
 }
 assert.equal(competitionCode({competition:{name:'Champions League',country:'UEFA'}}),'UCL');
});
test('generic or youth league names do not become EFL League Two',()=>{
 assert.match(competitionCode({competition:{name:'League Two U21',country:'England'}}),/^W/);
 assert.match(competitionCode({competition:{name:'League Two',country:'Unknown'}}),/^W/);
 assert.equal(competitionCode({competition:{name:'League Two',country:'England'}}),'L2');
});
test('ambiguous missing-country cups stay separate from FA Cup',()=>{
 assert.match(competitionCode({competition:'FA Cup'}),/^W/);
});
