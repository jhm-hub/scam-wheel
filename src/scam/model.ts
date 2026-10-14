import { deg, sliceIndex, weight, type Degrees } from '../model/units.js';
import { layout, sliceAtAngle, sliceCenterDeg } from '../model/geometry.js';
import type { Slice } from '../config/slices.js';
import type { Rng } from '../model/spin.js';
import type { ScamConfig } from './config.js';
export interface Prize {
    cash: number;
    spins: number;
    mult: number;
    key?: boolean;
}
export interface Space {
    cashSpace: boolean;
    prize: Prize;
    weight: number;
    tag?: string;
    color?: string;
    inactive?: boolean;
}
export interface PointerLanding {
    index: number;
    angle: Degrees;
    neighbor?: number;
    boundary: 'none' | 'ask' | 'auto';
}
export interface SpinPlan {
    pointers: PointerLanding[];
    secondary?: PointerLanding;
    extras: number[];
    rebound: boolean;
}
export interface Award {
    cash: number;
    spins: number;
    mult: number;
    keys: number;
    indices: number[];
    bounce: boolean;
    text: string;
}
export type Phase = 'ready' | 'revealing' | 'spinning' | 'boundary' | 'picking' | 'rainbow' | 'choice' | 'finished';
export interface RoundState {
    phase: Phase;
    player: string;
    cash: number;
    bank: number;
    remaining: number;
    regularCompleted: number;
    completed: number;
    scamSpins: number;
    mode?: number;
    board: Space[];
    trees: number[];
    tickerMult: number;
    tickerSpins: number;
    middleMult: number;
    handSpecial: boolean;
    doubleHit: boolean;
    shields: number;
    keys: number;
    picks: number[];
    mysteryDone: boolean;
    comboColors: number[];
    combo: number;
    final?: number;
}
const prize = (cash = 0, spins = 0, mult = 0): Prize => ({ cash, spins, mult });
const space = (cash: number | undefined = undefined, spins = 0, mult = 0): Space => ({ cashSpace: cash !== undefined, prize: prize(cash ?? 0, spins, mult), weight: 1 });
export function baseBoard(c: ScamConfig): Space[] { const a = c.cash; return [space(a[0]), space(undefined, 2), space(a[1]), space(a[2]), space(a[3], 1), space(a[4]), space(a[5]), space(undefined, 1, 2), space(a[6]), space(a[7]), space(a[8], 1), space(a[9])]; }
export function label(s: Space): string { if (s.inactive)
    return 'OFF'; if (s.tag === 'key')
    return 'KEY\n$' + s.prize.cash; const p = s.prize; return [s.tag?.startsWith('color:') ? s.tag.slice(6) : s.cashSpace ? '$' + p.cash : '', p.mult ? 'x' + p.mult : '', p.spins ? '+' + p.spins + ' SPIN' + (p.spins === 1 ? '' : 'S') : ''].filter(Boolean).join('\n') || '$0'; }
export function slices(board: Space[]): Slice[] { return board.map((s, i) => ({ index: sliceIndex(i), text: label(s), weight: weight(s.weight), ...(s.color ? { color: s.color } : {}) })); }
export function newRound(c: ScamConfig, player = c.player): RoundState { return { phase: 'ready', player, cash: 0, bank: 0, remaining: c.startingSpins, regularCompleted: 0, completed: 0, scamSpins: 0, board: baseBoard(c), trees: [], tickerMult: 0, tickerSpins: 0, middleMult: 0, handSpecial: false, doubleHit: false, shields: 3, keys: 0, picks: [], mysteryDone: false, comboColors: [], combo: 1 }; }
export function chooseMode(c: ScamConfig, rng: Rng): number | undefined { const pool = c.modes.filter(m => m.enabled); const total = pool.reduce((s, m) => s + m.weight, 0); if (!pool.length)
    return undefined; let r = rng() * total; for (const m of pool) {
    r -= m.weight;
    if (r <= 0)
        return m.id;
} return pool[pool.length - 1]!.id; }
export function beginMode(s: RoundState, id: number, c: ScamConfig, rng: Rng): void {
    s.mode = id;
    s.phase = 'revealing';
    s.board = baseBoard(c);
    const b = s.board;
    if (id === 0)
        s.board = Array.from({ length: 12 }, () => space(1));
    if (id === 1 || id === 3)
        b.forEach(v => { if (v.cashSpace)
            v.prize.cash = id === 1 ? v.prize.cash + c.boost : c.flatCash; });
    if (id === 4)
        b.forEach((v, i) => v.weight = i === 7 ? 35 : 65 / 11);
    if (id === 5)
        b.forEach((v, i) => v.weight = i === 1 ? 30 : 70 / 11);
    if (id === 6)
        [3, 5, 6, 9].forEach(i => b[i]!.prize.spins++);
    if (id === 8)
        s.board = Array.from({ length: 12 }, (_, i) => ({ ...space(i % 6 === 0 ? 100 : 20), weight: i % 6 === 0 ? 20 : 6 }));
    if (id === 10)
        b.forEach((v, i) => v.weight = i === 4 || i === 10 ? 40 : 2);
    if (id === 11) {
        s.board = c.multipliers.map(m => space(undefined, 0, m));
        s.remaining = 1;
    }
    if (id === 12)
        b.forEach((v, i) => v.weight = i === 7 ? 15 : 345 / 11);
    if (id === 14)
        s.board = c.angels.map(n => space(n));
    if (id === 15)
        b[7]!.prize.spins = 0;
    if (id === 16)
        s.board = Array.from({ length: 12 }, (_, i) => i === 0 ? space(undefined, 1, 2) : i === 3 ? space(25) : i === 6 ? space(25, 1) : i === 9 ? space(50) : { ...space(), inactive: true });
    if (id === 18)
        s.board = ['RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'INDIGO', 'VIOLET'].map((color, i) => ({ ...space([...color].reduce((n, ch) => n + ch.charCodeAt(0) - 64, 0)), tag: 'color:' + color, color: ['#ce6c91', '#df986d', '#c7b862', '#65b79d', '#72abd2', '#9b8dcf', '#c992d7'][i]! }));
    if (id === 19) {
        b.forEach(v => v.prize.cash *= 2);
        b[7]!.prize.mult = 4;
        b[1]!.prize.spins = 4;
    }
    if (id === 20)
        [0, 2, 4, 6, 8, 10].forEach(i => b[i] = { ...space(15, 1), tag: 'laser' });
    if (id === 21) {
        s.board = [{ ...space(77), weight: 95, tag: 'seven' }, { ...space(777), weight: 5, tag: 'decoy' }];
        s.remaining = 1;
    }
    if (id === 22) {
        b[1] = space(10);
        b[4] = space(9);
        b[10] = space(8);
        b.forEach(v => v.prize.spins = 0);
    }
    if (id === 23) {
        b[4] = space(10, 1);
        b[10] = space(10, 1);
    }
    if (id === 24) {
        b[1] = space(15);
        b[4] = space(14);
        b[10] = space(13);
        for (let i = b.length - 1; i > 0; i--) {
            const j = Math.min(i, Math.floor(rng() * (i + 1)));
            [b[i], b[j]] = [b[j]!, b[i]!];
        }
    }
    if (id === 25) {
        s.board = Array.from({ length: 12 }, (_, i) => i % 2 === 0 ? { ...space(5), tag: 'key', prize: { ...prize(5), key: true } } : i === 1 ? space(undefined, 0, 2) : space(({ 3: 5, 5: 15, 7: 25, 9: 10, 11: 20 } as Record<number, number>)[i]));
        s.remaining = 1;
    }
    if (id === 26 || id === 27 || id === 28) {
        s.board = c.cash.map((cash, i) => ({ ...space(cash), tag: 'combo:' + i % 3 }));
        s.remaining = id === 27 ? 3 : 1;
    }
}
export function finishReveal(s: RoundState): void { if (s.mode === 9)
    s.remaining += 2; s.phase = s.mode === 24 ? 'picking' : 'ready'; }
function landing(board: Space[], angle: Degrees, mode: number | undefined): PointerLanding {
    const laid = layout(slices(board)), i = sliceAtAngle(laid, angle) as number, l = laid[i]!;
    const local = ((angle as number) - l.startTurn * 360 + 360) % 360, w = l.sizeTurn * 360;
    const ratio = Math.min(local, w - local) / w, neighbor = local < w / 2 ? (i + board.length - 1) % board.length : (i + 1) % board.length;
    const askModes = [1, 2, 3, 4, 8, 9, 12, 14, 19];
    const boundary = mode === undefined ? (ratio <= .1 ? 'auto' : ratio <= .15 ? 'ask' : 'none') : askModes.includes(mode) && ratio <= .1 ? 'ask' : 'none';
    return { index: i, angle, boundary, ...(boundary === 'none' ? {} : { neighbor }) };
}
const group = (p: PointerLanding, both: boolean): number[] => p.neighbor !== undefined && (both || p.boundary === 'auto') ? [p.index, p.neighbor] : [p.index];
export function planSpin(s: RoundState, rng: Rng, rebound = false): SpinPlan {
    const board = s.board, laid = layout(slices(board));
    const center = (i: number) => sliceCenterDeg(laid[i]!);
    function make(angle: Degrees): SpinPlan {
        const p = landing(board, angle, s.mode), pointers = [p];
        if (s.mode === 2)
            pointers.push(landing(board, deg((angle + 180) % 360), s.mode));
        let extras: number[] = [];
        if (s.mode === 13)
            extras = [(p.index + board.length - 1) % board.length, (p.index + 1) % board.length];
        return { pointers, extras, rebound };
    }
    function allowed(p: SpinPlan): boolean { const ids = [...p.pointers.flatMap(x => group(x, true)), ...p.extras]; return !ids.some(i => board[i]!.inactive) && !(s.mode === 2 && ids.some(i => (board[i]!.prize.mult > 0 && s.tickerMult >= 2) || (board[i]!.prize.spins === 2 && s.tickerSpins >= 2))) && !(s.mode === 13 && s.middleMult >= 2 && ids.some(i => board[i]!.prize.mult > 0)) && !(s.mode === 19 && s.doubleHit && ids.some(i => board[i]!.prize.spins === 4)); }
    let planned: SpinPlan | undefined;
    if (s.mode === 12 && s.scamSpins === 0)
        planned = make(center(7));
    if (s.mode === 21)
        planned = make(center(0));
    if (s.mode === 16) {
        const active = board.map((v, i) => ({ v, i })).filter(x => !x.v.inactive);
        planned = make(center(active[Math.min(active.length - 1, Math.floor(rng() * active.length))]!.i));
    }
    for (let attempt = 0; !planned && attempt < 256; attempt++) {
        const p = make(deg(rng() * 360));
        if (allowed(p))
            planned = p;
    }
    if (!planned)
        planned = laid.map(l => make(sliceCenterDeg(l))).find(allowed);
    if (!planned)
        throw new Error('No eligible landing');
    if (s.mode === 15)
        planned.secondary = landing(board, deg(rng() * 360), s.mode);
    if (s.mode === 17 || s.mode === 26) {
        const used = new Set([planned.pointers[0]!.index]);
        const primary = board[planned.pointers[0]!.index]!.prize;
        const specialAllowed = s.mode === 17 && !s.handSpecial && !primary.spins && !primary.mult && rng() < .5;
        for (let n = 0; n < 2; n++) {
            const options = board.map((v, i) => ({ v, i })).filter(({ v, i }) => !used.has(i) && ((specialAllowed && n === 0) ? v.prize.spins > 0 || v.prize.mult > 0 : !v.prize.spins && !v.prize.mult));
            const i = options[Math.min(options.length - 1, Math.floor(rng() * options.length))]!.i;
            used.add(i);
            planned.extras.push(i);
        }
    }
    return planned;
}
export function settle(s: RoundState, plan: SpinPlan, both = false): Award {
    const ids = plan.pointers.flatMap(p => group(p, both));
    let cash = 0, spins = 0, mult = 0, keys = 0;
    const add = (i: number, allowSpins = true) => { const p = s.board[i]!.prize; cash += p.cash; mult += p.mult; if (allowSpins)
        spins += p.spins; if (p.key)
        keys++; };
    if (s.mode === 2) {
        for (const p of plan.pointers) {
            const g = group(p, both);
            let bonus = 0;
            for (const i of g) {
                add(i, false);
                bonus += s.board[i]!.prize.spins;
                if (s.board[i]!.prize.mult)
                    s.tickerMult++;
                if (s.board[i]!.prize.spins === 2)
                    s.tickerSpins++;
            }
            spins = Math.max(spins, bonus);
        }
    }
    else
        ids.forEach(i => add(i));
    for (const i of plan.extras)
        add(i, s.mode !== 13 || s.scamSpins === 0);
    if (plan.secondary)
        add(plan.secondary.index);
    if (s.mode === 0) {
        const i = ids[0]!;
        if (s.trees.includes(i) || s.trees.length < 5) {
            if (!s.trees.includes(i))
                s.trees.push(i);
            s.board[i] = { ...space(11, 1), tag: 'tree' };
            cash = 11;
            s.remaining = 1;
        }
        else {
            cash = 1;
            s.remaining = 0;
        }
        spins = 0;
    }
    if (s.mode === 13 && mult)
        s.middleMult++;
    if (s.mode === 17 && plan.extras.some(i => s.board[i]!.prize.spins || s.board[i]!.prize.mult))
        s.handSpecial = true;
    if (s.mode === 19 && ids.some(i => s.board[i]!.prize.spins === 4))
        s.doubleHit = true;
    if (s.mode === 21) {
        cash = 77;
        spins = 0;
        s.remaining = 0;
    }
    if (s.mode === 25) {
        s.keys += keys;
        s.remaining = s.keys >= 3 ? 0 : 1;
    }
    if (s.mode === 27) {
        const color = ids[0]! % 3;
        s.combo = Math.min(3, s.scamSpins + 1);
        s.comboColors = [...s.comboColors, color];
        cash *= s.combo;
    }
    if (s.mode === 28 && s.scamSpins > 0)
        cash *= 1.5;
    const bounce = s.mode === 23 && s.shields > 0 && ids.length === 1 && !mult && !spins;
    if (bounce)
        s.shields--;
    s.cash = Math.round((s.cash + cash) * 100) / 100;
    s.bank += mult;
    if (!(s.mode !== undefined && [0, 21, 22, 25].includes(s.mode)))
        s.remaining += spins;
    if (!bounce) {
        s.completed++;
        if (s.mode === undefined)
            s.regularCompleted++;
        else
            s.scamSpins++;
    }
    s.phase = s.mode === 18 ? 'rainbow' : s.mode === 28 && s.scamSpins < 3 ? 'choice' : 'ready';
    const all = [...ids, ...plan.extras, ...(plan.secondary ? [plan.secondary.index] : [])];
    return { cash, spins, mult, keys, indices: all, bounce, text: [cash ? '$' + cash : '', mult ? 'x' + mult + ' BANKED' : '', spins ? '+' + spins + ' SPIN' + (spins === 1 ? '' : 'S') : '', keys ? 'KEY ' + s.keys + '/3' : ''].filter(Boolean).join(' + ') };
}
export function consumeSpin(s: RoundState, rebound = false): void { s.phase = 'spinning'; if (!rebound && !(s.mode !== undefined && [22, 25].includes(s.mode)))
    s.remaining = Math.max(0, s.remaining - 1); }
export function revealPicks(s: RoundState): Award | undefined { if (s.phase !== 'picking' || s.picks.length !== 6)
    return undefined; let cash = 0, mult = 0; for (const i of s.picks) {
    cash += s.board[i]!.prize.cash;
    mult += s.board[i]!.prize.mult;
} s.cash += cash; s.bank += mult; s.mysteryDone = true; s.remaining = 1; s.phase = 'ready'; return { cash, mult, spins: 0, keys: 0, indices: [...s.picks], bounce: false, text: '$' + cash + (mult ? ' + x' + mult + ' BANKED' : '') }; }
export function endRound(s: RoundState): {
    base: number;
    factor: number;
    total: number;
} { const base = s.cash * (s.bank || 1), factor = base <= 30 ? 3 : base <= 50 ? 2 : 1; s.final = Math.round(base * factor * 100) / 100; s.phase = 'finished'; return { base, factor, total: s.final }; }
