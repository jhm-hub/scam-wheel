import type { WheelConfig } from '../config/parse.js';
import type { BuildOpts, BuiltWidget } from '../app/builder.js';
import { buildWheel, type WheelDom } from '../render/wheel.js';
import { addChrome } from '../render/chrome.js';
import { createAnimator, type Animator } from '../spin/animator.js';
import { deg, sliceIndex } from '../model/units.js';
import { layout, sliceCenterDeg } from '../model/geometry.js';
import { MODES, modeById } from './catalog.js';
import { defaultScamConfig, type ScamConfig } from './config.js';
import { baseBoard, beginMode, chooseMode, consumeSpin, endRound, finishReveal, label, newRound, planSpin, revealPicks, settle, slices, type Award, type RoundState, type Space, type SpinPlan } from './model.js';
import { arcadeAudio } from './audio.js';
import { decorate, icon } from './visuals.js';
import { activation, collect, flourish, impact, rainbowLetters, reward, type Point } from './presentation.js';
export interface ScamSnapshot extends RoundState {
    busy: boolean;
    name: string;
    seconds: number;
    queuedSeconds: number;
    muted: boolean;
    message: string;
}
export interface ScamApi {
    snapshot(): ScamSnapshot;
    newRound(player?: string): void;
    showcase(id: number): void;
    bonus(amount: number): void;
    finish(): void;
    confirmBoundary(both: boolean): void;
    continue(): void;
    pick(index: number): void;
    revealPicks(): void;
    mute(muted: boolean): void;
    encore(take: boolean): void;
    pause(paused: boolean): void;
}
interface BoardView {
    dom: WheelDom;
    animator: Animator;
    dispose(): void;
    refit(): void;
}
const CANCEL = Symbol('cancel');
export function buildScamWidget(doc: Document, cfg: WheelConfig, opts: BuildOpts = {}): BuiltWidget {
    const c: ScamConfig = cfg.scam ?? defaultScamConfig(), rng = opts.rng ?? Math.random;
    let state = newRound(c), busy = false, disposed = false, paused = false, muted = cfg.disableSound, message = 'Two spins. Then the scam.', rotation = 0;
    let deadline: number | undefined, queuedSeconds = 0, dashStarted = false, pauseStarted: number | undefined;
    let board: BoardView | undefined, twin: BoardView | undefined, pendingPlan: SpinPlan | undefined;
    const timers = new Map<ReturnType<typeof setTimeout>, () => void>();
    const sound = arcadeAudio(muted, cfg.winVolume, opts.audioCtxFactory);
    const root = doc.createElement('div');
    root.className = 'scam-widget';
    root.setAttribute('aria-label', 'Scam Wheel');
    const stage = doc.createElement('div');
    stage.className = 'scam-stage';
    root.append(stage);
    function el(cls: string, text = '', parent: HTMLElement = stage) { const e = doc.createElement('div'); e.className = cls; e.textContent = text; parent.append(e); return e; }
    const marquee = el('scam-marquee');
    const kicker = el('scam-kicker', 'PLAYER ONE', marquee);
    const name = el('scam-name', 'READY TO PLAY', marquee);
    const subtitle = el('scam-subtitle', 'Two normal spins, then a surprise.', marquee);
    const decor = el('scam-decor'), boards = el('scam-boards'), front = el('scam-front'), effects = el('scam-effects'), messageEl = el('scam-message'), score = el('scam-score');
    const cashEl = el('scam-stat', '', score), bankEl = el('scam-stat', '', score), spinsEl = el('scam-stat', '', score);
    score.hidden = true;
    score.setAttribute('aria-hidden', 'true');
    const modal = el('scam-modal');
    modal.hidden = true;
    const live = el('scam-sr');
    live.setAttribute('aria-live', 'polite');
    function sleep(ms: number): Promise<void> { return new Promise((resolve, reject) => { const id = setTimeout(() => { timers.delete(id); resolve(); }, ms); timers.set(id, () => reject(CANCEL)); }); }
    function timeline(fn: () => Promise<void>) { void fn().catch(error => { if (error !== CANCEL) {
        console.error(error);
        busy = false;
        message = 'Action interrupted. Start a new round to retry.';
        update();
    } }); }
    function cancel() { stage.querySelector('.scam-activation')?.remove(); for (const [id, reject] of timers) {
        clearTimeout(id);
        reject();
    } timers.clear(); board?.dispose(); twin?.dispose(); board = undefined; twin = undefined; pendingPlan = undefined; root.getAnimations?.({ subtree: true }).forEach(a => a.cancel()); sound.stop(); effects.replaceChildren(); front.replaceChildren(); modal.hidden = true; modal.replaceChildren(); busy = false; deadline = undefined; queuedSeconds = 0; dashStarted = false; pauseStarted = undefined; paused = false; stage.className = 'scam-stage'; }
    function modeName() { return state.mode === undefined ? 'READY TO PLAY' : c.modes.find(m => m.id === state.mode)?.name ?? modeById(state.mode).name; }
    function snapshot(): ScamSnapshot { return { ...structuredClone(state), busy, name: modeName(), seconds: deadline === undefined ? 15 : Math.max(0, Math.ceil((deadline - (paused ? pauseStarted ?? performance.now() : performance.now())) / 1000)), queuedSeconds, muted, message }; }
    function update() { if (disposed)
        return; root.dataset.phase = state.phase; root.dataset.mode = state.mode === undefined ? 'base' : String(state.mode); root.dataset.busy = String(busy); stage.classList.toggle('is-paused', paused); name.textContent = modeName(); kicker.textContent = state.player || 'PLAYER ONE'; subtitle.textContent = state.mode === undefined ? (state.regularCompleted < 2 ? 'REGULAR SPIN ' + (state.regularCompleted + 1) + ' / 2' : 'NEXT UP: THE SCAM') : modeById(state.mode).hook; messageEl.textContent = message; for (const [node, title, value] of [[cashEl, 'CASH', '$' + state.cash], [bankEl, 'MULTIPLIER', 'x' + (state.bank || 1)], [spinsEl, state.mode === 22 ? 'SECONDS' : 'SPINS', state.mode === 22 ? String(snapshot().seconds) : String(state.remaining)]] as const) {
        if (node.dataset.value !== value || node.dataset.label !== title) {
            const changed = node.dataset.value !== undefined && node.dataset.value !== value;
            node.dataset.value = value;
            node.dataset.label = title;
            node.replaceChildren();
            el('stat-label', title, node);
            const numeral = el('stat-value', value, node);
            if (changed) numeral.classList.add('score-roll');
        }
    } live.textContent = message; root.dispatchEvent(new CustomEvent('scamchange', { detail: snapshot(), bubbles: true })); }
    function theme() { const colors = state.mode === undefined ? [cfg.scheme.vars['--slice-bg-even'] ?? '#db9bbb', cfg.scheme.vars['--slice-bg-odd'] ?? '#bca9df', '#fff2cb'] : modeById(state.mode).colors; stage.style.setProperty('--mode-a', colors[0]!); stage.style.setProperty('--mode-b', colors[1]!); stage.style.setProperty('--mode-c', colors[2]!); stage.dataset.motif = state.mode === undefined ? 'base' : modeById(state.mode).motif; decorate(doc, decor, stage.dataset.motif); }
    function boardConfig(spaces: Space[], seconds = c.spinSeconds): WheelConfig {
        const colors = state.mode === undefined ? [cfg.scheme.vars['--slice-bg-even'] ?? '#db9bbb', cfg.scheme.vars['--slice-bg-odd'] ?? '#bca9df', '#fff2cb'] : modeById(state.mode).colors;
        const resolved = slices(spaces).map((s, i) => ({ ...s, text: state.mode === 21 ? (i === 0 ? '$7' : '$777') : s.text, color: spaces[i]!.inactive ? '#323149' : s.color ?? (spaces[i]!.tag === 'laser' ? '#50b69e' : colors[i % 2])! }));
        return { ...cfg, slices: resolved, style: 'fullwheel', scale: 1, title: '', fontFamily: 'Scam Arcade', labelSizeMax: 40, labelSizeMin: 4, hubMode: 'text', hubText: 'SCAM\nWHEEL', hubTextStyle: 'fit', hubSize: 30, spinDurationSec: seconds, spinForceVariance: .22, magnetism: false, scheme: { kind: 'custom', vars: { ...cfg.scheme.vars, '--slice-bg-even': colors[0]!, '--slice-bg-odd': colors[1]!, '--rim-color': colors[0]!, '--centerpiece-bg': colors[0]!, '--hub-inner': colors[1]!, '--entry-color': '#fff9ec', '--slice-border': '#fff3e4', '--gem-light': '#fff5d4', '--gem-mid': colors[1]!, '--gem-dark': colors[0]!, '--gem-edge': '#a783ba' } } };
    }
    function setPrizeLabel(entry: HTMLElement, text: string) {
        const target = entry.querySelector<HTMLElement>('.entry-text')!;
        target.replaceChildren();
        text.split('\n').forEach((line, i) => {
            if (i) target.append(doc.createTextNode('\n'));
            el(i ? 'prize-label-bonus' : 'prize-label-main', line, target);
        });
    }
    function makeBoard(spaces: Space[], side: 'main' | 'twin', seconds = c.spinSeconds): BoardView {
        const wc = boardConfig(spaces, seconds), dom = buildWheel(doc, wc);
        dom.container.classList.add('scam-board', side);
        dom.entries.forEach((entry, i) => setPrizeLabel(entry, wc.slices[i]!.text));
        dom.container.style.setProperty('--wheel-font', 'Scam Arcade');
        for (const [k, v] of Object.entries(wc.scheme.vars))
            dom.container.style.setProperty(k, v);
        const chrome = addChrome(doc, dom, wc);
        const bulbs = el('arcade-bulbs', '', dom.container);
        for (let i = 0; i < 40; i++) {
            const b = doc.createElement('i');
            b.style.setProperty('--i', String(i));
            bulbs.append(b);
        }
        const animator = createAnimator(dom, wc, { onResult: () => { }, onTick: () => { if (!cfg.disableTickSound)
                sound.tick(); } }, rng, rotation);
        spaces.forEach((s, i) => { dom.slices[i]!.classList.add(s.tag === 'laser' ? 'laser-space' : s.inactive ? 'dead-space' : 'live-space'); if (s.tag === 'tree')
            dom.slices[i]!.classList.add('tree-space'); });
        boards.append(dom.container);
        chrome.refit();
        return { dom, animator, dispose: () => { animator.dispose(); chrome.dispose(); dom.container.remove(); }, refit: chrome.refit };
    }
    function renderBoard(morph = false, spaces = state.board) {
        const old = board;
        const oldRotation = old?.animator.currentRotationDeg();
        if (oldRotation !== undefined)
            rotation = oldRotation;
        board = makeBoard(spaces, 'main');
        board.dom.setRotation(rotation);
        if (morph && old) {
            board.dom.slices.forEach((path, i) => { const previous = old.dom.slices[i]; if (previous && old.dom.slices.length === board!.dom.slices.length && typeof path.animate === 'function') {
                path.animate([{ d: 'path("' + previous.getAttribute('d') + '")' }, { d: 'path("' + path.getAttribute('d') + '")' }], { duration: 1500, easing: 'cubic-bezier(.2,.8,.2,1)' });
            } });
            board.dom.container.classList.add('board-enter');
        }
        old?.dispose();
        twin?.dispose();
        twin = undefined;
        if (state.mode === 15) {
            twin = makeBoard(spaces, 'twin');
            if (morph) twin.dom.container.classList.add('board-enter');
            stage.classList.add('is-split');
        }
        else
            stage.classList.remove('is-split');
        front.replaceChildren();
        if (state.mode === 2) {
            const p = el('extra-pointer opposite', '', front);
            p.append(board.dom.container.querySelector('.headpiece svg')!.cloneNode(true));
        }
        if (state.mode === 13) {
            for (const side of [-1, 1]) {
                const p = el('side-pointer', '', front);
                p.style.setProperty('--side', String(side));
                p.append(board.dom.container.querySelector('.headpiece svg')!.cloneNode(true));
            }
        }
        if (state.mode === 27) {
            const meter = el('combo-meter', '', front);
            for (let i = 0; i < 3; i++) {
                const token = el('combo-step', 'x' + (i + 1), meter);
                token.classList.toggle('active', i < state.scamSpins);
                token.classList.toggle('next', i === state.scamSpins);
            }
            el('combo-caption', state.scamSpins >= 3 ? 'MAX COMBO' : 'NEXT SPIN x' + (state.scamSpins + 1), meter);
        }
        if (state.mode === 23) decor.querySelectorAll('.scam-shield-ring').forEach((ring, i) => ring.classList.toggle('depleted', i >= state.shields));
        if (state.mode === 23 || state.mode === 25) {
            const meter = el('scam-tokens', '', front);
            for (let i = 0; i < 3; i++) {
                const token = el('scam-token', '', meter);
                token.innerHTML = icon(state.mode === 25 ? (i < state.keys ? 'key' : 'lock') : 'shield');
                token.classList.toggle('spent', state.mode === 23 && i >= state.shields);
                token.classList.toggle('earned', state.mode === 25 && i < state.keys);
            }
        }
    }
    function burst(text: string, kind = 'win') { effects.querySelectorAll('.scam-burst,.scam-reward').forEach(e => e.remove()); const b = el('scam-burst ' + kind, text, effects); b.addEventListener('animationend', () => b.remove(), { once: true }); if (!cfg.disableConfetti) {
        for (let i = 0; i < 24; i++) {
            const particle = doc.createElement('i');
            particle.className = 'scam-confetti';
            particle.style.setProperty('--x', String((rng() - .5) * 660) + 'px');
            particle.style.setProperty('--y', String(-160 - rng() * 200) + 'px');
            particle.style.setProperty('--r', String(rng() * 700) + 'deg');
            particle.style.setProperty('--delay', String(rng() * .2) + 's');
            effects.append(particle);
            particle.addEventListener('animationend', () => particle.remove(), { once: true });
        }
    } }
    function card(eyebrow: string, title: string, body: string, buttons: {
        label: string;
        action: () => void;
    }[] = []) { effects.querySelectorAll('.scam-burst,.scam-reward').forEach(e => e.remove()); modal.replaceChildren(); modal.hidden = false; modal.classList.remove('rainbow-card', 'final-card', 'encore-card'); el('card-eyebrow', eyebrow, modal); el('card-title', title, modal); el('card-body', body, modal); const controls = el('card-actions', '', modal); for (const b of buttons) {
        const button = doc.createElement('button');
        button.textContent = b.label;
        button.onclick = b.action;
        controls.append(button);
    } }
    async function reveal(id: number) {
        busy = true;
        beginMode(state, id, c, rng);
        theme();
        update();
        stage.classList.add('is-revealing');
        const alert = activation(doc, stage, modeName());
        sound.activate();
        await sleep(2500);
        alert.classList.add('leaving');
        await sleep(300);
        alert.remove();
        stage.classList.remove('is-revealing');
        sound.reveal(id);
        flourish(doc, effects, id);
        if (id === 14) {
            const fake = [500, 750, 1000, 1500, 2000, 0].map((cash, i) => ({ cashSpace: i !== 5, prize: { cash, spins: i === 5 ? 5 : 0, mult: 0 }, weight: 1 }));
            renderBoard(true, fake);
            stage.classList.add('fake-death');
            message = 'MEGA DEATH WHEEL';
            update();
            await sleep(4200);
            burst('JEBAITED', 'joke');
            sound.zap();
            stage.classList.remove('fake-death');
            await sleep(1800);
            renderBoard(true);
            flourish(doc, effects, 14);
            burst('ANGEL NUMBERS');
            await sleep(1500);
        }
        else if (id === 16) {
            renderBoard(true);
            const dead = state.board.map((s, i) => s.inactive ? i : undefined).filter((i): i is number => i !== undefined);
            board!.dom.slices.forEach(p => p.classList.add('power-on'));
            for (const i of dead.sort(() => rng() - .5)) {
                await sleep(420);
                board!.dom.slices[i]!.classList.remove('power-on');
                board!.dom.entries[i]!.classList.add('burnt');
                sound.zap();
            }
            await sleep(700);
        }
        else if (id === 20) {
            message = 'SECURITY SYSTEM ARMED';
            update();
            await sleep(900);
            stage.classList.add('blackout');
            sound.zap();
            await sleep(2700);
            renderBoard(true);
            stage.classList.remove('blackout');
            flourish(doc, effects, 20);
            burst('ACCESS GRANTED');
            await sleep(1300);
        }
        else {
            renderBoard(true);
            burst(modeById(id).cue, 'intro');
            if (id === 1) {
                const originals = baseBoard(c);
                for (let frame = 0; frame <= 18; frame++) {
                    state.board.forEach((space, i) => { if (space.cashSpace) {
                        const from = originals[i]!.prize.cash;
                        setPrizeLabel(board!.dom.entries[i]!, '$' + Math.round(from + (space.prize.cash - from) * frame / 18) + (space.prize.spins ? '\n+1 SPIN' : ''));
                    } });
                    await sleep(75);
                }
            }
            else if (id === 3 || id === 6 || id === 19) {
                board!.dom.entries.forEach((entry, i) => { entry.style.setProperty('--label-i', String(i)); entry.classList.add('price-flip'); });
                await sleep(1700);
            }
            else if (id === 9) {
                const ticket = el('ticket-delivery', '', effects);
                ticket.innerHTML = icon('ticket') + '<b>+2</b>';
                await sleep(1800);
                ticket.remove();
            }
            else if (id === 11) {
                board!.dom.container.classList.add('multiplier-arrive');
                await sleep(1600);
            }
            else if (id === 24) {
                showPicks();
                board!.dom.wheel.classList.add('mystery-shuffle');
                await sleep(1600);
                board!.dom.wheel.classList.remove('mystery-shuffle');
            }
            else
                await sleep(id === 15 ? 2000 : 1500);
        }
        finishReveal(state);
        busy = false;
        message = modeById(id).rule;
        if (id === 0)
            message = 'SUMMON 5 TREES';
        if (id === 24) {
            message = 'Choose six secrets, then reveal.';
        }
        if (id === 9)
            sound.win();
        update();
        opts.onSettle?.();
    }
    function showPicks() { if (!board)
        return; board.dom.entries.forEach((entry, i) => { entry.querySelector('.entry-text')!.textContent = '?'; entry.classList.add('mystery-covered'); const cover = doc.createElement('button'); cover.className = 'pick-sector'; cover.textContent = String(i + 1); cover.setAttribute('aria-label', 'Secret ' + (i + 1)); cover.onclick = e => { e.stopPropagation(); api.pick(i); }; entry.append(cover); }); }
    async function animatePlan(plan: SpinPlan) { const jobs: Promise<void>[] = []; function spin(view: BoardView, p: {
        index: number;
        angle: number;
    }, delay = 0) { jobs.push((async () => { if (delay)
        await sleep(delay); view.animator.spin({ kind: 'winner', slice: sliceIndex(p.index), restAngle: deg(p.angle) }); await sleep((state.mode === 22 ? 3 : plan.rebound ? 3.8 : c.spinSeconds) * 1000 + 80); })()); } spin(board!, plan.pointers[0]!); if (twin && plan.secondary)
        spin(twin, plan.secondary, 160); await Promise.all(jobs); rotation = board!.animator.currentRotationDeg(); }
    function highlights(plan: SpinPlan, both: boolean) { const ids = plan.pointers.flatMap(p => p.neighbor !== undefined && (both || p.boundary === 'auto') ? [p.index, p.neighbor] : [p.index]); [...ids, ...(state.mode === 17 || state.mode === 26 ? [] : plan.extras)].forEach(i => board?.dom.slices[i]?.classList.add('is-winner')); if (plan.secondary)
        twin?.dom.slices[plan.secondary.index]?.classList.add('is-winner'); }
    async function hands(plan: SpinPlan) { if (!board)
        return; for (let n = 0; n < plan.extras.length; n++) {
        const i = plan.extras[n]!, a = (sliceCenterDeg(layout(slices(state.board))[i]!) + rotation) * Math.PI / 180;
        const x = 380 - 213 * Math.cos(a), y = 436 - 213 * Math.sin(a);
        const prop = el('grabbing-hand', '', effects);
        prop.innerHTML = icon('hand');
        prop.addEventListener('animationend', () => prop.remove(), { once: true });
        prop.style.setProperty('--target-x', x + 'px');
        prop.style.setProperty('--target-y', y + 'px');
        prop.style.setProperty('--start-x', n === 0 ? '35px' : '660px');
        sound.tick();
        await sleep(720);
        board.dom.slices[i]!.classList.add('is-winner');
    } }
    function prizePoint(index: number, view: BoardView = board!): Point {
        const angle = (sliceCenterDeg(layout(slices(state.board))[index]!) + view.animator.currentRotationDeg()) * Math.PI / 180;
        const scale = state.mode === 15 ? .65 : 1;
        const center = state.mode === 15 ? { x: view === twin ? 565 : 195, y: 109 + 596 * .6 + (346 - 596 * .6) * scale } : { x: 380, y: 436 };
        return { x: center.x - 210 * scale * Math.cos(angle), y: center.y - 210 * scale * Math.sin(angle) };
    }
    async function pinball(plan: SpinPlan) {
        const ball = el('active-pinball', '', effects);
        ball.innerHTML = icon('ball');
        const ids = [plan.pointers[0]!.index, ...plan.extras];
        let previous = prizePoint(ids[0]!);
        for (const [n, index] of ids.entries()) {
            const point = prizePoint(index);
            ball.style.left = point.x - 19 + 'px';
            ball.style.top = point.y - 19 + 'px';
            if (n && typeof ball.animate === 'function') ball.animate([
                { transform: 'translate(' + (previous.x - point.x) + 'px,' + (previous.y - point.y) + 'px)' },
                { transform: 'translate(' + (previous.x - point.x) / 2 + 'px,' + ((previous.y - point.y) / 2 - 80) + 'px)', offset: .5 },
                { transform: 'translate(0,0)' },
            ], { duration: 650, easing: 'cubic-bezier(.3,.6,.5,1)' });
            await sleep(n ? 650 : 160);
            impact(doc, effects, point, 'bumper-impact');
            board!.dom.slices[index]!.classList.add('is-winner');
            sound.bumper(n);
            previous = point;
            await sleep(160);
        }
        ball.remove();
    }
    async function commit(plan: SpinPlan, both = false) {
        busy = true;
        modal.hidden = true;
        highlights(plan, both);
        if (state.mode === 17)
            await hands(plan);
        if (state.mode === 26)
            await pinball(plan);
        if (state.mode === 21) {
            const seven = el('falling-seven', '7', effects);
            const chute = el('seven-chute', '', seven);
            chute.innerHTML = '<svg viewBox="0 0 120 90"><path d="M5 40C10 -5 110 -5 115 40Z" fill="#e4b9ee" stroke="#fff0cd" stroke-width="4"/><path d="M5 40L60 85L115 40M35 40L60 85L85 40" fill="none" stroke="#fff0cd" stroke-width="3"/></svg>';
            await sleep(1900);
            board!.dom.entries[0]!.querySelector('.entry-text')!.textContent = '$77';
            seven.remove();
        }
        const origins = plan.pointers.map(p => prizePoint(p.index));
        if (plan.secondary && twin) origins.push(prizePoint(plan.secondary.index, twin));
        const a = settle(state, plan, both);
        pendingPlan = undefined;
        message = a.text || 'Spin complete';
        sound.win();
        origins.forEach(p => impact(doc, effects, p));
        collect(doc, effects, origins, a);
        reward(doc, effects, a, state);
        update();
        if (state.mode === 20) {
            stage.classList.add('zap');
            sound.zap();
            await sleep(500);
            stage.classList.remove('zap');
        }
        if (state.mode === 0) {
            renderBoard();
            const tree = el('grown-tree', '', effects);
            tree.innerHTML = icon('tree');
            const point = origins[0]!;
            tree.style.left = point.x + 'px';
            tree.style.top = point.y + 'px';
            tree.addEventListener('animationend', () => tree.remove(), { once: true });
        }
        if (state.mode === 12 && state.scamSpins === 1) {
            await sleep(1300);
            state.board = baseBoard(c);
            renderBoard(true);
            message = 'Attraction complete. Base prizes return.';
        }
        if (state.mode === 27) {
            renderBoard();
            const crown = el('combo-crown', '', effects);
            crown.innerHTML = icon('crown');
            crown.addEventListener('animationend', () => crown.remove(), { once: true });
            sound.combo(state.combo);
        }
        if (state.mode === 25) {
            renderBoard();
            if (a.keys) {
                sound.key();
                const token = front.querySelectorAll('.scam-token')[state.keys - 1];
                token?.classList.add('key-unlocked');
            }
            if (state.keys >= 3) {
                await sleep(1700);
                burst('ESCAPED', 'escape');
                message = 'ESCAPED - finish the round to reveal the total.';
            }
        }
        update();
        if (a.bounce) {
            renderBoard();
            message = 'SHIELD ' + (3 - state.shields) + '/3 - FREE REBOUND';
            stage.classList.add('shield-hit');
            sound.zap();
            update();
            await sleep(2500);
            stage.classList.remove('shield-hit');
            await runSpin(true);
            return;
        }
        if (state.mode === 18) {
            const color = state.board[plan.pointers[0]!.index]!.tag!.slice(6);
            const equation = [...color].map(ch => ch.charCodeAt(0) - 64).join(' + ');
            await sleep(850);
            card('THE COLOR DOES THE MATH', '$' + a.cash, equation + ' = ' + a.cash, [{ label: 'CONTINUE', action: () => api.continue() }]);
            modal.classList.add('rainbow-card');
            rainbowLetters(doc, modal, color);
        }
        if (state.mode === 28 && state.phase === 'choice') {
            await sleep(1100);
            card('BANK IT OR GO AGAIN', a.text, 'The next spin pays its prize plus 50%. Up to two encores.', [{ label: 'BANK IT', action: () => api.encore(false) }, { label: 'ENCORE', action: () => api.encore(true) }]);
            modal.classList.add('encore-card');
        }
        busy = false;
        update();
        opts.onSettle?.();
    }
    async function runSpin(rebound = false) { if (state.mode === 12 && state.scamSpins === 0) {
        stage.classList.add('magnetic-pull');
        sound.reveal(12);
    } busy = true; effects.querySelectorAll('.scam-burst,.scam-reward').forEach(e => e.remove()); consumeSpin(state, rebound); stage.classList.add('is-in-motion'); renderBoard(false); if (state.mode === 22 || rebound) {
        board?.dispose();
        board = makeBoard(state.board, 'main', state.mode === 22 ? 3 : 3.8);
    } const plan = planSpin(state, rng, rebound); pendingPlan = plan; message = rebound ? 'BOUNCE BACK' : state.mode === 22 ? 'KEEP SPINNING' : 'GOOD LUCK, DARLING'; update(); await animatePlan(plan); stage.classList.remove('magnetic-pull', 'is-in-motion'); if (plan.pointers.some(p => p.boundary === 'ask')) {
        state.phase = 'boundary';
        card('ON THE EDGE', 'IN THE MIDDLE?', 'Count the neighboring space too?', [{ label: 'YES - BOTH', action: () => api.confirmBoundary(true) }, { label: 'NO - POINTER ONLY', action: () => api.confirmBoundary(false) }]);
        busy = false;
        update();
        return;
    } await commit(plan); }
    function spin() { if (disposed || paused || busy || state.phase !== 'ready')
        return; if (state.mode === undefined && state.regularCompleted >= 2) {
        const id = chooseMode(c, rng);
        if (id === undefined) {
            message = 'Enable at least one scam in settings.';
            update();
            return;
        }
        timeline(() => reveal(id));
        return;
    } if (state.mode === 22) {
        if (deadline !== undefined && queuedSeconds) {
            deadline = Math.max(performance.now(), deadline) + queuedSeconds * 1000;
            queuedSeconds = 0;
        }
        if (!dashStarted) {
            dashStarted = true;
            busy = true;
            timeline(async () => { card('15 SECOND DASH', 'SPIN TO WIN', 'Press SPIN after each landing. Every spin begun before the buzzer counts.'); await sleep(2800); card('READY', 'GO!', ''); sound.reveal(22); await sleep(600); modal.hidden = true; deadline = performance.now() + (15 + queuedSeconds) * 1000; queuedSeconds = 0; await runSpin(); });
            return;
        }
        if (deadline === undefined || deadline <= performance.now()) {
            message = 'TIME UP - finish the round, or queue more seconds.';
            update();
            return;
        }
    }
    else if (state.remaining <= 0)
        return; timeline(() => runSpin()); }
    function refit() { if (disposed)
        return; const w = doc.defaultView?.innerWidth ?? 760, h = doc.defaultView?.innerHeight ?? 850; const reserved = Number(root.dataset.reservedWidth ?? 0); const scale = Math.min((w - reserved) / 760, h / 640) * .96; stage.style.setProperty('--stage-scale', String(Math.max(.1, scale))); stage.style.left = (reserved + (w - reserved) / 2) + 'px'; board?.refit(); twin?.refit(); }
    const api: ScamApi = { snapshot, newRound(player) { cancel(); state = newRound(c, player); message = 'Two spins. Then the scam.'; theme(); renderBoard(); update(); }, showcase(id) { if (!MODES.some(m => m.id === id))
            return; cancel(); state = newRound(c); state.cash = c.demoBalance; state.remaining = 1; state.regularCompleted = 2; timeline(() => reveal(id)); }, bonus(amount) { if (disposed || busy || state.phase === 'finished' || state.phase === 'picking' || (state.mode !== undefined && [21, 25].includes(state.mode)))
            return; if (state.mode === 22) {
            queuedSeconds = Math.max(0, Math.min(60, queuedSeconds + amount));
            message = queuedSeconds + ' seconds queued for the next spin';
        }
        else
            state.remaining = Math.max(state.mode === undefined && state.regularCompleted === 0 ? 3 : 0, Math.min(99, state.remaining + amount)); update(); }, finish() { if (disposed || busy || state.phase !== 'ready')
            return; busy = true; timeline(async () => { const result = endRound(state); stage.classList.add('round-finale'); deadline = undefined; card('FINAL TOTAL', '$' + result.base, 'Cash $' + state.cash + ' x ' + (state.bank || 1) + ' banked multiplier'); update(); await sleep(1800); if (result.factor > 1) {
            card('CHEAPSKATE BONUS', 'x' + result.factor, 'That total needs a little help.');
            sound.reveal(19);
            await sleep(1700);
        } card(state.player || 'ROUND COMPLETE', '$' + result.total, state.completed + ' completed spins', [{ label: 'NEW ROUND', action: () => api.newRound() }]); sound.finish(); modal.classList.add('final-card'); flourish(doc, effects, 11); busy = false; update(); }); }, confirmBoundary(both) { if (state.phase !== 'boundary' || !pendingPlan || busy)
            return; timeline(() => commit(pendingPlan!, both)); }, continue() { if (busy || state.phase !== 'rainbow')
            return; modal.hidden = true; state.phase = 'ready'; update(); }, pick(index) { if (state.phase !== 'picking' || busy || index < 0 || index >= state.board.length)
            return; const pos = state.picks.indexOf(index); if (pos >= 0)
            state.picks.splice(pos, 1);
        else if (state.picks.length < 6)
            state.picks.push(index); board?.dom.entries.forEach((e, i) => e.classList.toggle('picked', state.picks.includes(i))); message = state.picks.length + ' / 6 SECRETS CHOSEN'; sound.tick(); update(); }, revealPicks() { if (state.phase !== 'picking' || state.picks.length !== 6 || busy)
            return; busy = true; timeline(async () => { for (const i of state.picks) {
            const entry = board!.dom.entries[i]!;
            setPrizeLabel(entry, label(state.board[i]!));
            entry.classList.remove('mystery-covered');
            entry.querySelector('button')?.remove();
            board!.dom.slices[i]!.classList.add('is-winner');
            entry.classList.add('secret-reveal');
            impact(doc, effects, prizePoint(i));
            sound.key();
            await sleep(560);
        } const a = revealPicks(state)!; message = a.text; reward(doc, effects, a, state); collect(doc, effects, state.picks.map(i => prizePoint(i)), a); update(); await sleep(1000); renderBoard(true); busy = false; update(); }); }, mute(value) { muted = value; sound.setMuted(value); update(); }, encore(take) { if (busy || state.phase !== 'choice')
            return; modal.hidden = true; state.phase = 'ready'; if (take) {
            state.remaining = 1;
            message = 'ENCORE READY';
            update();
        }
        else
            api.finish(); }, pause(value) { if (value && !paused)
            pauseStarted = performance.now(); if (!value && paused && pauseStarted !== undefined && deadline !== undefined)
            deadline += performance.now() - pauseStarted; paused = value; update(); } };
    const onClick = (e: MouseEvent) => { if ((e.target as HTMLElement).closest('button') || modal.contains(e.target as Node))
        return; spin(); };
    boards.addEventListener('click', onClick);
    const resize = () => refit();
    doc.defaultView?.addEventListener('resize', resize);
    const clock = setInterval(() => { if (disposed || paused || state.mode !== 22 || deadline === undefined)
        return; const seconds = Math.max(0, Math.ceil((deadline - performance.now()) / 1000)); if (spinsEl.querySelector('.stat-value')?.textContent !== String(seconds)) {
        if (seconds === 0) {
            sound.zap();
            message = 'TIME UP';
        }
        update();
    } }, 100);
    theme();
    renderBoard();
    update();
    refit();
    return { container: root, scam: api, spin, isSpinning: () => busy || state.phase === 'boundary' || state.phase === 'picking' || state.phase === 'rainbow' || state.phase === 'choice', refit, currentRotationDeg: () => rotation, dispose() { disposed = true; cancel(); sound.dispose(); clearInterval(clock); doc.defaultView?.removeEventListener('resize', resize); boards.removeEventListener('click', onClick); } };
}
