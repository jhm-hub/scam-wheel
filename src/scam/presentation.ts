import { icon } from './visuals.js';
import type { Award, RoundState } from './model.js';

export interface Point { x: number; y: number }

function node(doc: Document, parent: HTMLElement, cls: string, text = ''): HTMLDivElement {
    const result = doc.createElement('div');
    result.className = cls;
    result.textContent = text;
    parent.append(result);
    return result;
}

export function activation(doc: Document, stage: HTMLElement, name: string): HTMLElement {
    const scene = node(doc, stage, 'scam-activation');
    scene.setAttribute('role', 'status');
    scene.setAttribute('aria-label', 'Scam activated: ' + name);
    const art = node(doc, scene, 'activation-art');
    art.setAttribute('aria-hidden', 'true');
    const halo = node(doc, art, 'activation-halo');
    for (let i = 0; i < 2; i++) node(doc, halo, 'activation-orbit');
    const plaque = node(doc, art, 'activation-plaque');
    const frame = node(doc, plaque, 'activation-frame');
    frame.innerHTML = '<svg viewBox="0 0 640 310" fill="none"><defs><linearGradient id="alert-candy" x1="100" y1="20" x2="540" y2="290" gradientUnits="userSpaceOnUse"><stop stop-color="#ec9ec6"/><stop offset="1" stop-color="#cf83b3"/></linearGradient></defs><path class="alert-depth" d="M40 18H600V34H618V52H634V252H618V270H600V288H40V270H22V252H6V52H22V34H40Z"/><path class="alert-face" d="M40 18H600V34H618V52H634V252H618V270H600V288H40V270H22V252H6V52H22V34H40Z" fill="url(#alert-candy)"/><path class="alert-trim" d="M49 34H591V49H606V65H619V240H605V255H590V272H50V255H35V240H21V65H35V49H49Z"/><path class="alert-stripe" d="M23 193H617V242H603V257H588V273H52V257H37V242H23Z"/></svg>';
    const lights = node(doc, plaque, 'activation-lights');
    for (let i = 0; i < 22; i++) {
        const bulb = node(doc, lights, 'activation-bulb');
        bulb.style.setProperty('--i', String(i));
        bulb.style.setProperty('--x', (i < 11 ? 58 + i * 52 : 578 - (i - 11) * 52) + 'px');
        bulb.style.setProperty('--y', (i < 11 ? 45 : 260) + 'px');
    }
    const title = node(doc, plaque, 'activation-title');
    const word = node(doc, title, 'activation-scam');
    [...'SCAM'].forEach((letter, i) => {
        const cell = node(doc, word, 'activation-letter', letter);
        cell.style.setProperty('--i', String(i));
    });
    node(doc, title, 'activation-subtitle', 'ACTIVATED');
    node(doc, art, 'activation-mode', name);
    const heart = '<svg viewBox="0 0 80 72"><path d="M8 8H30V16H50V8H72V16H80V40H72V48H64V56H56V64H48V72H32V64H24V56H16V48H8V40H0V16H8Z" fill="currentColor"/><path d="M12 18H28V26H12Z" fill="#fff9e8"/></svg>';
    for (let i = 0; i < 10; i++) {
        const charm = node(doc, art, 'activation-charm ' + (i < 2 ? 'pixel-heart' : 'twinkle'));
        charm.innerHTML = i < 2 ? heart : icon('star');
        charm.style.setProperty('--i', String(i));
    }
    return scene;
}

const treatments: Record<number, { shape: string; motion: string; count: number }> = {
    0: { shape: 'tree', motion: 'grow', count: 5 },
    1: { shape: 'coin', motion: 'shower', count: 12 },
    2: { shape: 'star', motion: 'mirror', count: 2 },
    3: { shape: 'ticket', motion: 'stamp', count: 6 },
    4: { shape: 'star', motion: 'spotlight', count: 5 },
    5: { shape: 'ticket', motion: 'orbit', count: 7 },
    6: { shape: 'heart', motion: 'hearts', count: 9 },
    8: { shape: 'phone', motion: 'ring', count: 2 },
    9: { shape: 'ticket', motion: 'shower', count: 8 },
    10: { shape: 'ticket', motion: 'expand', count: 4 },
    11: { shape: 'star', motion: 'constellation', count: 7 },
    12: { shape: 'magnet', motion: 'attract', count: 2 },
    13: { shape: 'heart', motion: 'trio', count: 3 },
    14: { shape: 'wing', motion: 'wings', count: 2 },
    15: { shape: 'heart', motion: 'mirror', count: 2 },
    16: { shape: 'bolt', motion: 'power', count: 8 },
    17: { shape: 'hand', motion: 'grab', count: 4 },
    18: { shape: 'star', motion: 'spectrum', count: 7 },
    19: { shape: 'coin', motion: 'mirror', count: 4 },
    20: { shape: 'lock', motion: 'scan', count: 4 },
    21: { shape: 'ticket', motion: 'float', count: 5 },
    22: { shape: 'bolt', motion: 'dash', count: 8 },
    23: { shape: 'shield', motion: 'orbit', count: 3 },
    24: { shape: 'card', motion: 'cards', count: 6 },
    25: { shape: 'key', motion: 'unlock', count: 3 },
    26: { shape: 'ball', motion: 'ricochet', count: 5 },
    27: { shape: 'crown', motion: 'crown', count: 3 },
    28: { shape: 'ticket', motion: 'curtain', count: 6 },
};

export function flourish(doc: Document, layer: HTMLElement, id: number): void {
    layer.querySelector('.mode-flourish')?.remove();
    const treatment = treatments[id]!;
    const scene = node(doc, layer, 'mode-flourish flow-' + treatment.motion);
    scene.dataset.mode = String(id);
    for (let i = 0; i < treatment.count; i++) {
        const prop = node(doc, scene, 'flourish-prop');
        const angle = Math.PI * 2 * i / treatment.count - Math.PI / 2;
        const radius = id === 15 ? 305 : 270;
        prop.innerHTML = icon(treatment.shape);
        prop.style.setProperty('--i', String(i));
        prop.style.setProperty('--x', Math.cos(angle) * radius + 'px');
        prop.style.setProperty('--y', Math.sin(angle) * radius + 'px');
        prop.style.setProperty('--angle', i * 360 / treatment.count + 'deg');
        prop.style.setProperty('--spread', (i - (treatment.count - 1) / 2) * 90 + 'px');
        prop.style.setProperty('--side', i % 2 ? '1' : '-1');
        prop.style.setProperty('--delay', i * .085 + 's');
    }
    const ring = node(doc, scene, 'flourish-ring');
    ring.addEventListener('animationend', () => scene.remove(), { once: true });
}

export function impact(doc: Document, layer: HTMLElement, at: Point, kind = ''): void {
    const ring = node(doc, layer, 'prize-impact ' + kind);
    ring.style.left = at.x + 'px';
    ring.style.top = at.y + 'px';
    ring.innerHTML = icon('star');
    ring.addEventListener('animationend', () => ring.remove(), { once: true });
}

export function collect(doc: Document, layer: HTMLElement, starts: Point[], award: Award): void {
    const types = [
        ...(award.cash ? [{ shape: 'coin', x: 350 }] : []),
        ...(award.mult ? [{ shape: 'star', x: 380 }] : []),
        ...(award.spins ? [{ shape: 'ticket', x: 410 }] : []),
    ];
    starts.forEach((start, i) => types.forEach((type, j) => {
        const token = node(doc, layer, 'prize-collect');
        token.innerHTML = icon(type.shape);
        token.style.left = start.x + 'px';
        token.style.top = start.y + 'px';
        token.style.setProperty('--dx', type.x - start.x + 'px');
        token.style.setProperty('--dy', 436 - start.y + 'px');
        token.style.setProperty('--delay', (i * .09 + j * .06) + 's');
        token.addEventListener('animationend', () => token.remove(), { once: true });
    }));
}

export function reward(doc: Document, layer: HTMLElement, award: Award, state: RoundState): HTMLElement {
    layer.querySelectorAll('.scam-burst,.scam-reward').forEach(e => e.remove());
    const panel = node(doc, layer, 'scam-reward');
    let caption = 'NICE HIT';
    if (state.mode === 27) caption = 'COMBO x' + state.combo;
    else if (award.bounce) caption = 'CASH + FREE REBOUND';
    else if (award.keys) caption = 'KEY ' + state.keys + ' / 3';
    else if (state.mode === 0) caption = state.trees.length < 5 ? state.trees.length + ' / 5 TREES GROWN' : state.remaining ? 'FIND THE EXIT' : 'ESCAPED';
    else if (state.mode === 20 && award.spins) caption = 'LASER PAYDAY';
    else if (state.mode === 26) caption = 'THREE BUMPERS COLLECTED';
    else if (state.mode === 28 && state.scamSpins > 1) caption = 'ENCORE +50%';
    else if (award.indices.length > 1) caption = award.indices.length + ' PRIZES COLLECTED';
    node(doc, panel, 'reward-caption', caption);
    node(doc, panel, 'reward-value', award.cash || (!award.mult && !award.spins) ? '+$' + award.cash : award.mult ? 'x' + award.mult : '+' + award.spins + ' SPINS');
    const bonuses = node(doc, panel, 'reward-bonuses');
    if (award.cash && award.mult) node(doc, bonuses, 'reward-chip', 'x' + award.mult + ' BANKED');
    if (award.spins && (award.cash || award.mult)) node(doc, bonuses, 'reward-chip', '+' + award.spins + ' SPIN' + (award.spins === 1 ? '' : 'S'));
    panel.addEventListener('animationend', e => { if (e.target === panel) panel.remove(); });
    return panel;
}

export function rainbowLetters(doc: Document, parent: HTMLElement, color: string): void {
    const row = node(doc, parent, 'rainbow-letters');
    [...color].forEach((letter, i) => {
        const tile = node(doc, row, 'rainbow-letter');
        tile.style.setProperty('--i', String(i));
        node(doc, tile, 'letter-symbol', letter);
        node(doc, tile, 'letter-value', String(letter.charCodeAt(0) - 64));
    });
}
