import {money} from './model.mjs';

const TAU = Math.PI * 2;
const CENTER = {x:450,y:445};
const clamp = value => Math.max(0,Math.min(1,value));
const mix = (a,b,t) => a+(b-a)*t;
const ease = value => {const t=clamp(value);return t*t*(3-2*t);};
const beat = (p,start,end) => ease((p-start)/(end-start));
const pop = value => {const t=clamp(value);return 1+Math.sin(t*Math.PI)*.16;};

function point(angle,radius) {
  return {x:CENTER.x+Math.cos(angle)*radius,y:CENTER.y+Math.sin(angle)*radius};
}

function shortest(from,to) {
  return ((to-from+Math.PI)%TAU+TAU)%TAU-Math.PI;
}

function text(ctx,value,x,y,size,color,width=200) {
  ctx.save();ctx.font=`1000 ${size}px Nunito`;ctx.textAlign='center';ctx.textBaseline='middle';
  while(ctx.measureText(String(value)).width>width&&size>18){size--;ctx.font=`1000 ${size}px Nunito`;}
  ctx.fillStyle=color;ctx.fillText(String(value),x,y);ctx.restore();
}

function rect(ctx,x,y,w,h,fill,stroke,width=3) {
  const cut=7;
  ctx.beginPath();ctx.moveTo(x+cut,y);ctx.lineTo(x+w-cut,y);ctx.lineTo(x+w,y+cut);
  ctx.lineTo(x+w,y+h-cut);ctx.lineTo(x+w-cut,y+h);ctx.lineTo(x+cut,y+h);
  ctx.lineTo(x,y+h-cut);ctx.lineTo(x,y+cut);ctx.closePath();
  ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}

function dot(ctx,x,y,r,fill,stroke) {
  ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=3;ctx.stroke();}
}

function frame(ctx,angle,radius,fn,offset=0) {
  const at=point(angle,radius);
  ctx.save();ctx.translate(at.x,at.y);ctx.rotate(angle+Math.PI/2);ctx.translate(0,offset);fn();ctx.restore();
}

function annulus(ctx,angle,width,inner=96,outer=335) {
  ctx.beginPath();ctx.arc(CENTER.x,CENTER.y,outer,angle-width/2,angle+width/2);
  ctx.arc(CENTER.x,CENTER.y,inner,angle+width/2,angle-width/2,true);ctx.closePath();
}

function tint(ctx,angle,width,color,alpha,inner=96,outer=335) {
  if(alpha<=0)return;
  ctx.save();ctx.globalAlpha=alpha;annulus(ctx,angle,width-.018,inner,outer);
  ctx.fillStyle=color;ctx.fill();ctx.restore();
}

function ring(ctx,angle,width,radius,color,weight=6,alpha=1) {
  ctx.save();ctx.globalAlpha=alpha;ctx.beginPath();ctx.arc(CENTER.x,CENTER.y,radius,angle-width/2+.025,angle+width/2-.025);
  ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.stroke();ctx.restore();
}

function chip(ctx,angle,radius,label,theme,{width=130,height=42,size=28,fill=theme.ink,color=theme.cream,border=theme.cream,scale=1,offset=0}={}) {
  frame(ctx,angle,radius,()=>{
    ctx.scale(scale,scale);rect(ctx,-width/2,-height/2,width,height,fill,border);
    text(ctx,label,0,1,size,color,width-14);
  },offset);
}

function patch(ctx,angle,width,theme,index,{radius=224,height=104,alpha=1}={}) {
  ctx.save();annulus(ctx,angle,width-.019,96,335);ctx.clip();ctx.globalAlpha=alpha;
  frame(ctx,angle,radius,()=>{
    ctx.fillStyle=index%2?theme.pink:theme.lilac;ctx.fillRect(-180,-height/2,360,height);
  });ctx.restore();
}

function stamp(ctx,angle,radius,label,theme,amount=1,fill=theme.ink) {
  if(amount<=0)return;
  ctx.save();ctx.globalAlpha=amount;
  chip(ctx,angle,radius,label,theme,{width:label.length>7?142:116,height:38,size:24,border:theme.gold,fill,scale:pop(amount)});
  ctx.restore();
}

function config(args) {
  const {round,items=[],rotation=0,reduced=false,spinning=false}=args;
  const p=reduced||spinning?1:clamp(args.progress??1);
  const width=TAU/Math.max(1,items.length);
  const angle=id=>{const index=items.findIndex(item=>item.id===id);return index<0?undefined:-Math.PI+(index+.5)*width+rotation*Math.PI/180;};
  const index=id=>items.findIndex(item=>item.id===id);
  return {...args,round,p,width,angle,index,last:round.last||{},before:round.last?.beforeData||args.previousRound?.data||round.data};
}

function bin(ctx,a) {
  const {round,p,width,angle,index,theme,last,before}=a;
  const removed=last.removedId,selected=angle(removed),peel=beat(p,.08,.5);
  if(selected!==undefined){
    tint(ctx,selected,width,theme.ink,peel>0?1:0,mix(335,96,peel));
    if(peel>0&&peel<1){
      ctx.save();annulus(ctx,selected,width-.02,102,335);ctx.clip();
      const edge=335-peel*232;
      ring(ctx,selected,width,edge,theme.cream,16,Math.sin(peel*Math.PI));
      ring(ctx,selected,width,edge+9,theme.gold,5,Math.sin(peel*Math.PI));
      ctx.restore();
    }
    if(peel>.75){
      frame(ctx,selected,228,()=>{
        ctx.globalAlpha=beat(p,.42,.59);text(ctx,'GIVEN',0,-16,29,theme.mint,160);text(ctx,'AWAY',0,18,29,theme.mint,160);
      });
      ring(ctx,selected,width,319,theme.mint,5,beat(p,.42,.59));
    }
  }
  const ownership=before.revealed?1:round.data.revealed?beat(p,.54,.78):0;
  for(const id of round.data.remaining){
    const at=angle(id);if(at===undefined)continue;
    if(ownership){
      tint(ctx,at,width,theme.gold,.13*ownership);
      ring(ctx,at,width,315,theme.gold,8,ownership);
      stamp(ctx,at,142,'OWNED',theme,ownership);
      if(round.phase==='complete'){
        const pay=beat(p,.78,.95);
        ctx.save();ctx.globalAlpha=pay;
        chip(ctx,at,286,'PAY '+money(round.settings.prices[id]),theme,{width:Math.min(166,280*width-20),height:42,size:27,fill:theme.ink,border:theme.gold,scale:1+.07*Math.sin(pay*Math.PI)});
        ctx.restore();
      }
    } else if(index(id)>=0&&p>.6) {
      ring(ctx,at,width,315,theme.cream,3,.3);
    }
  }
}

function ribbon(ctx,from,to,radius,amount,color,theme,tug=0) {
  if(amount<=0||from===undefined||to===undefined)return;
  const distance=shortest(from,to),end=from+distance*amount;
  ctx.save();ctx.lineCap='round';
  for(const [weight,paint] of [[17,theme.ink],[11,color],[3,theme.cream]]){
    ctx.beginPath();
    for(let i=0;i<=35;i++){
      const t=i/35,at=point(mix(from,end,t),radius+tug*Math.sin(t*Math.PI));
      if(i===0)ctx.moveTo(at.x,at.y);else ctx.lineTo(at.x,at.y);
    }
    ctx.strokeStyle=paint;ctx.lineWidth=weight;ctx.stroke();
  }
  const at=point(end,radius);
  rect(ctx,at.x-8,at.y-8,16,16,color,theme.cream,2);ctx.restore();
}

function sticky(ctx,a) {
  const {round,p,width,angle,index,theme,last}=a;
  const final=round.step>=3;
  const tug=final&&!a.reduced&&!a.spinning?Math.sin(beat(p,.2,.55)*Math.PI)*17:0;
  round.data.links.forEach((link,group)=>{
    const newest=!final&&group===round.data.links.length-1;
    const radius=group%2?165:130;
    for(let i=1;i<link.length;i++){
      const amount=newest?beat(p,.12+(i-1)*.18,.38+(i-1)*.18):1;
      ribbon(ctx,angle(link[i-1]),angle(link[i]),radius,amount,group%2?theme.mint:theme.gold,theme,tug);
    }
  });
  if(!final){
    const seen=new Set(round.data.links.flat());
    for(const id of seen){const at=angle(id);if(at!==undefined)ring(ctx,at,width,314,theme.gold,5,.7);}
    return;
  }
  const selected=angle(round.data.selected),pull=beat(p,.1,.42),pay=beat(p,.46,.73);
  if(selected!==undefined){
    tint(ctx,selected,width,theme.mint,.2*pull);
    patch(ctx,selected,width,theme,index(round.data.selected));
    chip(ctx,selected,228+tug,'FREE',theme,{width:150,height:64,size:44,border:theme.gold,fill:theme.ink,scale:pop(pull)});
    stamp(ctx,selected,289,'YOUR PICK',theme,pull);
  }
  for(const id of round.data.paid){
    const at=angle(id);if(at===undefined)continue;
    const radius=228+tug*.55;
    tint(ctx,at,width,theme.gold,.17*pay);
    patch(ctx,at,width,theme,index(id));
    if(pay<.15)chip(ctx,at,radius,'FREE',theme,{width:150,height:64,size:44,border:theme.cream});
    else {
      chip(ctx,at,radius,money(round.settings.price),theme,{width:150,height:64,size:44,border:theme.gold,scale:pop(pay)});
      stamp(ctx,at,289,'ATTACHED',theme,pay);
    }
    ring(ctx,at,width,319,theme.gold,8,pay);
  }
  for(const item of a.items){
    if(round.data.connected.includes(item.id))continue;
    const at=angle(item.id);tint(ctx,at,width,theme.ink,.48*pay);
    stamp(ctx,at,145,'LEFT HERE',theme,pay);
  }
}

function flyingPrice(ctx,from,to,t,amount,theme,side) {
  if(t<=0||t>=1)return;
  const a=point(from,215),b=point(to,215);
  const sweep=shortest(from,to),angle=from+sweep*t;
  const at=point(angle,215+Math.sin(t*Math.PI)*(side?65:36));
  const alpha=Math.min(1,t*6,(1-t)*8);
  ctx.save();ctx.globalAlpha=alpha;ctx.translate(at.x,at.y);ctx.rotate(angle+Math.PI/2);
  rect(ctx,-73,-28,146,56,theme.ink,theme.gold,4);text(ctx,'+'+money(amount),0,1,35,theme.cream,130);
  ctx.restore();
  ctx.save();ctx.globalAlpha=alpha*.5;ctx.lineWidth=4;ctx.strokeStyle=theme.gold;ctx.setLineDash([7,7]);
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(at.x,at.y,b.x,b.y);ctx.stroke();ctx.restore();
}

function cutting(ctx,a) {
  const {round,p,width,angle,index,theme,last}=a;
  const chosen=last.pot,cut=Number(last.cut)||0;
  const erased=beat(p,.08,.26),flight=beat(p,.3,.65),arrive=beat(p,.64,.82);
  const values=last.from||round.data.pots,after=last.to||round.data.pots;
  for(let id=0;id<round.data.pots.length;id++){
    const at=angle(id);if(at===undefined)continue;
    patch(ctx,at,width,theme,index(id),{radius:220,height:115});
    const changed=id===chosen?erased:arrive;
    const value=id===chosen?(erased>=.55?after[id]:values[id]):(arrive>.15?after[id]:values[id]);
    frame(ctx,at,228,()=>{
      if(id===chosen&&erased>0&&erased<1){
        ctx.save();ctx.globalAlpha=1-erased;ctx.translate(0,-erased*26);text(ctx,money(values[id]),0,0,57,theme.cream,200);ctx.restore();
        ctx.strokeStyle=theme.gold;ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(-74,-7);ctx.lineTo(mix(-74,74,erased),7);ctx.stroke();
      }else text(ctx,money(value),0,0,57,theme.cream,200);
    });
    if(cut>0){
      const label=id===chosen?'-'+money(cut):'+'+money(cut);
      const show=id===chosen?beat(p,.22,.34):arrive;
      stamp(ctx,at,139,label,theme,show,id===chosen?'#35675c':theme.ink);
      ring(ctx,at,width,317,id===chosen?theme.mint:theme.gold,7,changed*.9);
      if(id!==chosen)tint(ctx,at,width,theme.gold,.13*arrive,270,335);
    }
  }
  if(cut>0&&flight>0&&flight<1){
    (last.receivers||[]).forEach((id,i)=>{
      const from=angle(chosen),to=angle(id);if(from!==undefined&&to!==undefined)flyingPrice(ctx,from,to,flight,cut,theme,i);
    });
  }
}

function house(ctx,angle,level,theme,scale=1) {
  frame(ctx,angle,293,()=>{
    ctx.scale(scale,scale);ctx.fillStyle=theme.ink;ctx.fillRect(-24,-10,48,35);
    ctx.fillStyle=theme.gold;
    for(let row=0;row<4;row++)ctx.fillRect(-27+row*7,-16-row*6,54-row*14,7);
    ctx.fillStyle=theme.cream;ctx.fillRect(-14,0,9,9);ctx.fillRect(6,0,9,9);
    ctx.fillStyle=theme.pink;ctx.fillRect(-5,13,10,12);
    if(level>1){ctx.fillStyle=theme.mint;ctx.fillRect(24,-9,15,34);ctx.fillStyle=theme.cream;ctx.fillRect(28,-3,6,7);ctx.fillRect(28,11,6,7);}
  });
}

function rent(ctx,a) {
  const {round,p,width,angle,index,theme,last,before}=a;
  const selected=last.property??round.data.current,from=before.current;
  const hop=beat(p,.1,.42),built=beat(p,.1,.32),charge=beat(p,.47,.72);
  const target=angle(selected),prior=from===null?undefined:angle(from);
  for(let id=0;id<round.data.rents.length;id++){
    const at=angle(id);if(at===undefined||round.data.rents[id]<=0)continue;
    const isSelected=id===selected;
    const show=isSelected?built:1;
    patch(ctx,at,width,theme,index(id),{height:109});
    house(ctx,at,round.data.levels[id],theme,(isSelected?pop(built):1)*show);
    if(isSelected){
      if(hop===1)chip(ctx,at,228,'FREE',theme,{width:154,height:64,size:44,border:theme.gold});
      else if(hop===0&&from===selected)chip(ctx,at,228,'FREE',theme,{width:154,height:64,size:44,border:theme.gold});
      else chip(ctx,at,228,money(last.rentAfter??round.data.rents[id]),theme,{width:154,height:64,size:44,border:theme.cream});
      stamp(ctx,at,138,'EXEMPT',theme,hop);
      ring(ctx,at,width,319,theme.mint,7,hop);
    }else{
      const retainedFree=id===from&&hop===0;
      chip(ctx,at,228,retainedFree?'FREE':money(round.data.rents[id]),theme,{width:154,height:64,size:44,border:charge?theme.gold:theme.cream,scale:charge?pop(charge):1});
      tint(ctx,at,width,theme.gold,.17*charge);
      stamp(ctx,at,138,'PAY RENT',theme,charge);
      ring(ctx,at,width,319,theme.gold,9,charge);
    }
  }
  if(target!==undefined&&hop<1){
    const start=prior??target;
    const position=start+shortest(start,target)*hop;
    const radius=228-Math.sin(hop*Math.PI)*72;
    chip(ctx,position,radius,'FREE',theme,{width:154,height:64,size:44,border:theme.gold,scale:1+.1*Math.sin(hop*Math.PI)});
  }
}

const EFFECTS={bin,sticky,cutting,rent};

export function drawEffectA(ctx,args) {
  const effect=EFFECTS[args.round?.mode];
  if(!effect)return false;
  if(!args.round.step||!args.items?.length)return true;
  const a=config(args);
  ctx.save();ctx.beginPath();ctx.arc(CENTER.x,CENTER.y,337,0,TAU);ctx.clip();
  effect(ctx,a);ctx.restore();
  return true;
}
