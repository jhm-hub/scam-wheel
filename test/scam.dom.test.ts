import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {mountWidget,type MountHandle} from '../src/app.js';
import {defaultScamConfig} from '../src/scam/config.js';
import {createController} from '../src/app/controller.js';
const handles:MountHandle[]=[];
it('ignores other wheel commands and accepts the scam namespace with the existing permissions', async () => {
 const c=createController(document,document.body,{fieldData:{gameMode:'scam',disableSound:true,enableCommands:true,spinCommand:'!spin',wheelCommand:'!wheel'},channel:{id:'1',username:'faith'}});
 if('error'in c) throw Error('controller');
 const snapshots: any[]=[];
 document.querySelector('.scam-widget')!.addEventListener('scamchange',(e)=>snapshots.push((e as CustomEvent).detail));
 const broadcaster={nick:'faith',tags:{badges:'broadcaster/1'}};
 for(const command of ['!spin','!wheel spin','!wheel new Alice','!scammer spin','!scammy','!scam spin']) c.handleChatMessage(command,command==='!scam spin'?{nick:'viewer'}:broadcaster,'faith');
 expect(snapshots).toHaveLength(0);
 c.handleChatMessage('!SCAM NEW Alice',broadcaster,'faith');
 expect(snapshots.at(-1).player).toBe('Alice');
 c.handleChatMessage('!scam pause',broadcaster,'faith');
 c.handleChatMessage('!scam',broadcaster,'faith');
 expect(snapshots.at(-1).busy).toBe(false);
 c.handleChatMessage('!SCAM RESUME',broadcaster,'faith');
 c.handleChatMessage('!scam',broadcaster,'faith');
 expect(snapshots.at(-1).busy).toBe(true);
 c.dispose();
});
it('respects disabled chat commands for the scam shortcut', () => {
 const c=createController(document,document.body,{fieldData:{gameMode:'scam',disableSound:true,enableCommands:false}});
 if('error'in c) throw Error('controller');
 const changed=vi.fn();document.querySelector('.scam-widget')!.addEventListener('scamchange',changed);
 c.handleChatMessage('!scam',{nick:'faith',tags:{badges:'broadcaster/1'}},'faith');
 expect(changed).not.toHaveBeenCalled();c.dispose();
});
beforeEach(()=>vi.useFakeTimers());afterEach(()=>{handles.forEach(h=>h.dispose());handles.length=0;document.body.replaceChildren();vi.useRealTimers();});
function mount(){const c=defaultScamConfig();c.modes.forEach(m=>m.enabled=m.id===1);const h=mountWidget(document,{fieldData:{gameMode:'scam',disableSound:true,scamConfig:JSON.stringify(c)}},{rng:()=>.125});if('error'in h)throw new Error('mount failed');handles.push(h);return h;}
it('two bonus-bearing regular turns still reveal the scam on press three',async()=>{const h=mount();h.spin();h.spin();await vi.advanceTimersByTimeAsync(6500);expect(h.scam!.snapshot()).toMatchObject({regularCompleted:1,remaining:4,completed:1});h.spin();await vi.advanceTimersByTimeAsync(6500);expect(h.scam!.snapshot()).toMatchObject({regularCompleted:2,remaining:5});expect(h.scam!.snapshot().mode).toBeUndefined();h.spin();await vi.advanceTimersByTimeAsync(5000);expect(h.scam!.snapshot()).toMatchObject({mode:1,regularCompleted:2,remaining:5,completed:2,phase:'ready'});});
it('reset cancels pending reveal awards and spin callbacks',async()=>{const h=mount();h.scam!.showcase(9);await vi.advanceTimersByTimeAsync(2100);h.scam!.newRound('Faith');await vi.advanceTimersByTimeAsync(12000);expect(h.scam!.snapshot()).toMatchObject({player:'Faith',cash:0,remaining:3,completed:0});expect(h.scam!.snapshot().mode).toBeUndefined();h.spin();await vi.advanceTimersByTimeAsync(1000);h.scam!.newRound();await vi.advanceTimersByTimeAsync(9000);expect(h.scam!.snapshot()).toMatchObject({cash:0,remaining:3,completed:0});});
it('mystery picks are distinct and a reveal cannot pay twice',async()=>{const h=mount();h.scam!.showcase(24);await vi.advanceTimersByTimeAsync(5000);for(let i=0;i<6;i++)h.scam!.pick(i);h.scam!.pick(6);expect(h.scam!.snapshot().picks).toEqual([0,1,2,3,4,5]);h.scam!.revealPicks();h.scam!.revealPicks();await vi.advanceTimersByTimeAsync(5000);const cash=h.scam!.snapshot().cash;h.scam!.revealPicks();await vi.advanceTimersByTimeAsync(5000);expect(h.scam!.snapshot()).toMatchObject({cash,remaining:1,mysteryDone:true});});
it('StreamElements commands preserve broadcaster permission and ordinary entry resets do not reset a scam',async()=>{const c=createController(document,document.body,{fieldData:{gameMode:'scam',disableSound:true,enableCommands:true},channel:{id:'1',username:'faith'}});if('error'in c)throw new Error('controller');const get=()=>document.querySelector<HTMLElement>('.scam-widget')!;c.handleChatMessage('!scam demo 0',{nick:'viewer'},'faith');expect(get().dataset.mode).toBe('base');c.handleChatMessage('!scam demo 0',{nick:'faith',tags:{badges:'broadcaster/1'}},'faith');await vi.advanceTimersByTimeAsync(5000);expect(get().dataset.mode).toBe('0');c.handleChatMessage('!scam reset',{nick:'faith',tags:{badges:'broadcaster/1'}},'faith');expect(get().dataset.mode).toBe('0');c.handleChatMessage('!scam new Alice',{nick:'faith',tags:{badges:'broadcaster/1'}},'faith');expect(get().dataset.mode).toBe('base');c.dispose();expect(document.querySelector('.scam-widget')).toBeNull();});

it('The arcade alert appears once at scam activation and clears on reset without spending a spin',async()=>{
 const h=mount();h.spin();await vi.advanceTimersByTimeAsync(6500);h.spin();await vi.advanceTimersByTimeAsync(6500);
 expect(document.querySelector('.scam-activation')).toBeNull();
 const before=h.scam!.snapshot();h.spin();h.spin();
 expect(document.querySelectorAll('.scam-activation')).toHaveLength(1);
 expect(document.querySelector('.activation-title')?.textContent).toBe('SCAMACTIVATED');
 expect(document.querySelector('.scam-activation')?.getAttribute('aria-label')).toContain('Scam activated:');
 expect(document.querySelector('.scam-activation img')).toBeNull();
 expect(h.scam!.snapshot()).toMatchObject({remaining:before.remaining,cash:before.cash,completed:2,busy:true});
 await vi.advanceTimersByTimeAsync(1500);h.scam!.newRound();
 expect(document.querySelector('.scam-activation')).toBeNull();
 await vi.advanceTimersByTimeAsync(15000);
 expect(h.scam!.snapshot()).toMatchObject({phase:'ready',remaining:3,cash:0,completed:0,busy:false});
 expect(document.querySelector('.scam-activation')).toBeNull();
});
it('Combo Queen keeps its gains and shows the next multiplier across repeat landings',async()=>{
 const h=mount();h.scam!.showcase(27);await vi.advanceTimersByTimeAsync(5000);
 expect(document.querySelector('.combo-caption')?.textContent).toBe('NEXT SPIN x1');
 const base=h.scam!.snapshot().cash,amount=h.scam!.snapshot().board[1]!.prize.cash;
 for(let i=1;i<=3;i++){h.spin();await vi.advanceTimersByTimeAsync(6500);expect(h.scam!.snapshot().combo).toBe(i);expect(document.querySelectorAll('.scam-reward')).toHaveLength(1);expect(document.querySelector('.scam-activation')).toBeNull();}
 expect(h.scam!.snapshot().cash).toBe(base+amount*6);
 expect(document.querySelector('.combo-caption')?.textContent).toBe('MAX COMBO');
});
