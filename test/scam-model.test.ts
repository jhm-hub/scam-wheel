import {describe,it,expect} from 'vitest';
import {defaultScamConfig,parseScamConfig} from '../src/scam/config.js';
import {MODES} from '../src/scam/catalog.js';
import {beginMode,consumeSpin,endRound,finishReveal,newRound,planSpin,revealPicks,settle,slices,type RoundState,type SpinPlan} from '../src/scam/model.js';
import {layout,sliceCenterDeg} from '../src/model/geometry.js';
import {deg} from '../src/model/units.js';
const config=()=>defaultScamConfig();
function seed(start=420){let n=start;return()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};}
function mode(id:number){const s=newRound(config());beginMode(s,id,config(),seed());finishReveal(s);return s;}
function at(s:RoundState,i:number,extras:number[]=[]):SpinPlan{return {pointers:[{index:i,angle:sliceCenterDeg(layout(slices(s.board))[i]!),boundary:'none'}],extras,rebound:false};}
function hit(s:RoundState,p:SpinPlan){consumeSpin(s,p.rebound);return settle(s,p);}
describe('Scam configuration and catalog',()=>{
 it('keeps all 25 legacy modes and excludes new ideas from normal rounds',()=>{expect(MODES.filter(m=>!m.experimental).map(m=>m.id)).toEqual([0,1,2,3,4,5,6,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25]);expect(config().modes.filter(m=>m.enabled)).toHaveLength(25);expect(MODES.every(m=>m.name!==m.original)).toBe(true);});
 it('repairs partial or malformed settings without breaking rendering',()=>{expect(parseScamConfig('{bad')).toEqual(config());expect(parseScamConfig({startingSpins:1,cash:[1]})).toMatchObject({startingSpins:3,cash:config().cash});expect(parseScamConfig({modes:[{id:0,name:'My Tree',enabled:false,weight:2}]}).modes[0]).toEqual({id:0,name:'My Tree',enabled:false,weight:2});});
 it('treats a zero-dollar cash space as cash when values change',()=>{const c=config();c.cash[0]=0;const s=newRound(c);beginMode(s,1,c,seed());expect(s.board[0]!.prize.cash).toBe(15);expect(s.board[1]!.prize.cash).toBe(0);});
});
describe('Shared round accounting',()=>{
 it('adds multiplier factors and applies the bank once at the finale',()=>{const s=newRound(config());s.cash=25;s.bank=2;hit(s,at(s,7));expect(s.bank).toBe(4);expect(endRound(s)).toEqual({base:100,factor:1,total:100});});
 it.each([[10,30],[30,90],[31,62],[50,100],[51,51]])('preserves the final gag at %s', (cash,total)=>{const s=newRound(config());s.cash=cash;expect(endRound(s).total).toBe(total);});
 it('counts an ordinary boundary as one completed turn',()=>{const s=newRound(config());const p=at(s,0);p.pointers[0]!.neighbor=1;p.pointers[0]!.boundary='auto';hit(s,p);expect(s).toMatchObject({regularCompleted:1,completed:1,cash:6,remaining:4});});
});
describe('Original mode outcomes',()=>{
 it('grows five distinct trees, allows repeats, then exits on an unconverted wedge',()=>{const s=mode(0);for(let i=0;i<5;i++){hit(s,at(s,i));expect(s.remaining).toBe(1);}hit(s,at(s,0));expect(s.trees).toHaveLength(5);expect(s.cash).toBe(66);hit(s,at(s,6));expect(s).toMatchObject({cash:67,remaining:0});});
 it('boost and flat-value modes preserve bonus properties',()=>{expect(mode(1).board[4]!.prize).toEqual({cash:21,spins:1,mult:0});expect(mode(3).board[4]!.prize).toEqual({cash:25,spins:1,mult:0});});
 it('opposite pointers use the larger spin award and cap both specials',()=>{const s=mode(2),p=at(s,1);p.pointers.push(at(s,7).pointers[0]!);expect(hit(s,p)).toMatchObject({spins:2,mult:2});hit(s,p);for(let i=0;i<40;i++){const next=planSpin(s,seed(i));expect(next.pointers.every(x=>x.index!==1&&x.index!==7&&x.neighbor!==1&&x.neighbor!==7)).toBe(true);}});
 it.each([[4,7,.35],[5,1,.3],[10,4,.4],[10,10,.4]])('mode %s grows wedge %s to the actual probability', (id,index,prob)=>{const b=mode(id).board;expect(b[index]!.weight/b.reduce((n,v)=>n+v.weight,0)).toBeCloseTo(prob);});
 it('bonus expansion uses stable slot identities after cash edits',()=>{const c=config();c.cash=c.cash.map(()=>100);const s=newRound(c);beginMode(s,6,c,seed());expect([3,5,6,9].map(i=>s.board[i]!.prize.spins)).toEqual([1,1,1,1]);});
 it('high roller has two jackpots sharing 40 percent and no specials',()=>{const b=mode(8).board;expect(b.filter(s=>s.prize.cash===100).reduce((n,s)=>n+s.weight,0)/b.reduce((n,s)=>n+s.weight,0)).toBeCloseTo(.4);expect(b.every(s=>s.prize.mult===0&&s.prize.spins===0)).toBe(true);});
 it('spin bonus adds two to the existing balance',()=>{const s=newRound(config());s.remaining=7;beginMode(s,9,config(),seed());expect(s.remaining).toBe(7);finishReveal(s);expect(s.remaining).toBe(9);});
 it('multiplier board sets one spin and honors custom factors',()=>{const c=config();c.multipliers[0]=9;const s=newRound(c);beginMode(s,11,c,seed());expect(s.remaining).toBe(1);expect(hit(s,at(s,0)).mult).toBe(9);});
 it('magnet guarantees the tiny multiplier',()=>{const s=mode(12);expect(planSpin(s,()=>.001).pointers[0]!.index).toBe(7);expect(s.board[7]!.weight).toBe(15);});
 it('neighbors return spins only on the first middle collection and multiplier windows cap twice',()=>{const s=mode(13);expect(hit(s,at(s,6,[5,7])).spins).toBe(1);expect(hit(s,at(s,6,[5,7])).spins).toBe(0);const next=planSpin(s,()=>.52);expect([...next.extras,next.pointers[0]!.index]).not.toContain(7);});
 it('angel outcomes never include fake jackpot amounts',()=>{expect(mode(14).board.map(x=>x.prize.cash)).toEqual([22,33,44,55,66,77]);});
 it('split wheels sum both bonus awards but multipliers have no accompanying spin',()=>{const s=mode(15),p=at(s,1);p.secondary=at(s,4).pointers[0]!;expect(hit(s,p).spins).toBe(3);expect(s.board[7]!.prize.spins).toBe(0);});
 it('outage only lands on its four survivors',()=>{const s=mode(16);const r=seed(),counts=new Map<number,number>();for(let i=0;i<2000;i++){const n=planSpin(s,r).pointers[0]!.index;counts.set(n,(counts.get(n)??0)+1);}expect([...counts.keys()].sort((a,b)=>a-b)).toEqual([0,3,6,9]);for(const n of counts.values())expect(n/2000).toBeGreaterThan(.2);});
 it('hands collect distinct prizes and use at most one special over the whole round',()=>{const s=mode(17),r=seed();let special=0;for(let i=0;i<60;i++){const p=planSpin(s,r);expect(new Set([p.pointers[0]!.index,...p.extras]).size).toBe(3);special+=p.extras.filter(n=>s.board[n]!.prize.spins||s.board[n]!.prize.mult).length;hit(s,p);}expect(special).toBe(1);});
 it('rainbow values are the letter sums and wait for acknowledgement',()=>{const s=mode(18);expect(s.board.map(s=>s.prize.cash)).toEqual([27,60,92,49,40,58,83]);hit(s,at(s,2));expect(s.phase).toBe('rainbow');});
 it('double trouble doubles cash and allows the four-spin wedge once',()=>{const s=mode(19);expect(s.board[0]!.prize.cash).toBe(12);expect(s.board[7]!.prize).toEqual({cash:0,spins:1,mult:4});hit(s,at(s,1));const r=seed();for(let i=0;i<100;i++){const p=planSpin(s,r);expect(p.pointers[0]!.index).not.toBe(1);expect(p.pointers[0]!.neighbor).not.toBe(1);}});
 it('heist has six laser prizes without replacing the other specials',()=>{const s=mode(20);expect(s.board.filter(x=>x.tag==='laser')).toHaveLength(6);expect(s.board[7]!.prize.mult).toBe(2);expect(s.board[1]!.prize.spins).toBe(2);});
 it('lucky-ish awards 77 once and cannot hit the decorative jackpot',()=>{const s=mode(21);for(let i=0;i<30;i++)expect(planSpin(s,seed(i)).pointers[0]!.index).toBe(0);expect(hit(s,planSpin(s,()=>.999))).toMatchObject({cash:77,spins:0});expect(s.remaining).toBe(0);expect(s.cash).toBe(77);});
 it('dash replaces spin prizes while keeping the multiplier',()=>{const s=mode(22);expect([1,4,10].map(i=>s.board[i]!.prize.cash)).toEqual([10,9,8]);expect(s.board.every(x=>x.prize.spins===0)).toBe(true);expect(s.board[7]!.prize.mult).toBe(2);});
 it('shields pay cash on every rebound while consuming one press and one budget unit',()=>{const s=mode(23);s.remaining=3;let p=at(s,0);expect(hit(s,p).bounce).toBe(true);for(let n=0;n<2;n++){p={...at(s,0),rebound:true};expect(hit(s,p).bounce).toBe(true);}p={...at(s,0),rebound:true};expect(hit(s,p).bounce).toBe(false);expect(s).toMatchObject({cash:24,shields:0,remaining:2,completed:1,scamSpins:1});});
 it('mystery picks shuffle actual prizes and ignore spin properties in the pick awards',()=>{const s=mode(24);expect(s.board.map(b=>b.prize.cash).sort((a,b)=>a-b)).toEqual([0,5,6,7,8,9,10,11,12,13,14,15]);expect(s.board[1]!.prize.cash).not.toBe(15);const mult=s.board.findIndex(b=>b.prize.mult);s.picks=[mult,...s.board.map((_,i)=>i).filter(i=>i!==mult).slice(0,5)];const before=JSON.stringify(s.board);const a=revealPicks(s)!;expect(a.spins).toBe(0);expect(a.mult).toBe(2);expect(s.remaining).toBe(1);expect(JSON.stringify(s.board)).toBe(before);expect(revealPicks(s)).toBeUndefined();});
 it('keys count repeated key wedges and exit after three',()=>{const s=mode(25);for(let i=0;i<3;i++)hit(s,at(s,0));expect(s).toMatchObject({keys:3,cash:15,remaining:0});expect(s.board.filter(x=>x.prize.key)).toHaveLength(6);});
});
describe('New idea demos',()=>{
 it('pinball selects three different cash bumpers',()=>{const s=mode(26);const p=planSpin(s,seed());expect(new Set([p.pointers[0]!.index,...p.extras]).size).toBe(3);expect(hit(s,p).cash).toBeGreaterThan(0);expect(s.remaining).toBe(0);});
 it('combo pays x1, x2, x3 even when colors repeat',()=>{const s=mode(27);expect(hit(s,at(s,0)).cash).toBe(6);expect(hit(s,at(s,1)).cash).toBe(22);expect(hit(s,at(s,4)).cash).toBe(30);expect(s.combo).toBe(3);});
 it('combo cannot drop when the same space is hit repeatedly, including added spins',()=>{const s=mode(27);expect([1,2,3,4].map(()=>hit(s,at(s,0)).cash)).toEqual([6,12,18,18]);expect(s.combo).toBe(3);});
 it('encore adds fifty percent only after the opening spin',()=>{const s=mode(28);expect(hit(s,at(s,0)).cash).toBe(6);expect(s.phase).toBe('choice');s.remaining=1;expect(hit(s,at(s,0)).cash).toBe(9);});
});
