import { progress, arc, smooth, sceneTiming } from "./motion.mjs";
import { EXTRA_MODES } from "./extended.mjs";
import { pixelSprite } from "./pixel-art.mjs";
const TAU = Math.PI * 2, clamp = (n) => Math.max(0, Math.min(1, n)), lerp = (a, b, t) => a + (b - a) * t, ease = (t) => 1 - (1 - t) ** 3;
const cream = "#fff0dd", gold = "#ffe0a0", pink = "#eea0bc", lilac = "#bc99dc", mint = "#a7dcc2";
function drawScene(ctx, s, t) {
  const mode = s.round.mode, def = EXTRA_MODES[mode], d = s.round.data;
  if (!def || !d) return;
  const e = s.overlay?.kind === "arcade" ? s.overlay.entry : null, age = e ? t - s.overlay.at : 10000, p = progress(age, 160, sceneTiming(mode,e).reveal - 100, s.reduced), before = e?.fx.before ?? d;
  const phase = (start,end) => progress(age,start,end,s.reduced);
  const text = (str, x, y, size = 20, color = cream, maxWidth = Infinity) => {
    const width = Math.min(maxWidth,Math.max(48, 2 * (Math.sqrt(Math.max(0, 180 * 180 - y * y)) - Math.abs(x)) - 10));
    ctx.font = "1000 " + size + "px Nunito";
    while (ctx.measureText(String(str)).width > width && size > 12) { size--; ctx.font = "1000 " + size + "px Nunito"; }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin="round";ctx.lineWidth=Math.max(1.2,size*0.075);ctx.strokeStyle="#38243f";
    ctx.strokeText(String(str),x,y);
    ctx.fillStyle = color;
    ctx.fillText(String(str), x, y);
  };
  const rect = (x, y, w, h, fill, stroke) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    }
  };
  const circle = (x, y, r, fill, stroke) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };
  const line = (points, color = gold, width = 3) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.stroke();
  };
  const sprite = (name, x, y, size = 64, variant = 0, angle = 0, alpha = 1) => pixelSprite(ctx, name, x, y, size, variant, angle, alpha);
  ctx.save();
  ctx.translate(500, 435);
  ctx.shadowColor = "#1b0d2988";
  ctx.shadowBlur = 12;
  circle(0, 0, 190, "#3a2548", def.colors[2]);
  ctx.shadowBlur = 0;
  circle(0, 0, 183, "#32223f", "#bd96b977");
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 180, 0, TAU);
  ctx.clip();
  for (let i = 0; i < 16; i++) {
    const x = i * 71 % 310 - 155, y = i * 91 % 306 - 153;
    rect(x, y, 2, 2, "#dec3e415");
  }
  switch (mode) {
    case "baggage": {
      const rows = Math.max(1,Math.ceil(d.weights.length / 4)), size = Math.min(64,152 / rows), gap = Math.min(60,size + 4);
      for (let i=0;i<d.weights.length;i++) {
        const x=-96+i%4*64,y=75-Math.floor(i/4)*gap,newest=e&&i===d.weights.length-1;
        const q=newest?phase(160,1050):1,drop=newest?(1-q)*-155:0;
        sprite("parcel",x,y+drop,size,i, newest?Math.sin(q*Math.PI)*0.12:0,newest?0.35+q*0.65:1);
        text(d.weights[i]+"kg",x,y+23+drop,15);
      }
      rect(-126,108,252,14,"#8e647b");rect(-101,122,202,7,"#e7bd97");
      text("HEAVIEST RATE",0,-135,16,def.colors[2]);
      text("$"+Math.round(lerp(before.rate,d.rate,p)*s.round.prices.cash)+" / KG",0,-105,27,gold);
      text(Math.round(lerp(before.weight,d.weight,p))+" KG PACKED",0,-69,18);
      break;
    }
    case "auction": {
      const ranked=d.bids.map((value,index)=>({value,index})).sort((a,b)=>b.value-a.value).slice(0,2),cols=4,rows=Math.ceil(d.bids.length/cols),gap=Math.min(54,145/Math.max(1,rows));
      text("THE TOP TWO BOTH COUNT",0,-131,14,def.colors[2]);
      for(let i=0;i<d.bids.length;i++) {
        const q=e&&i===d.bids.length-1?phase(180,900):1,x=-98+i%cols*66,y=-65+Math.floor(i/cols)*gap+(1-q)*35,isTop=ranked.some(v=>v.index===i);
        ctx.save();ctx.globalAlpha*=q;
        rect(x-25,y-18,50,36,isTop?"#aa7095":"#5a4169",isTop?gold:"#a786ae");rect(x-3,y+18,6,16,"#b89183");text("$"+d.bids[i],x,y,19,cream,44);ctx.restore();
      }
      const strike=e&&s.round.phase==="complete"?phase(850,1350):0;
      sprite("gavel",57,106,71,0,-Math.sin(strike*Math.PI)*0.65);
      text(s.round.phase==="complete"?"SOLD x 2":"TOP TWO PAY",-45,127,18,gold);
      break;
    }
    case "race": {
      text("FINISH AT " + d.finish, 0, -130, 22, def.colors[2]);
      for (let i = 0; i < 3; i++) {
        const y = -67 + i * 70;
        rect(-131, y + 15, 260, 15, ["#674557", "#554568", "#3e5c58"][i]);
        for (let k = 0; k < 7; k++) rect(-125 + k * 38, y + 21, 18, 2, "#e7cfe344");
        const pos = lerp(before.distance[i], d.distance[i], p) / d.finish;
        const x = -102 + Math.min(1, pos) * 204;
        sprite("horse", x, y - 3 - (before.distance[i] !== d.distance[i] && !s.reduced ? Math.abs(Math.sin(p*Math.PI*6))*Math.sin(p*Math.PI)*6 : 0), 59, i, s.reduced ? 0 : Math.sin(p * Math.PI * 6) * Math.sin(p * Math.PI) * 0.04);
        text(Math.round(lerp(before.distance[i],d.distance[i],p)), -140, y + 4, 22, [pink, lilac, mint][i]);
      }
      for (let y = -111; y < 117; y += 16) for (let j = 0; j < 2; j++) rect(122 + j * 8, y, 8, 8, (Math.floor((y + 111) / 16) + j) % 2 ? "#fce3cf" : "#88718d");
      break;
    }
    case "stamps": {
      const stamp=phase(180,750),lineP=phase(750,1250);
      for(let i=0;i<9;i++) {
        const x=-65+i%3*65,y=-65+Math.floor(i/3)*65,changed=e?.fx.index===i,marked=changed?stamp>0.65:d.marks[i]>0;
        rect(x-27,y-27,55,55,marked?"#9571a1":"#e9d4c2",marked?gold:"#c8a9ba");
        if(marked){sprite("stamp",x,y-6,39,i);rect(x-24,y+7,48,18,"#4c345d");text("$"+d.marks[i],x,y+16,16,cream,45);}else text(i+1,x,y,25,"#775271");
        if(changed&&stamp<1){sprite("stamp",x,y-85*(1-stamp),55+14*(1-stamp),i,0,1-stamp*0.3);}
      }
      const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8]];
      for(const i of d.lines){const q=before.lines.includes(i)?1:lineP,ends=[lines[i][0],lines[i][2]].map(v=>[-65+v%3*65,-65+Math.floor(v/3)*65]);ctx.save();ctx.globalAlpha*=0.7;line([ends[0],[lerp(ends[0][0],ends[1][0],q),lerp(ends[0][1],ends[1][1],q)]],gold,4);ctx.restore();}
      text((lineP<1?before.lines.length:d.lines.length)+" DUTY LINES",0,132,18,gold);
      break;
    }
    case "bubble": {
      const pop=e&&d.pops>before.pops,inflate=phase(150,pop?850:1500),burst=phase(850,1250),refill=phase(1250,1800);
      const oldRatio=before.air/before.capacity,newRatio=d.air/d.capacity;
      if(pop){
        const size=90+137*lerp(oldRatio,1,inflate);
        sprite("bubble",0,-14,size,before.pops%3,0,1-burst);
        if(!s.reduced&&burst>0&&burst<1)for(let i=0;i<16;i++){const a=i*TAU/16;circle(Math.cos(a)*(85+burst*85),-14+Math.sin(a)*(85+burst*85),9*(1-burst),[pink,lilac,mint][i%3]);}
        sprite("bubble",0,-14,90+newRatio*137,d.pops%3,0,refill);
      }else sprite("bubble",0,-14,90+lerp(oldRatio,newRatio,inflate)*137,d.pops%3);
      const settled=!pop?inflate>=1:refill>=1;
      text((settled?d.air:Math.round(lerp(before.air,pop?before.capacity:d.air,inflate)))+" / "+(settled?d.capacity:before.capacity)+" AIR",0,116,24,def.colors[2]);
      text((settled?d.pops:before.pops)+" POP BONUSES",0,144,16);
      break;
    }
    case "seats": {
      const moved=e?.moved||[],move=phase(160,1150),arrive=phase(moved.length?1050:160,moved.length?1700:950);
      for(let i=0;i<6;i++){
        const a=-Math.PI/2+i*TAU/6,x=Math.cos(a)*107,y=Math.sin(a)*107;
        sprite("chair",x,y,63,i);text(i+1,x,y+29,14,gold);
        if(e&&age<1800&&!s.reduced){
          if(before.occupied[i]&&!moved.includes(i))sprite("charm",x,y-5,25,0);
        }else if(d.occupied[i])sprite("charm",x,y-5,25,0);
      }
      if(e&&age<1800&&!s.reduced){
        for(const i of moved){const a=-Math.PI/2+(i+move)*TAU/6;sprite("charm",Math.cos(a)*107,Math.sin(a)*107-5-arc(move,10),25,0);}
        const a=-Math.PI/2+e.fx.index*TAU/6;sprite("charm",Math.cos(a)*107,Math.sin(a)*107-5-90*(1-arrive),25,0,0,arrive);
      }
      text("GUESTS MOVED",0,-15,13);text(Math.round(lerp(before.moves,d.moves,move)),0,20,38,gold);
      if(d.standing)text("STANDING: "+d.standing,0,53,14,pink);
      break;
    }
    case "blocks": {
      const drop=phase(180,900),clear=phase(1000,1400),settle=phase(1400,1850),added=e?.fx.item;
      for(let col=0;col<4;col++)for(let row=0;row<10;row++)rect(-62+col*33,115-row*25,30,22,"#4c385d","#715275");
      const heights=e?before.heights.map((h,i)=>h+(i===added.column?added.value:0)):d.heights;
      for(let col=0;col<4;col++)for(let row=0;row<Math.min(10,heights[col]);row++){
        const fresh=e&&col===added.column&&row>=before.heights[col],cleared=e&&row<e.cleared;
        const y=115-row*25-(fresh?(1-drop)*200:0)+(e&&!cleared?e.cleared*25*settle:0);
        ctx.save();ctx.globalAlpha*=cleared?1-clear:1;
        rect(-62+col*33,y,30,22,[pink,lilac,mint,gold][col]);rect(-59+col*33,y+3,23,3,"#fff3db99");rect(-36+col*33,y+6,3,14,"#49294266");
        if(cleared&&clear>0){ctx.globalAlpha*=Math.sin(clear*Math.PI)*0.7;rect(-62+col*33,y,30,22,"#fff7d9");}ctx.restore();
      }
      text((settle<1?before.lines:d.lines)+" ROWS CLEARED",0,151,16,gold);
      break;
    }
    case "charms": {
      line([[-122,-65],[-70,-9],[0,16],[70,-9],[122,-65]],gold,5);
      for(let i=0;i<3;i++){
        const x=-92+i*92,y=i===1?8:-11,changed=e?.fx.item.charm===i,q=changed?phase(180,1000):1,count=changed&&q<0.8?before.counts[i]:d.counts[i];
        sprite("charm",x,y,70+(changed?arc(q,12):0),i,changed?Math.sin(q*Math.PI*2)*0.13:0,count?1:0.35);
        if(changed&&q<1)sprite("charm",x,y-100*(1-q),42,i,0,q*(1-q)*3);
        text(count+(count===1?" COPY":" COPIES"),x,y+59,18,cream,82);text("$"+count*s.round.prices.cash*(i+1)+" EACH",x,y+83,17,gold,82);
      }
      text("EVERY COPY GETS REPRICED",0,-127,14,def.colors[2]);
      break;
    }
    case "toll": {
      circle(0, 0, 124, "#4f415a");
      circle(0, 0, 83, "#668777");
      ctx.strokeStyle = "#e7d7b6";
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 9]);
      ctx.beginPath();
      ctx.arc(0, 0, 105, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 12; i++) {
        const a2 = -Math.PI / 2 + i * TAU / 12, x = Math.cos(a2) * (i % 3 === 0 ? 152 : 118), y = Math.sin(a2) * (i % 3 === 0 ? 152 : 118);
        if (i % 3 === 0) {
          rect(x - 23, y - 14, 46, 29, "#b6819d", gold);
          text("$" + (i === 0 ? 4 : i / 3) * s.round.prices.cash, x, y, 15, cream,40);
        } else circle(x, y, 3, "#f8dbb6");
      }
      const travel = lerp(before.travel, d.travel, p), a = -Math.PI / 2 + travel * TAU / 12;
      sprite("car", Math.cos(a) * 105, Math.sin(a) * 105, 47, 0, a + Math.PI / 2);
      const crossed=e?e.stops.slice(0,Math.floor((d.travel-before.travel)*p+0.00001)).filter(v=>v%3===0).length:0;
      text(e?before.gates+crossed:d.gates, 0, -11, 42, gold);
      text("TOLLS", 0, 29, 16);
      break;
    }
    case "credit": {
      const spend=phase(180,1050),shown=Math.round(lerp(before.spent,d.spent,spend)),ratio=Math.min(1,shown/d.limit),decline=phase(850,1200);
      sprite("card",0,-26,219,0,d.over&&!s.reduced?Math.sin(decline*Math.PI*2)*0.05:0);
      rect(-112,67,224,20,"#22132f","#c7a7ce");rect(-109,70,218*ratio,14,ratio===1?pink:mint);
      text("$"+shown+" / $"+d.limit,0,112,20,def.colors[2]);text(d.over&&shown>d.limit?"OVER LIMIT +$"+(shown-d.limit):"AVAILABLE CREDIT",0,-126,17,d.over?pink:cream);
      if(d.over){ctx.save();ctx.globalAlpha*=decline;line([[-82,-52],[-35,-20],[-14,-44],[12,-4],[38,-19],[79,23]],"#fff1e3",4);ctx.restore();}
      break;
    }
    case "map": {
      const values = [1, 2, 1, 3, 1, 2, 2, 3, 4];
      for (let i = 0; i < 9; i++) {
        const x2 = -64 + i % 3 * 64, y2 = -64 + Math.floor(i / 3) * 64;
        rect(x2 - 28, y2 - 28, 56, 56, i % 2 ? "#9e9c7d" : "#7d9b87", "#d9d7b0");
        text("$" + values[i] * s.round.prices.cash, x2, y2 + 13, 20, "#fff4df",48);
        rect(x2 - 20, y2 - 18, 8, 7, "#bed5ae");
        rect(x2 - 10, y2 - 22, 9, 9, "#b7d6b0");
      }
      let x=lerp(before.x,d.x,p),y=lerp(before.y,d.y,p);
      if(e?.wrap&&!s.reduced){
        const [dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][e.fx.item.direction];
        const q=p<0.5?p*2:(p-0.5)*2;
        x=p<0.5?before.x+dx*q:d.x-dx*(1-q);y=p<0.5?before.y+dy*q:d.y-dy*(1-q);
        ctx.globalAlpha*=p<0.5?1-q:q;
      }
      sprite("compass",-64+x*64,-82+y*64-arc(p,8),32);
      ctx.globalAlpha=1;
      text(d.detours + (d.detours === 1 ? " DETOUR" : " DETOURS"), 0, 130, 20, gold);
      break;
    }
    case "plinko": {
      for(let row=0;row<6;row++)for(let col=0;col<5;col++)circle(-96+col*48,-115+row*31,3,"#e7c9de");
      const drop=s.reduced?1:clamp((age-180)/1750),path=d.path.length?d.path:[2,2,2,2,2,2,2],q=drop*6,segment=Math.min(5,Math.floor(q)),fract=q-segment;
      const x=-96+lerp(path[segment],path[segment+1],smooth(fract))*48,y=lerp(-132,101,drop)-Math.sin(fract*Math.PI)*11;
      const factors=[1,3,8,3,1],lane=path[6];
      for(let col=0;col<5;col++){
        rect(-118+col*48,88,44,26,d.path.length&&drop===1&&lane===col?"#be8c58":col===2?"#a27b48":"#75577f",d.path.length&&drop===1&&lane===col?cream:col===2?gold:"#d7b3d6");
        text("$"+s.round.prices.cash*factors[col],-96+col*48,101,17,cream,38);
      }
      if(!e){if(d.path.length)sprite("marble",-96+lane*48,71,28);else sprite("marble",0,-132,30);}
      else sprite("marble",x,Math.min(y,71),28,0,Math.sin(drop*Math.PI)*Math.PI);
      break;
    }
    case "encore": {
      const press=phase(150,650),celebrate=phase(700,1300),song=e&&d.songs>before.songs;
      for(let i=0;i<3;i++){
        const x=-93+i*93,glow=song?1-celebrate:i<(press<0.8?before.note:d.note)?1:0;
        rect(x-35,-61,70,88,"#654676","#a78abc");text(["C","E","G"][i],x,-16,42,cream);
        ctx.save();ctx.globalAlpha*=glow;rect(x-35,-61,70,88,"#ae7fa9",gold);text(["C","E","G"][i],x,-16,42,gold);ctx.restore();
      }
      for(let i=0;i<7;i++){
        const active=e&&[0,2,4][e.fx.item.note]===i,depth=active?arc(press,7):0;
        rect(-105+i*30,65+depth,28,52-depth,active&&press<1?"#f8d2db":"#ead8e4","#5e416a");if(i<6)rect(-85+i*30,65,11,31,"#563d67");
      }
      if(e&&p<1)sprite("note",-93+e.fx.item.note*93,-70-p*65,55,e.hit?0:1,Math.sin(p*Math.PI)*0.2,1-p);
      const songs=celebrate<1?before.songs:d.songs;
      text(songs+(songs===1?" ENCORE":" ENCORES"),0,152,16,gold);
      break;
    }
    case "bowling": {
      ctx.fillStyle="#b78e81";ctx.beginPath();ctx.moveTo(-81,-113);ctx.lineTo(81,-113);ctx.lineTo(155,167);ctx.lineTo(-155,167);ctx.closePath();ctx.fill();
      for(let i=-2;i<=2;i++)line([[i*30,-113],[i*47,168]],"#e7c5a555",2);
      const roll=phase(150,1100),fall=phase(1000,1600),rack=phase(1650,2050),positions=[[0,-31],[-24,-58],[24,-58],[-48,-85],[0,-85],[48,-85],[-72,-112],[-24,-112],[24,-112],[72,-112]];
      for(let i=9;i>=0;i--){
        const fallen=e?.fallen?.includes(i),standing=e?before.pins[i]:d.pins[i],[x,y]=positions[i];
        if(standing&&(!fallen||fall<1))sprite("pin",x+(fallen?fall*26*(i%2?1:-1):0),y+(fallen?fall*22:0),42,0,fallen?fall*1.3:0,fallen?1-fall:1);
        if(e?.strike&&d.pins[i]&&rack>0)sprite("pin",x,y-35*(1-rack),42,0,0,rack);
      }
      if(!e&&s.round.phase!=="complete")sprite("marble",0,138,48,1);
      else if(roll<1||fall<1){const aim=e.fx.item.aim,curve=aim===0?-65:aim===1?65:aim===5?130:0;sprite("marble",Math.sin(roll*Math.PI/2)*curve,lerp(147,aim===5?-130:-28,roll),48-12*roll,1,roll*TAU,1-fall);}
      if(e&&s.round.phase!=="complete"&&rack>0)sprite("marble",0,138+25*(1-rack),48,1,0,rack);
      rect(-103,137,206,29,"#4d344e");
      text("RACKS CLEARED: "+(rack<1?before.racks:d.racks),0,152,15,gold);
      break;
    }
    case "tower": {
      const start = Math.max(0,d.floors.length-10),floors=d.floors.slice(start),base=112,slide=phase(150,1000),fall=phase(1050,1750);
      const camera=lerp(Math.max(0,before.floors.length-9),Math.max(0,d.floors.length-9),phase(80,800));
      rect(-128, base + 18, 256, 12, "#ad8d90");
      floors.forEach((floor, i) => {
        const y = base - (i+start-camera) * 27, isLast = i === floors.length - 1, x = -80 + floor.x * 20 + (isLast && e ? (1 - slide) * 180 * (floor.dir || 1) : 0);
        ctx.save();ctx.globalAlpha*=1-smooth((y-base)/22);
        for (let k = 0; k < floor.width; k++) {
          rect(x + k * 20, y, 19, 24, [pink, lilac, mint][(i + start) % 3]);
          rect(x + k * 20 + 2, y + 2, 15, 3, "#fff0da99");
        }
        if (isLast && floor.cut && e && fall < 1) {
          const cutX = floor.dir < 0 ? x - floor.cut * 20 : x + floor.width * 20;
          for (let k = 0; k < floor.cut; k++) rect(cutX + k * 20, y + fall * fall * 230, 18, 23, "#a4829d");
        }
        ctx.restore();
      });
      text(d.width + " WIDE / " + d.waste + " OFFCUTS", 0, -145, 16, gold);
      break;
    }
    case "boss": {
      const impact=phase(160,700),hit=e&&!e.fx.item.heal,shake=hit&&!s.reduced?Math.sin(age/70)*Math.sin(impact*Math.PI)*5:0,dead=d.hp===0;
      const hp=lerp(before.hp,d.hp,phase(220,950));
      rect(-116,-133,232,22,"#25152f","#c9a0bd");rect(-113,-130,226*hp/d.max,16,dead?gold:pink);
      sprite("pig",shake,9+(dead?phase(600,1000)*15:0),185,0,dead?phase(600,1000)*0.22:0,dead?1-phase(600,1000)*0.35:1);
      text(Math.ceil(hp)+" / "+d.max+" HP",0,-95,20);
      if(e?.fx.item.heal){const heal=phase(100,950);sprite("charm",-89,-5-heal*65,43,0,0,1-heal);if(age<1250){ctx.save();ctx.globalAlpha*=1-phase(950,1250);text(e.healed?"+"+e.healed+" HP":"FULL HEALTH",0,124,26,mint);ctx.restore();}ctx.save();ctx.globalAlpha*=phase(950,1250);text("BOSS BILL",0,128,23,gold);ctx.restore();}else text(dead&&hp<0.5?"BOUNTY BILLED":"BOSS BILL",0,128,23,gold);
      break;
    }
  }
  ctx.restore();
  ctx.restore();
}
export {
  drawScene
};
