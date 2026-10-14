import type { ScamSnapshot } from './widget.js';

export const LIVE_KEY = 'faithScamWheelLiveV1';
export const STALE_MS = 12000;
export interface LiveApi {
    store: { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<unknown> | void };
    getOverlayStatus(): Promise<{ isEditorMode: boolean }>;
}
export type LiveTotals = Pick<ScamSnapshot, 'player' | 'name' | 'phase' | 'cash' | 'bank' | 'remaining' | 'seconds' | 'queuedSeconds' | 'completed' | 'regularCompleted' | 'busy' | 'mode' | 'final' | 'message'> & { paused: boolean };
export interface LivePacket { version: 1; session: string; sequence: number; updatedAt: number; totals: LiveTotals }
export function liveApi(): LiveApi | undefined {
    const api = (globalThis as { SE_API?: LiveApi }).SE_API;
    return api?.store && typeof api.store.get === 'function' && typeof api.store.set === 'function' && typeof api.getOverlayStatus === 'function' ? api : undefined;
}
export function liveTotals(s: ScamSnapshot, paused: boolean): LiveTotals {
    const { player, name, phase, cash, bank, remaining, seconds, queuedSeconds, completed, regularCompleted, busy, mode, final, message } = s;
    return { player, name, phase, cash, bank, remaining, seconds, queuedSeconds, completed, regularCompleted, busy, message, paused, ...(mode === undefined ? {} : { mode }), ...(final === undefined ? {} : { final }) };
}
export function readPacket(value: unknown): LivePacket | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const p = value as LivePacket, s = p.totals;
    if (p.version !== 1 || typeof p.session !== 'string' || !p.session || !Number.isSafeInteger(p.sequence) || p.sequence < 1 || !Number.isFinite(p.updatedAt) || !s || typeof s !== 'object') return undefined;
    if (![s.cash, s.bank, s.remaining, s.seconds, s.completed, s.regularCompleted].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0)) return undefined;
    if (typeof s.queuedSeconds !== 'number' || !Number.isFinite(s.queuedSeconds)) return undefined;
    if (![s.player, s.name, s.message].every(v => typeof v === 'string') || typeof s.busy !== 'boolean' || typeof s.paused !== 'boolean') return undefined;
    if (!['ready', 'revealing', 'spinning', 'boundary', 'picking', 'rainbow', 'choice', 'finished'].includes(s.phase)) return undefined;
    if (s.mode !== undefined && !Number.isInteger(s.mode)) return undefined;
    if (s.final !== undefined && (typeof s.final !== 'number' || !Number.isFinite(s.final))) return undefined;
    return p;
}
export function isFresh(p: LivePacket, now = Date.now()): boolean { return now - p.updatedAt < STALE_MS && p.updatedAt - now < STALE_MS; }
export function packetFromEvent(event: Event): LivePacket | undefined {
    const detail = (event as CustomEvent).detail;
    const data = detail?.event?.data;
    return detail?.listener === 'kvstore:update' && (data?.key === 'customWidget.' + LIVE_KEY || data?.key === LIVE_KEY) ? readPacket(data.value) : undefined;
}
