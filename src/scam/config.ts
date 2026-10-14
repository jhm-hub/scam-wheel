import { MODES } from './catalog.js';
export interface ModeSetting {
    id: number;
    name: string;
    enabled: boolean;
    weight: number;
}
export interface ScamConfig {
    version: 1;
    cash: number[];
    startingSpins: number;
    demoBalance: number;
    boost: number;
    flatCash: number;
    angels: number[];
    multipliers: number[];
    modes: ModeSetting[];
    spinSeconds: number;
    player: string;
}
export const defaultScamConfig = (): ScamConfig => ({
    version: 1, cash: [6, 11, 7, 6, 10, 8, 5, 9, 4, 12], startingSpins: 3, demoBalance: 50, boost: 15, flatCash: 25,
    angels: [22, 33, 44, 55, 66, 77], multipliers: [2, 3, 4, 5, 6, 2, 3, 4, 5, 6], spinSeconds: 6.2, player: '',
    modes: MODES.map(m => ({ id: m.id, name: m.name, enabled: !m.experimental, weight: 1 })),
});
function object(v: unknown): Record<string, unknown> { return v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}; }
function number(v: unknown, fallback: number, min = 0, max = 100000): number { return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback; }
function list(v: unknown, fallback: number[], min = 0): number[] { return Array.isArray(v) && v.length === fallback.length ? fallback.map((d, i) => number(v[i], d, min)) : fallback; }
export function parseScamConfig(raw: unknown): ScamConfig {
    let value = raw;
    if (typeof raw === 'string') {
        try {
            value = JSON.parse(raw);
        }
        catch {
            value = {};
        }
    }
    const v = object(value), d = defaultScamConfig();
    return { ...d, cash: list(v.cash, d.cash), startingSpins: Math.round(number(v.startingSpins, d.startingSpins, 3, 99)), demoBalance: number(v.demoBalance, d.demoBalance), boost: number(v.boost, d.boost), flatCash: number(v.flatCash, d.flatCash), angels: list(v.angels, d.angels), multipliers: list(v.multipliers, d.multipliers, 1), spinSeconds: number(v.spinSeconds, d.spinSeconds, 4.5, 12), player: typeof v.player === 'string' ? v.player.slice(0, 40) : '', modes: d.modes.map(m => { const saved = Array.isArray(v.modes) ? object(v.modes.find((x: unknown) => object(x).id === m.id)) : {}; return { ...m, name: typeof saved.name === 'string' && saved.name.trim() ? saved.name.trim().slice(0, 44) : m.name, enabled: typeof saved.enabled === 'boolean' ? saved.enabled : m.enabled, weight: number(saved.weight, m.weight, 0.01, 100) }; }) };
}
