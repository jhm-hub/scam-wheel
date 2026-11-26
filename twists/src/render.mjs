import {drawEffectA} from './effects-a.mjs';
import {drawEffectB} from './effects-b.mjs';
import {money, MODES} from './model.mjs';

const W=900,H=1040,TAU=Math.PI*2,CX=450,CY=445,R=340;
export const THEME={pink:'#e599bd',lilac:'#bba6e4',cream:'#fff2d7',ink:'#35213f',gold:'#f3d68a',mint:'#a8ddce'};
const clamp=n=>Math.max(0,Math.min(1,n));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
export function spinProgress(t){t=clamp(t);return 10*t*t-20*t*t*t+15*t*t*t*t-4*t*t*t*t*t;}
export function rotationAt(state,now){const m=state.spinMotion;return m?mix(m.from,m.to,spinProgress((now-m.at)/m.duration)):state.rotation;}

function faceItems(state,p){
  if(!state.sceneActive)return state.items;
  const r=state.stage==='spin'&&state.previousRound?state.previousRound:state.round;
  const before=state.previousRound?.data||r.data;
  const data=state.stage==='reveal'&&p<.66?before:r.data;
  return state.items.map(item=>{
    const id=item.id;
    if(r.mode==='bin')return {...item,sub:'PICK ME'};
    if(r.mode==='sticky')return {...item,label:'FREE',sub:'PRIZE '+String.fromCharCode(65+id)};
    if(r.mode==='cutting')return {...item,label:money(data.pots[id]),sub:'CUT '+money(r.settings.cut)};
    if(r.mode==='rent')return {...item,label:'FREE',sub:'ZONE '+String.fromCharCode(65+id)};
    if(r.mode==='seats')return {...item,label:'FREE',sub:'BOOKING '+String.fromCharCode(65+id)};
    if(r.mode==='baggage')return {...item,sub:'ADD TO BILL'};
    if(r.mode==='refund')return {...item,sub:(state.stage==='reveal'&&p<.66?state.previousRound?.step??r.step:r.step)===0?'REFUNDABLE':'STORE CREDIT'};
    if(r.mode==='fall')return {...item,label:id===3?'FREE':money(r.settings.prices[id]),sub:id===3?'LUCKY YOU':'PAY'};
    return item;
  });
}
function revealCopy(round,p){
  const e=round.last;
  if(!e||e.kind==='normal')return [MODES[round.mode].hook,''];
  const early=p<(round.mode==='bin'?.5:round.mode==='sticky'?.46:.3);
  switch(round.mode){
    case 'bin':return [round.step<2?'YOUR PICK IS A GIVEAWAY':early?'WHAT A BARGAIN...':'YOU BOUGHT EVERYTHING LEFT',round.step<2?'The selected wedge leaves.':round.data.remaining.map(id=>money(round.settings.prices[id])).join(' + ')+' = '+money(round.quote)];
    case 'sticky':return round.step<3?['THE FREE WEDGES ARE STUCK TOGETHER',round.step===1?'One is free. Anything attached costs extra.':'The next spin picks your one free wedge.']:[early?'ONE FREE PRIZE!':e.paid?.length?'THE REST CAME WITH IT':'THIS ONE REALLY IS FREE',(e.paid?.length||0)+' attached x '+money(round.settings.price)+' = '+money(round.quote)];
    case 'cutting':return [e.cut===0?'NOTHING LEFT TO CUT':early?'YOU SAVED '+money(e.cut):'YOUR SAVING GOT COPIED TWICE',e.cut===0?'No extra charge this time.':'-'+money(e.cut)+' here. +'+money(e.cut)+' on BOTH others.'];
    case 'rent':return [early?'THIS WEDGE IS FREE':e.charges?.length?'ONLY THIS WEDGE IS FREE':'FREE. FOR NOW.',e.charges?.length?e.charges.map(c=>money(c.amount)).join(' + ')+' = '+money(e.amount)+' rent this spin':'The free pass moves on your next spin.'];
    case 'seats':return [early?'FREE BOOKING!':e.movements?.length?'FREE UNTIL YOU GET BUMPED':'YOUR FREE SPOT IS SAFE',e.movements?.length?'Every pushed booking picks up its new price.':'Occupied wedges are waiting for the next spin.'];
    case 'baggage':return [early?'JUST '+e.weight+' KG':e.retagged?'NEW RATE. EVERY PREVIOUS BAG.':'EVERY KILO COUNTS',round.data.weight+' kg x '+money(round.data.rate)+'/kg = '+money(round.quote)];
    case 'refund':return [round.step===1?(early?'REFUND APPROVED!':'STORE CREDIT. YOU STILL OWE.'):(e.extra>0?'YOUR REFUND RAN OUT':'CREDIT COVERS THIS ONE'),round.step===1?money(e.price)+' credit. Two compulsory spins.':money(e.creditUsed)+' credit used + '+money(e.extra)+' extra cash'];
    case 'fall':return [e.drop?.primary.free?(early?'FREE! YOU ESCAPED...':'FREE MEANS TWO PAID PICKS'):'ONE LANDING. ONE CHARGE.',e.drop?.primary.free?e.drop.minis.map(m=>money(m.amount)).join(' + ')+' = '+money(e.drop.amount):money(e.drop?.amount||0)+' added'];
    default:return [e.headline,e.detail];
  }
}
export function makeRenderer(canvas){
  const ctx=canvas.getContext('2d'),ratio=Math.min(window.devicePixelRatio||1,2);
  canvas.width=W*ratio;canvas.height=H*ratio;
  const ringCache=new Map();let theme=THEME;
  function text(str,x,y,size=28,color=theme.cream,maxWidth=790){
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`1000 ${size}px Nunito`;
    while(ctx.measureText(str).width>maxWidth&&size>17){size--;ctx.font=`1000 ${size}px Nunito`;}
    ctx.fillStyle=color;ctx.fillText(str,x,y);ctx.restore();
  }
  function circle(x,y,r,fill,stroke,width=2){ctx.beginPath();ctx.arc(x,y,r,0,TAU);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
  function star(x,y,s,color){ctx.fillStyle=color;ctx.fillRect(x-s*.12,y-s/2,s*.24,s);ctx.fillRect(x-s/2,y-s*.12,s,s*.24);}
  function panel(x,y,w,h,fill,stroke=theme.cream){const c=12;ctx.beginPath();ctx.moveTo(x+c,y);ctx.lineTo(x+w-c,y);ctx.lineTo(x+w,y+c);ctx.lineTo(x+w,y+h-c);ctx.lineTo(x+w-c,y+h);ctx.lineTo(x+c,y+h);ctx.lineTo(x,y+h-c);ctx.lineTo(x,y+c);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=3;ctx.stroke();}
  function baseWheel(items,rotation,selected,spinning){
    circle(CX,CY+7,363,theme.ink);circle(CX,CY,360,theme.lilac,theme.cream,5);circle(CX,CY,350,theme.ink,theme.pink,5);
    const key=JSON.stringify([items.map(i=>[i.label,i.sub]),theme]);let face=ringCache.get(key);
    if(!face){
      face=document.createElement('canvas');face.width=face.height=1440;const c=face.getContext('2d');c.scale(2,2);c.translate(360,360);
      const n=items.length;
      items.forEach((item,i)=>{
        const a=i*TAU/n-Math.PI,b=(i+1)*TAU/n-Math.PI;
        c.beginPath();c.moveTo(0,0);c.arc(0,0,338,a,b);c.closePath();c.fillStyle=i%2?theme.pink:theme.lilac;c.fill();c.strokeStyle=theme.cream;c.lineWidth=3;c.stroke();
        c.save();c.rotate((a+b)/2);c.translate(228,0);c.rotate(Math.PI/2);
        let size=n>8?38:n>5?43:52;const width=Math.min(258,2*Math.sin(Math.PI/n)*214-12);
        c.textAlign='center';c.textBaseline='middle';c.font=`1000 ${size}px Nunito`;
        while(c.measureText(item.label).width>width&&size>17){size--;c.font=`1000 ${size}px Nunito`;}
        c.lineJoin='round';c.lineWidth=4;c.strokeStyle='#694770';c.strokeText(item.label,0,item.sub?-14:0);c.fillStyle=theme.cream;c.fillText(item.label,0,item.sub?-14:0);
        if(item.sub){let subsize=21;c.font=`900 ${subsize}px Nunito`;while(c.measureText(item.sub).width>width&&subsize>13){subsize--;c.font=`900 ${subsize}px Nunito`;}c.fillText(item.sub,0,27);}
        c.restore();
      });
      ringCache.set(key,face);if(ringCache.size>48)ringCache.delete(ringCache.keys().next().value);
    }
    ctx.save();ctx.translate(CX,CY);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(face,-360,-360,720,720);
    if(selected!==null&&selected!==undefined&&!spinning){const a=selected*TAU/items.length-Math.PI,b=(selected+1)*TAU/items.length-Math.PI;ctx.beginPath();ctx.arc(0,0,329,a+.01,b-.01);ctx.strokeStyle=theme.gold;ctx.lineWidth=12;ctx.stroke();}
    ctx.restore();
  }
  function fittings(now,state){
    for(let i=0;i<48;i++){const a=i*TAU/48,lit=Math.sin(now/180-i*.7)>.1;circle(CX+Math.cos(a)*350,CY+Math.sin(a)*350,lit?3.7:2.8,lit?theme.cream:'#9c719f');}
    circle(CX,CY+6,88,theme.ink);circle(CX,CY,88,theme.pink,theme.cream,4);circle(CX,CY,78,theme.lilac,theme.cream,2);text('SCAM',CX,CY-17,33);text('WHEEL',CX,CY+21,33);
    ctx.save();ctx.translate(CX,CY-R-9);ctx.shadowColor=theme.gold;ctx.shadowBlur=16;ctx.beginPath();ctx.moveTo(-17,-23);ctx.lineTo(17,-23);ctx.lineTo(23,-5);ctx.lineTo(0,35);ctx.lineTo(-23,-5);ctx.closePath();ctx.fillStyle=theme.cream;ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=theme.gold;ctx.lineWidth=4;ctx.stroke();ctx.restore();
    if(!state.sceneActive)[[80,180],[820,185],[99,745],[800,758]].forEach(([x,y],i)=>star(x,y+(state.reduced?0:Math.sin(now/950+i)*6),i%2?20:28,i%2?theme.pink:theme.gold));
  }
  function activation(state,now){
    const p=clamp((now-state.stageAt)/state.stageDuration),a=ease(p/.2)*(1-ease((p-.8)/.2));ctx.save();ctx.globalAlpha=a;ctx.translate(CX,CY+25*(1-a));ctx.scale(.92+.08*a,.92+.08*a);panel(-335,-85,670,170,theme.ink,theme.gold);for(let i=0;i<16;i++)circle(-305+i*40,-72,3.5,i%2===Math.floor(now/100)%2?theme.cream:theme.pink);text('SCAM ACTIVATED',0,-22,51,theme.cream,620);text(MODES[state.round.mode].name.toUpperCase(),0,35,29,theme.pink,610);ctx.restore();
  }
  function captions(state,now,p){
    if(state.stage==='spin'){text(state.sceneActive?'WATCH WHAT THE WHEEL DOES':'LET IT LAND...',CX,860,25);return;}
    if(state.stage==='activation')return;
    const [title,detail]=state.sceneActive?revealCopy(state.round,p):[state.round.phase==='ready'?'THE NEXT SPIN ACTIVATES THE SCAM':'SPIN '+(state.round.normalStep+1)+' OF 2',''];
    text(title,CX,850,31,theme.cream,790);
    if(detail&&p>=.74)text(detail,CX,894,23,theme.cream,790);
    if(state.stage==='complete'&&state.showBill){
      const a=ease((now-state.stageAt)/450);ctx.save();ctx.globalAlpha=a;
      panel(190,934,520,82,theme.ink,theme.gold);text('SCAM '+money(state.round.scam)+'  |  TOTAL '+money(state.round.total),CX,975,29,theme.cream,480);ctx.restore();
    }else if(state.sceneActive){
      const count=Math.min(state.round.step,MODES[state.round.mode].spins);text(count+' / '+MODES[state.round.mode].spins+' SCAM SPINS',CX,968,18,theme.lilac);
    }
  }
  return {draw(state,now=Date.now()){
    theme={...THEME,...state.theme};ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,W,H);
    const p=state.stage==='reveal'?clamp((now-state.stageAt)/Math.max(1,state.stageDuration)):1;
    const rotation=rotationAt(state,now),items=faceItems(state,p),spinning=state.stage==='spin';
    baseWheel(items,rotation,state.round.last?.index,spinning);
    if(state.sceneActive){
      const round=spinning&&state.previousRound?state.previousRound:state.round;
      const args={round,previousRound:state.previousRound,progress:p,time:now/1000,reduced:state.reduced,theme,items:state.items,rotation,spinning};
      ctx.save();if(!drawEffectA(ctx,args))drawEffectB(ctx,args);ctx.restore();
    }
    fittings(now,state);captions(state,now,p);
    if(state.scriptedLabel){ctx.save();ctx.globalAlpha=.85;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle=theme.cream;ctx.font='900 17px Nunito';ctx.fillText(state.scriptedLabel,45,32);ctx.restore();}
    if(state.stage==='activation')activation(state,now);
  }};
}
