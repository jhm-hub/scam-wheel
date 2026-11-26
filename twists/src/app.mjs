import {MODES,SETTINGS_FIELDS,defaultSettings,normalizeSettings,createRound,activateRound,wheelItems,chooseIndex,land,money,roundStatus} from './model.mjs';
import {makeRenderer,THEME,rotationAt} from './render.mjs';
import {sceneDuration} from './scenes.mjs';
import {createLive,newRoomKey,validRoomKey} from './live.mjs';
import {restoreCheckpoint} from './checkpoint.mjs';
import {nextRotation,resolveLanding,spinTurns} from '../../arcade/vendor/model/spin.ts';
import {sliceCenterDeg,sliceAtAngle} from '../../arcade/vendor/model/geometry.ts';

const $=id=>document.getElementById(id),ids=Object.keys(MODES),params=new URLSearchParams(location.search);
const viewer=params.get('view')==='stream',storageKey='faith-twists-v1';
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
const read=(key)=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
const bounded=(value,low,high,fallback)=>typeof value==='number'&&Number.isFinite(value)&&value>=low&&value<=high?value:fallback;
const hex=(value,fallback)=>/^#[a-f0-9]{6}$/i.test(value||'')?value:fallback;
function configFrom(raw={}) {
  raw=raw&&typeof raw==='object'?raw:{};
  return {version:1,mode:ids.includes(raw.mode)?raw.mode:'bin',guided:raw.guided!==false,scenario:['story','gentle','big'].includes(raw.scenario)?raw.scenario:'story',quick:raw.quick!==false,
    sound:raw.sound!==false,volume:bounded(raw.volume,0,100,35),pace:bounded(raw.pace,3,9,5.8),showBill:raw.showBill!==false,
    theme:{...THEME,pink:hex(raw.theme?.pink,THEME.pink),lilac:hex(raw.theme?.lilac,THEME.lilac)},
    settings:Object.fromEntries(ids.map(id=>[id,normalizeSettings(id,raw.settings?.[id])]))};
}
let config=configFrom(read(storageKey));
if(ids.includes(params.get('mode')))config.mode=params.get('mode');
if(['story','gentle','big'].includes(params.get('scenario'))){config.scenario=params.get('scenario');config.guided=true;}
const fragment=new URLSearchParams(location.hash.slice(1));
let key=fragment.get('room');
if(!validRoomKey(key)&&!viewer){key=read('faith-twists-room-v1');if(!validRoomKey(key)){key=newRoomKey();write('faith-twists-room-v1',key);}}
if(!viewer&&key){const u=new URL(location.href);u.hash='room='+key;history.replaceState(null,'',u);}
const checkpointKey='faith-twists-round-v1-'+key;
document.body.classList.toggle('viewer',viewer);
if(viewer){document.documentElement.style.background='transparent';$('viewer-status').hidden=false;}
const canvas=$('game'),renderer=makeRenderer(canvas);
let epoch=0,ready=false,auto=false,tour=false,tourIndex=0,loopRunning=false,actions=[],audio,live,chatConnected=false,chatConnecting=false,chatRequest=0,confirmedAction=null,lastLedger='',lastUi=0,lastTick=-1,lastTickAt=0,waiting=viewer,duplicate=false;
const timers=new Set();
function initial(round=createRound(config.mode,config.settings[config.mode],{quick:config.quick,scenario:config.guided?config.scenario:'random'})) {
  return {round,previousRound:null,items:wheelItems(round.phase==='complete'?activateRound({...round,phase:'ready'}):round),rotation:0,spinMotion:null,stage:round.phase==='complete'?'complete':'idle',stageAt:Date.now(),stageDuration:1,sceneActive:round.phase==='active'||round.phase==='complete',busy:false,theme:{...config.theme},showBill:config.showBill,scriptedLabel:round.scenario==='random'?'':'SCRIPTED DEMO',reduced};
}
let state=initial();
function persist(){if(viewer||duplicate)return;const ok=write(storageKey,config);$('save-note').textContent=ok?'Settings saved in this browser.':'Browser storage is unavailable. Use Save settings to keep your changes.';}
function saveRound(){if(viewer||duplicate)return;write(checkpointKey,{version:1,mode:state.round.mode,settings:state.round.settings,quick:state.round.normalStep===0&&config.quick,scenario:state.round.scenario,actions});}
function restoreRound() {
  const saved=read(checkpointKey);
  if(!saved?.actions?.length||saved.mode!==config.mode||params.get('fresh')==='1'||params.has('scenario')&&saved.scenario!==config.scenario)return;
  const restored=restoreCheckpoint(saved,config.mode);
  if(!restored){$('notice').textContent='Started a fresh round; the saved round could not be restored.';return;}
  const {round}=restored;state={...initial(round),previousRound:restored.previousRound,items:restored.items,rotation:restored.rotation};actions=restored.actions;config.settings[round.mode]=round.settings;config.quick=saved.quick;config.guided=round.scenario!=='random';if(config.guided)config.scenario=round.scenario;
  $('notice').textContent='Restored your last completed landing.';
}
if(!viewer)restoreRound();

function setText(id,value){if($(id).textContent!==value)$(id).textContent=value;}
function optionFields(){
  $('money-fields').replaceChildren();
  for(const field of SETTINGS_FIELDS[config.mode].filter(field=>field.key!=='openingValues')){
    const label=document.createElement('label');label.className='field';label.textContent=field.label;
    const input=document.createElement('input');input.id='amount-'+field.key;input.dataset.key=field.key;input.dataset.count=field.count||'';input.type=field.type==='list'?'text':'number';input.inputMode='decimal';input.autocomplete='off';
    if(field.type!=='list'){input.min=String(field.min);input.max=String(field.max);input.step=String(field.step);}
    const value=config.settings[config.mode][field.key];input.value=Array.isArray(value)?value.join(', '):value;
    label.append(input);$('money-fields').append(label);
  }
  $('opening-values').value=config.settings[config.mode].openingValues.join(', ');
}
for(const id of ids)$('mode').add(new Option(MODES[id].name,id));
function syncConfigUi(){
  $('mode').value=config.mode;$('scenario').value=config.scenario;$('quick').checked=config.quick;$('pace').value=config.pace;$('volume').value=config.volume;$('pink').value=config.theme.pink;$('lilac').value=config.theme.lilac;$('show-bill').checked=config.showBill;
  document.documentElement.style.setProperty('--pink',config.theme.pink);document.documentElement.style.setProperty('--lilac',config.theme.lilac);
  optionFields();ui();
}
function ui(){
  const r=state.round,busy=state.busy,known=!(state.stage==='spin'||state.stage==='activation');
  Object.assign(canvas.dataset,{mode:r.mode,phase:r.phase,stage:state.stage,step:String(r.step),normalStep:String(r.normalStep),total:String(r.total),quote:String(r.quote),scam:String(r.scam),opening:String(r.opening),busy:String(busy),scenario:r.scenario,waiting:String(waiting),items:String(state.items.length)});
  canvas.setAttribute('aria-label',MODES[r.mode].name+'. '+(known?roundStatus(r):'Spin in progress.'));
  if(viewer)return;
  $('mode').value=config.mode;$('mode').disabled=busy||auto||duplicate;
  ['guided','random','scenario','quick','next','apply-settings','load-settings'].forEach(id=>$(id).disabled=busy||auto||duplicate);
  ['reset','sound','pace','volume','pink','lilac','show-bill','opening-values','settings-file','channel','allow-mods'].forEach(id=>$(id).disabled=duplicate);
  $('money-fields').querySelectorAll('input').forEach(input=>input.disabled=duplicate);
  $('connect-chat').disabled=duplicate||chatConnecting;
  $('guided').setAttribute('aria-pressed',String(config.guided));$('random').setAttribute('aria-pressed',String(!config.guided));$('scenario-field').hidden=!config.guided;
  $('spin').disabled=!ready||busy||auto||duplicate;
  setText('spin',busy?state.stage==='activation'?'Scam activated!':state.stage==='spin'?'Spinning...':'Watch the reveal':r.phase==='complete'?'Play again':r.phase==='ready'?'Spin - activate scam':'Spin');
  $('auto').disabled=!ready||busy&&!auto||duplicate;setText('auto',auto?'Pause after spin':config.guided?'Play this demo':'Play random round');
  $('tour').disabled=!ready||busy&&!auto||duplicate;setText('tour',auto&&tour?'Pause tour':'Show all eight');
  setText('turn',auto&&tour?'Tour '+(tourIndex+1)+' of 8'+(busy?' - playing':''):busy?'One press. Let the whole reveal play.':roundStatus(r));
  setText('hook',MODES[r.mode].hook);setText('rule',MODES[r.mode].rule);setText('finish-rule',MODES[r.mode].spins+' scam spins. '+(r.mode==='rent'?'Rent is added each turn.':'The final quote is settled once.')+' The opening balance stays.');
  const shown=busy&&state.previousRound?state.previousRound:r;
  setText('opening',money(shown.opening));setText('quote',money(state.sceneActive?shown.quote:0));setText('quote-label',r.phase==='complete'&&!busy?'Scam added':'Scam quote');
  document.querySelector('.private-totals .total span').textContent=r.phase==='complete'&&!busy?'Final total':'Opening + current quote';
  setText('total',money(shown.opening+(state.sceneActive?shown.quote:0)));
  setText('sound',config.sound?'Sound on':'Sound off');$('sound').setAttribute('aria-pressed',String(config.sound));
  setText('preview-label',config.guided?'GUIDED PREVIEW':'RANDOM PLAY');setText('pace-value',config.pace.toFixed(1)+' seconds');
  const revealReady=state.stage==='reveal'&&(Date.now()-state.stageAt)>state.stageDuration*.67;
  const last=(revealReady||!busy)?r.last:null;
  setText('result-eyebrow',state.stage==='activation'?'HERE COMES THE CATCH':r.phase==='complete'&&!busy?'ROUND COMPLETE':state.sceneActive?MODES[r.mode].name.toUpperCase():'YOUR NEXT LITTLE PROBLEM');
  setText('result-headline',state.stage==='activation'?'SCAM ACTIVATED':state.stage==='spin'?'Let it land...':MODES[r.mode].name);
  setText('result-detail',state.stage==='activation'?MODES[r.mode].hook:state.stage==='spin'?'':last?.detail||MODES[r.mode].hook);
  const ledger=JSON.stringify(shown.ledger);
  if(ledger!==lastLedger){lastLedger=ledger;$('ledger').replaceChildren();for(const row of shown.ledger){const li=document.createElement('li'),label=document.createElement('span'),value=document.createElement('strong');label.textContent=row.label;value.textContent=money(row.amount);li.append(label,value);$('ledger').append(li);}}
}
function publish(){if(!viewer&&!duplicate)live?.sendState(state);}
function setStage(stage,duration=1){state.stage=stage;state.stageAt=Date.now();state.stageDuration=duration;publish();ui();}
function wait(ms,token){return new Promise(resolve=>{const id=setTimeout(()=>{timers.delete(id);resolve(epoch===token);},ms);timers.add(id);});}
function tone(freq,len=.12,delay=0,type='triangle',gain=.05){
  if(!config.sound||viewer||!audio)return;const token=epoch;
  const id=setTimeout(()=>{timers.delete(id);if(token!==epoch||!config.sound||!audio)return;const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(Math.max(.0001,gain*config.volume/100),t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+len);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+len+.02);o.onended=()=>{o.disconnect();g.disconnect();};},delay);timers.add(id);
}
async function unlockSound(){if(viewer||!config.sound)return;try{audio??=new AudioContext();await Promise.race([audio.resume(),new Promise(resolve=>setTimeout(resolve,250))]);}catch{setText('notice','Sound is unavailable in this browser. The demo still works.');}}
function cue(kind){const ns={start:[392,523,659,1047],catch:[784,698,587,880,1047],land:[523,659,784],final:[523,659,784,1047,1319]}[kind]||[659];ns.forEach((n,i)=>tone(n,.14,i*90,kind==='catch'?'square':'triangle',kind==='catch'?.018:.05));}
function resetRound({keepAuto=false}={}){
  if(viewer||duplicate)return false;
  epoch++;if(!keepAuto){auto=false;tour=false;}actions=[];state=initial();lastLedger='';saveRound();syncConfigUi();publish();
  const url=new URL(location.href);url.searchParams.set('mode',config.mode);url.searchParams.delete('scenario');history.replaceState(null,'',url);
  return true;
}
async function confirmation(title,detail,button='Reset round'){
  if(confirmedAction)return false;
  const dialog=$('confirm');$('confirm-title').textContent=title;$('confirm-detail').textContent=detail;dialog.querySelector('.danger').textContent=button;
  return new Promise(resolve=>{confirmedAction=resolve;dialog.returnValue='';dialog.addEventListener('close',()=>{const done=confirmedAction;confirmedAction=null;done?.(dialog.returnValue==='confirm');},{once:true});dialog.showModal();});
}
async function changeRound(change){
  if(viewer||duplicate){syncConfigUi();return false;}
  if(state.busy||auto)return false;
  if(actions.length&&state.round.phase!=='complete'&&!await confirmation('Start a fresh round?','This clears the current round so the new selection can start.','Start fresh')){syncConfigUi();return false;}
  if(duplicate)return false;
  change();persist();resetRound();return true;
}
async function advance(){
  if(viewer||state.busy||!ready||duplicate)return false;
  if(matchMedia('(max-width: 860px)').matches)document.querySelector('.stage').scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});
  if(state.round.phase==='complete')resetRound({keepAuto:true});
  const token=epoch;state.busy=true;ui();await unlockSound();if(token!==epoch)return false;
  try{
    if(state.round.phase==='ready'){
      cue('start');setStage('activation',reduced?650:2000);if(!await wait(state.stageDuration,token))return false;
      state.round=activateRound(state.round);state.sceneActive=true;
    }
    const before=state.round,items=wheelItems(before),index=chooseIndex(before,random);
    const layout=items.map((_,i)=>({index:i,startTurn:i/items.length,sizeTurn:1/items.length}));
    const rest=sliceCenterDeg(layout[index]),resolved=resolveLanding(layout,rest,{magnetism:true,seamBandDeg:0});
    if(resolved.kind!=='winner'||resolved.slice!==index)throw Error('The selected wedge did not match the pointer.');
    const from=state.rotation,to=nextRotation(from,resolved.restAngle,spinTurns(0));
    if(sliceAtAngle(layout,((90-to)%360+360)%360)!==index)throw Error('The wheel landing did not match its result.');
    state.previousRound=before;state.items=items;
    const duration=reduced?550:config.pace*1000;
    state.spinMotion={from,to,at:Date.now(),duration};lastTick=-1;setStage('spin',duration);
    if(!await wait(duration,token))return false;
    state.rotation=to%360;state.spinMotion=null;
    const draws=[];state.round=land(before,index,()=>{const n=random();draws.push(n);return n;});actions.push({index,draws});saveRound();
    cue('land');
    const effectTime=before.phase==='normal'?1300:reduced?1200:Math.max(3000,sceneDuration(state.round)+650);
    if(state.round.last?.catch){const alarm=setTimeout(()=>{timers.delete(alarm);if(epoch===token)cue('catch');},effectTime*.34);timers.add(alarm);}
    setStage('reveal',effectTime);
    if(!await wait(effectTime,token))return false;
    if(state.round.phase==='complete'){
      if(!await wait(reduced?250:1200,token))return false;
      state.busy=false;setStage('complete',650);cue('final');
    }else{state.busy=false;setStage('idle');}
    return true;
  }catch(error){
    if(token!==epoch)return false;
    auto=false;tour=false;state.busy=false;state.spinMotion=null;setText('notice','The round paused: '+(error?.message||'Please reset and try again.'));setStage('idle');return false;
  }
}
async function playLoop(){
  if(loopRunning)return;loopRunning=true;
  try{
    while(auto){
      if(state.round.phase==='complete'){
        if(!tour){auto=false;break;}
        const token=epoch;if(!await wait(2800,token)||!auto)break;
        tourIndex++;if(tourIndex>=ids.length){auto=false;tour=false;setText('notice','All eight demos complete. Pick a game to try another outcome.');break;}
        config.mode=ids[tourIndex];resetRound({keepAuto:true});
      }
      if(!auto||!await advance())break;
      const token=epoch;if(!await wait(900,token))break;
    }
  }finally{loopRunning=false;ui();}
}
function viewerUrl(){const u=new URL(location.href);u.search='?view=stream';u.hash='room='+key;return u.href;}
async function connectChatFromUi(unlock=false){
  if(viewer||duplicate)return;
  const request=++chatRequest;chatConnecting=true;ui();
  try{
    if(unlock)await unlockSound();
    if(request!==chatRequest||duplicate)return;
    const connected=await live.connectChat($('channel').value,$('allow-mods').checked);
    if(request===chatRequest&&!duplicate)chatConnected=connected;
  }finally{
    if(request===chatRequest){chatConnecting=false;setText('connect-chat',chatConnected?'Disconnect chat':'Connect chat');ui();}
  }
}
function connectLive(){
  if(!validRoomKey(key)){setText('viewer-status','Open the clean-view link from the private control desk.');return;}
  live=createLive({key,viewer,
    onState:(received,timing)=>{
      if(!viewer)return;waiting=false;
      state={...received,reduced,stageAt:received.stageAt+timing.clockOffsetMs,spinMotion:received.spinMotion?{...received.spinMotion,at:received.spinMotion.at+timing.clockOffsetMs}:null};
      $('viewer-status').hidden=true;ui();
    },
    onStatus:(message,info)=>{
      if(viewer){if(info?.code==='waiting'||info?.code==='offline'){waiting=true;$('viewer-status').hidden=false;}if(waiting)setText('viewer-status',message);}
      else{
        const wasDuplicate=duplicate;duplicate=info?.code==='duplicate';
        if(duplicate){
          if(!wasDuplicate){epoch++;chatRequest++;state.busy=false;state.spinMotion=null;state.stage=state.round.phase==='complete'?'complete':'idle';state.stageAt=Date.now();state.stageDuration=1;if($('confirm').open)$('confirm').close('cancel');}
          auto=false;tour=false;chatConnected=false;chatConnecting=false;setText('connect-chat','Connect chat');
        }
        setText('connection-status',message);ui();
      }
    },
    onChatStatus:(message)=>{setText('chat-status',message);if(message==='Twitch disconnected'&&!chatConnecting){chatConnected=false;setText('connect-chat','Connect chat');}},
    onCommand:(command)=>{
      if(viewer||duplicate)return;
      if(command==='spin'){if(!auto)void advance();}
      if(command==='reset'){resetRound();setText('notice','Round reset by an authorized chat command.');}
      if(command==='next'&&!state.busy&&!auto){config.mode=ids[(ids.indexOf(config.mode)+1)%ids.length];persist();resetRound();}
    }
  });
  if(viewer)live.requestState();else publish();
}

if(!viewer){
  $('spin').addEventListener('click',()=>void advance());
  document.addEventListener('keydown',event=>{if(event.code!=='Space'||event.repeat||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||/INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY/.test(event.target.tagName)||$('confirm').open)return;event.preventDefault();void advance();});
  $('mode').addEventListener('change',()=>{const mode=$('mode').value;void changeRound(()=>config.mode=mode);});
  $('guided').addEventListener('click',()=>void changeRound(()=>config.guided=true));$('random').addEventListener('click',()=>void changeRound(()=>config.guided=false));
  $('scenario').addEventListener('change',()=>{const value=$('scenario').value;void changeRound(()=>config.scenario=value);});
  $('quick').addEventListener('change',()=>{const value=$('quick').checked;void changeRound(()=>config.quick=value);});
  $('reset').addEventListener('click',async()=>{if(duplicate)return;if(!actions.length&&!state.busy||await confirmation('Reset this round?','This clears the current round and stops any automatic playback.'))resetRound();});
  $('next').addEventListener('click',()=>void changeRound(()=>config.mode=ids[(ids.indexOf(config.mode)+1)%ids.length]));
  $('auto').addEventListener('click',async()=>{if(auto){auto=false;tour=false;ui();return;}if(state.busy||loopRunning||duplicate)return;const token=epoch;await unlockSound();if(token!==epoch||duplicate)return;if(state.round.phase==='complete')resetRound();auto=true;tour=false;ui();void playLoop();});
  $('tour').addEventListener('click',async()=>{if(auto){auto=false;tour=false;ui();return;}if(state.busy||loopRunning||duplicate)return;if(actions.length&&state.round.phase!=='complete'&&!await confirmation('Start the eight-game tour?','The tour starts a new guided round for each game.','Start tour'))return;if(duplicate)return;config.guided=true;config.scenario='story';config.quick=true;config.mode=ids[0];tourIndex=0;auto=true;tour=true;resetRound({keepAuto:true});const token=epoch;await unlockSound();if(token!==epoch||duplicate)return;void playLoop();});
  $('sound').addEventListener('click',()=>{if(duplicate)return;config.sound=!config.sound;persist();ui();if(config.sound)void unlockSound();});
  $('pace').addEventListener('input',()=>{if(duplicate)return;config.pace=Number($('pace').value);persist();ui();});$('volume').addEventListener('input',()=>{if(duplicate)return;config.volume=Number($('volume').value);persist();});
  for(const key of ['pink','lilac'])$(key).addEventListener('input',()=>{if(duplicate)return;config.theme[key]=$(key).value;state.theme={...config.theme};document.documentElement.style.setProperty('--'+key,config.theme[key]);persist();publish();});
  $('show-bill').addEventListener('change',()=>{if(duplicate)return;config.showBill=$('show-bill').checked;state.showBill=config.showBill;persist();publish();});
  $('apply-settings').addEventListener('click',async()=>{
    if(duplicate)return;
    try{
      const draft={...config.settings[config.mode]};
      for(const field of SETTINGS_FIELDS[config.mode]){
        const el=field.key==='openingValues'?$('opening-values'):$('amount-'+field.key);
        const values=field.type==='list'?el.value.split(',').map(s=>s.trim()):[el.value.trim()];
        if(field.count&&values.length!==field.count)throw Error(field.label+' needs '+field.count+' comma-separated values.');
        const numbers=values.map(s=>s===''?NaN:Number(s));
        if(numbers.some(n=>!Number.isFinite(n)||n<0||n>100000||Math.abs(n*100-Math.round(n*100))>.00001))throw Error('Use amounts from 0 to 100,000 with at most two decimal places.');
        draft[field.key]=field.type==='list'?numbers:numbers[0];
      }
      const mode=config.mode;if(await changeRound(()=>config.settings[mode]=normalizeSettings(mode,draft)))setText('settings-status','Amounts applied to a fresh round.');
    }catch(error){setText('settings-status',error.message);}
  });
  $('save-settings').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(config,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='faith-eight-twists-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('load-settings').addEventListener('click',()=>{if(!duplicate)$('settings-file').click();});
  $('settings-file').addEventListener('change',async()=>{const file=$('settings-file').files[0];if(!file)return;if(duplicate){$('settings-file').value='';return;}const token=epoch;try{if(file.size>64000)throw Error('That settings file is too large.');const raw=JSON.parse(await file.text());if(token!==epoch||duplicate)return;if(raw.version!==1||!raw.settings||typeof raw.settings!=='object')throw Error('Choose an Eight Twists settings file.');if(await changeRound(()=>config=configFrom(raw)))setText('settings-status','Settings loaded.');}catch(error){setText('settings-status',error.message);}finally{$('settings-file').value='';}});
  $('open-view').addEventListener('click',()=>window.open(viewerUrl(),'faith-twists-clean'));
  $('copy-view').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(viewerUrl());setText('connection-status','OBS link copied. Add it as a Browser Source; keep this desk open.');}catch{setText('connection-status','Clipboard unavailable. Open clean view and copy its address.');}});
  $('connect-chat').addEventListener('click',async()=>{if(duplicate||chatConnecting)return;if(chatConnected){chatRequest++;live?.disconnectChat();chatConnected=false;setText('connect-chat','Connect chat');return;}await connectChatFromUi(true);});
  $('allow-mods').addEventListener('change',async()=>{if(!duplicate&&(chatConnected||chatConnecting))await connectChatFromUi();});
}
function frame(now){
  const wall=Date.now();
  if(!viewer||!waiting)renderer.draw(state,wall);
  if(!viewer&&state.stage==='spin'&&config.sound){const index=Math.floor((((90-rotationAt(state,wall))%360+360)%360)/360*state.items.length);if(index!==lastTick&&wall-lastTickAt>75){lastTick=index;lastTickAt=wall;tone(1300,.025,0,'triangle',.018);}}
  if(now-lastUi>200){lastUi=now;ui();}
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(viewer)live?.requestState();else publish();}});
window.addEventListener('beforeunload',()=>live?.dispose());
void (async()=>{
  try{await document.fonts.load('900 32px Nunito');}catch{setText('notice','Font loading was interrupted. Reload for the full look.');}
  ready=true;syncConfigUi();connectLive();requestAnimationFrame(frame);
})();
