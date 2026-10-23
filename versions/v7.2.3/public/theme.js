'use strict';
const THEME_PRESETS={dexter:{panel:'#211128',row:'#301934',accent:'#bd563f',ticker:'#17102a',text:'#f5effa',label:'#d8ef43'},sports:{panel:'#09292e',row:'#13414a',accent:'#24c4b0',ticker:'#071c23',text:'#f5effa',label:'#77eee2'},broadcast:{panel:'#091b49',row:'#153878',accent:'#e0b54e',ticker:'#071332',text:'#f5effa',label:'#f7d57c'}};
const THEME_LABELS={panel:'Scoreboard background',row:'Fixture / feed rows',accent:'Borders and highlights',ticker:'Vidiprinter background',text:'Main text',label:'Headings'};
let currentTheme={...THEME_PRESETS.dexter},competitionOverrides={};
const preset=document.getElementById('themePreset'),swatches=document.getElementById('themeSwatches'),compSwatches=document.getElementById('competitionSwatches');
function validHex(value){return /^#[0-9a-fA-F]{6}$/.test(value)}
function themeColorInput(name,value,callback){
 const label=document.createElement('label');label.className='hex-color-setting';
 const caption=document.createElement('span');caption.textContent=name;
 const controls=document.createElement('span');controls.className='hex-color-controls';
 const picker=document.createElement('input');picker.type='color';picker.value=value;
 picker.setAttribute('aria-label',name+' colour picker');
 const hex=document.createElement('input');hex.type='text';hex.value=value.toUpperCase();hex.maxLength=7;
 hex.spellcheck=false;hex.autocomplete='off';hex.setAttribute('aria-label',name+' hex code');
 const error=document.createElement('small');error.className='hex-error';error.textContent='Use #RRGGBB';
 function apply(next){picker.value=next;hex.value=next.toUpperCase();hex.classList.remove('invalid');callback(next)}
 picker.addEventListener('input',()=>apply(picker.value));
 hex.addEventListener('input',()=>{let next=hex.value.trim();if(/^[0-9a-fA-F]{6}$/.test(next))next='#'+next;if(validHex(next))apply(next);else hex.classList.add('invalid')});
 hex.addEventListener('blur',()=>{if(hex.classList.contains('invalid')){hex.value=picker.value.toUpperCase();hex.classList.remove('invalid')}});
 controls.append(picker,hex,error);label.append(caption,controls);return label;
}
function previewTheme(){const el=document.getElementById('themePreview');for(const key of ['panel','row','accent','ticker','text'])el.style.setProperty('--preview-'+key,currentTheme[key])}
function renderTheme(){swatches.replaceChildren(...Object.keys(THEME_LABELS).map(key=>themeColorInput(THEME_LABELS[key],currentTheme[key],value=>{currentTheme[key]=value;preset.value='custom';previewTheme()})));previewTheme()}
function renderCompetitions(){compSwatches.replaceChildren(...DEFAULT_ORDER.map(code=>themeColorInput(COMPETITIONS[code].name,competitionOverrides[code]||COMPETITIONS[code].color,value=>{competitionOverrides[code]=value}))) }
preset.onchange=()=>{if(THEME_PRESETS[preset.value]){currentTheme={...THEME_PRESETS[preset.value]};renderTheme()}};
document.getElementById('saveTheme').onclick=async()=>{try{await ingest('settings',{theme:{...currentTheme,preset:preset.value},competitionColors:competitionOverrides});feedback('Theme and competition colours saved — OBS browser sources update automatically')}catch(e){feedback(e.message)}};
document.getElementById('resetTheme').onclick=()=>{preset.value='dexter';currentTheme={...THEME_PRESETS.dexter};competitionOverrides=Object.fromEntries(DEFAULT_ORDER.map(c=>[c,COMPETITIONS[c].color]));renderTheme();renderCompetitions();feedback('Default colours selected; click Save theme to apply')};
const themeEvents=new EventSource('/events');themeEvents.onmessage=event=>{try{const data=JSON.parse(event.data);if(data.type!=='state'&&data.type!=='settings')return;const settings=data.settings||{};currentTheme={...THEME_PRESETS.dexter,...settings.theme};preset.value=settings.theme?.preset||'dexter';competitionOverrides={...settings.competitionColors};renderTheme();renderCompetitions()}catch(e){console.error(e)}};
renderTheme();renderCompetitions();
