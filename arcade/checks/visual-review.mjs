import {drawScene} from "../src/scenes.mjs";
import {MODES,DEFAULTS,createRound,activate,board,choose,land} from '../src/model.mjs';
import {THEME} from '../src/config.mjs';
import {sceneTiming} from '../src/motion.mjs';
import {makeRenderer} from '../src/render.mjs';
const $=id=>document.getElementById(id),renderer=makeRenderer($('canvas'));
let moments=[],index=0,elapsed=0,start=0,playing=false,all=false,samples=[],draws=[],last=null,records=[];
for(const [id,def] of Object.entries(MODES))$('mode').add(new Option(def.name,id));
function state(round,overlay,selected=null){const items=board(round);return {round,items,scene:round.mode,rotation:selected===null?0:90-(selected+0.5)*360/items.length,motion:null,selected,overlay,effect:null,busy:false,reduced:false,theme:THEME,transformAt:0,hudAt:0,tickAt:0};}
function prepare(){
 const mode=$('mode').value,prices=$('large').checked?{cash:1000,bonus:1000,spins:10}:DEFAULTS;moments=[];records=[];
 let r=createRound(mode,prices,true,true);const normal={...r,phase:'normal'};
 moments.push({name:'Activation alert',duration:1740,state:{...state(normal,{kind:'intro',name:MODES[mode].name,at:0}),scene:'normal'}});
 r=activate(r,2);
 moments.push({name:'Wheel transformation',duration:1100,state:{...state(r,null),transformAt:1,previousScene:{...state(normal,null),scene:'normal'}}});
 if(mode==='dice')moments.push({name:'Bonus die',duration:2700,state:state(r,{kind:'die',value:2,start:prices.spins,rollTime:1450,at:0})});
 let count=0;
 while(r.phase!=='complete'&&count++<60){
  const i=mode==='tower'&&$('large').checked?0:choose(r),before=r;r=land(r,i,()=>0.3);const e=r.last;
  const add=(kind,duration,extra={})=>moments.push({name:r.step+'. '+e.label+' / '+kind,duration,state:state(r,{kind,entry:e,at:0,...extra},i)});
  if(e.kind==='arcade')add('arcade',sceneTiming(mode,e).duration);
  else if(e.kind==='rent'){add('property',1400);add('rent',2700);}
  else if(e.kind==='candy'){add('candy',2200);if(e.matched)add('match',2300);}
  else if(e.kind==='exit'){add('exit',1700);add('math',2000,{before:e.before,after:e.after,mult:before.mult});}
  else add('popup',1800,{title:e.label,main:e.kind==='boost'||e.kind==='total'?'x'+r.mult:'+$'+e.amount,sub:e.kind==='boost'?'Next cash collects the boost':'Added to the bill'});
 }
 moments.push({name:'Final bill',duration:2000,state:state(r,{kind:'final',detail:'Scripted visual review',at:0})});
 $('moment').replaceChildren(...moments.map((m,i)=>new Option(m.name,String(i))));select(0);
}
function select(i){playing=false;index=i;elapsed=0;samples=[];draws=[];last=null;$('moment').value=String(i);$('time').max=String(moments[i].duration);$('time').value='0';$('status').textContent=moments[i].name;}
function play(){samples=[];draws=[];last=null;elapsed=0;start=performance.now();playing=true;}
$('mode').onchange=()=>{all=false;prepare();};$('large').onchange=()=>{all=false;prepare();};$('moment').onchange=()=>{all=false;select(Number($('moment').value));};
$('time').oninput=()=>{playing=all=false;elapsed=Number($('time').value);};
$('play').onclick=()=>{all=false;play();};$('all').onclick=()=>{select(0);all=true;play();};
$('action').onclick=()=>{playing=all=false;elapsed=moments[index].state.overlay?.kind==='arcade'?Math.round(sceneTiming($('mode').value,moments[index].state.overlay.entry).reveal*0.55):Math.min(1000,moments[index].duration/2);$('time').value=String(elapsed);};
$('settled').onclick=()=>{playing=all=false;elapsed=moments[index].duration;$('time').value=String(elapsed);};
$('joins').onclick=()=>{
 playing=all=false;
 const c=document.createElement('canvas');c.width=1000;c.height=920;const ctx=c.getContext('2d',{willReadFrequently:true}),checks=[];
 for(const m of moments.filter(v=>v.state.overlay?.kind==='arcade')){
  ctx.clearRect(0,0,1000,920);drawScene(ctx,{...m.state,reduced:$('reduced').checked},m.duration+240);ctx.getImageData(300,230,400,410);
  ctx.clearRect(0,0,1000,920);drawScene(ctx,{...m.state,reduced:$('reduced').checked},m.duration+240);const before=ctx.getImageData(300,230,400,410).data;
  ctx.clearRect(0,0,1000,920);drawScene(ctx,{...m.state,overlay:null,reduced:$('reduced').checked},m.duration+240);const after=ctx.getImageData(300,230,400,410).data;
  let changed=0,box=[400,410,0,0],sample=null;for(let i=0;i<before.length;i+=4)if(Math.max(...[0,1,2,3].map(k=>Math.abs(before[i+k]-after[i+k])))>12){changed++;const x=i/4%400,y=Math.floor(i/4/400);box=[Math.min(box[0],x),Math.min(box[1],y),Math.max(box[2],x),Math.max(box[3],y)];sample??={x,y,before:[...before.slice(i,i+4)],after:[...after.slice(i,i+4)]};}
  checks.push({moment:m.name,changedPixels:changed,box,sample});
 }
 $('metrics').textContent=JSON.stringify(checks,null,2);$('status').textContent='Scene joins checked';
};
$('fades').onclick=()=>{
 playing=all=false;
 const c=document.createElement('canvas');c.getContext('2d',{willReadFrequently:true});const test=makeRenderer(c),checks=[];
 const pixels=()=>c.getContext('2d').getImageData(0,0,c.width,Math.floor(c.height*760/920)).data;
 for(const m of moments.filter(v=>v.state.overlay)){
  const t=m.duration+240,o={...m.state.overlay,exitAt:m.duration},s={...m.state,overlay:o,reduced:$('reduced').checked};
  test.draw(s,t);pixels();test.draw(s,t);const before=pixels();
  test.draw({...s,overlay:null},t);const after=pixels();
  let changed=0,box=[c.width,c.height,0,0];for(let i=0;i<before.length;i+=4)if([0,1,2,3].some(k=>Math.abs(before[i+k]-after[i+k])>12)){changed++;const x=i/4%c.width,y=Math.floor(i/4/c.width);box=[Math.min(box[0],x),Math.min(box[1],y),Math.max(box[2],x),Math.max(box[3],y)];}
  checks.push({moment:m.name,changedPixels:changed,box});
 }
 const transform=moments.find(v=>v.name==='Wheel transformation')?.state;
 if(transform)for(const [name,t,expected] of [['Transformation start',1,transform.previousScene],['Transformation end',1100,{...transform,previousScene:null,transformAt:0}]]){
  const s={...transform,reduced:false};test.draw(s,t);pixels();test.draw(s,t);const before=pixels();test.draw(expected,t);const after=pixels();let changed=0;
  for(let i=0;i<before.length;i+=4)if([0,1,2,3].some(k=>Math.abs(before[i+k]-after[i+k])>12))changed++;
  checks.push({moment:name,changedPixels:changed});
 }
 const sample=moments.find(v=>v.state.overlay?.kind==='arcade');
 if(sample){
  const scene=document.createElement('canvas');scene.width=1000;scene.height=920;const ctx=scene.getContext('2d',{willReadFrequently:true});
  ctx.globalAlpha=0;drawScene(ctx,sample.state,0);const data=ctx.getImageData(0,0,1000,920).data;let visible=0;
  for(let i=3;i<data.length;i+=4)if(data[i])visible++;
  checks.push({moment:'Hidden parent layer',changedPixels:visible});
 }
 $('metrics').textContent=JSON.stringify(checks,null,2);$('status').textContent='Fades and layers checked';
};
function frame(t){
 const m=moments[index];if(!m){requestAnimationFrame(frame);return;}
 if(playing){if(last!==null&&!document.hidden)samples.push(t-last);elapsed=Math.min(m.duration,t-start);$('time').value=String(Math.round(elapsed));}
 last=t;const s={...m.state,reduced:$('reduced').checked};const drawAt=performance.now();renderer.draw(s,elapsed);draws.push(performance.now()-drawAt);
 $('canvas').dataset.mode=$('mode').value;$('canvas').dataset.moment=String(index);$('canvas').dataset.elapsed=String(Math.round(elapsed));$('canvas').dataset.playing=String(playing);
 if(playing&&elapsed===m.duration){
  const pct=(arr,p)=>[...arr].sort((a,b)=>a-b)[Math.floor((arr.length-1)*p)]||0;
  const result={mode:$('mode').value,moment:m.name,frames:samples.length,frameP95:+pct(samples,.95).toFixed(2),drawP95:+pct(draws,.95).toFixed(2),longFrames:samples.filter(v=>v>50).length};records.push(result);$('metrics').textContent=JSON.stringify(records,null,2);playing=false;
  if(all&&index<moments.length-1){select(index+1);play();}else {all=false;$('status').textContent='Review complete: '+MODES[$('mode').value].name;}
 }
 requestAnimationFrame(frame);
}
document.fonts.ready.then(()=>{prepare();requestAnimationFrame(frame);});
