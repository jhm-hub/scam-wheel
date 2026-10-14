import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mountWidget } from '../src/app.js';
import { mountLiveMonitor } from '../src/scam/monitor-view.js';
import { publishLiveTotals } from '../src/scam/live-publisher.js';
import { LIVE_KEY, type LiveApi, type LivePacket } from '../src/scam/live-shared.js';

const cleanups: (() => void)[] = [];
beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] }));
afterEach(() => { cleanups.reverse().forEach(fn => fn()); cleanups.length = 0; document.body.replaceChildren(); vi.useRealTimers(); });
function bus(editor = false) {
    let stored: unknown;
    const api: LiveApi = {
        getOverlayStatus: vi.fn(async () => ({ isEditorMode: editor })),
        store: {
            get: vi.fn(async () => structuredClone(stored)),
            set: vi.fn((key, value) => { stored = structuredClone(value); event(value, key); }),
        },
    };
    return { api, packet: () => stored as LivePacket };
}
function event(value: unknown, key = LIVE_KEY) {
    window.dispatchEvent(new CustomEvent('onEventReceived', { detail: { listener: 'kvstore:update', event: { data: { key: 'customWidget.' + key, value } } } }));
}
function game(api: LiveApi) {
    const h = mountWidget(document, { fieldData: { gameMode: 'scam', disableSound: true } }, { rng: () => .041 });
    if ('error' in h) throw Error('game');
    cleanups.push(() => h.dispose());
    const publisher = publishLiveTotals(h.root, () => h.scam!.snapshot(), () => false, api);
    cleanups.push(() => publisher.dispose());
    return { h, publisher };
}
function monitor(api: LiveApi) { const m = mountLiveMonitor(document, api); cleanups.push(() => m.dispose()); return m; }
const values = (root: HTMLElement) => [...root.querySelectorAll('dd')].map(el => el.textContent);

it('a late-joining monitor follows real game awards and final totals without writing', async () => {
    const b = bus(), g = game(b.api);
    await vi.advanceTimersByTimeAsync(350); await g.publisher.ready;
    expect(g.publisher.canControl()).toBe(true);
    g.h.scam!.newRound('Faith'); g.h.spin(); await vi.advanceTimersByTimeAsync(7000);
    const m = monitor(b.api); await m.ready;
    const s = g.h.scam!.snapshot();
    expect(s.cash).toBeGreaterThan(0);
    expect(values(m.root)).toEqual(['$' + s.cash, 'x' + (s.bank || 1), String(s.remaining)]);
    expect(m.root.querySelector('.monitor-player')!.textContent).toBe('Faith');
    const writes = vi.mocked(b.api.store.set).mock.calls.length;
    window.dispatchEvent(new CustomEvent('onEventReceived', { detail: { listener: 'message', event: { data: { text: '!scam spin' } } } }));
    expect(vi.mocked(b.api.store.set)).toHaveBeenCalledTimes(writes);
    expect(document.querySelectorAll('.scam-widget')).toHaveLength(1);
    g.h.scam!.finish(); await vi.advanceTimersByTimeAsync(700);
    expect(m.root.querySelector('.monitor-final')!.textContent).toBe('Final total: $' + g.h.scam!.snapshot().final);
    expect(b.packet().totals).not.toHaveProperty('board');
});

it('keeps stale totals, recovers, and rejects wrong-key, invalid and out-of-order events', async () => {
    const b = bus(), g = game(b.api); await vi.advanceTimersByTimeAsync(350);
    const m = monitor(b.api); await m.ready;
    g.h.scam!.bonus(2); await vi.advanceTimersByTimeAsync(600);
    const p = structuredClone(b.packet()); expect(values(m.root)[2]).toBe('5');
    event({ ...p, sequence: p.sequence - 1, totals: { ...p.totals, remaining: 99 } });
    event({ ...p, sequence: p.sequence + 1, totals: { ...p.totals, remaining: 99 } }, 'anotherWheel');
    event({ ...p, sequence: p.sequence + 2, totals: { ...p.totals, cash: NaN } });
    expect(values(m.root)[2]).toBe('5');
    g.publisher.dispose(); await vi.advanceTimersByTimeAsync(14000);
    expect(m.root.querySelector('.monitor-status')!.textContent).toContain('offline');
    expect(values(m.root)[2]).toBe('5');
    event({ ...p, sequence: p.sequence + 3, updatedAt: Date.now(), totals: { ...p.totals, remaining: 7 } });
    expect(m.root.querySelector('.monitor-status')!.textContent).toBe('LIVE FROM OBS');
    expect(values(m.root)[2]).toBe('7');
});

it('publishes the timed game clock, queued seconds and frozen countdown while paused', async () => {
    const b = bus(), g = game(b.api); await vi.advanceTimersByTimeAsync(350);
    const m = monitor(b.api); await m.ready;
    g.h.scam!.showcase(22); await vi.advanceTimersByTimeAsync(5000);
    g.h.spin(); await vi.advanceTimersByTimeAsync(6800);
    expect(g.h.scam!.snapshot().seconds).toBeLessThan(15);
    expect(values(m.root)[2]).toBe(String(b.packet().totals.seconds));
    expect(m.root.querySelectorAll('dt')[2]!.textContent).toBe('SECONDS LEFT');
    g.h.scam!.bonus(4); await vi.advanceTimersByTimeAsync(500);
    expect(m.root.querySelector('.monitor-meta')!.textContent).toContain('4 seconds queued');
    g.h.scam!.pause(true);
    const seconds = g.h.scam!.snapshot().seconds;
    await vi.advanceTimersByTimeAsync(3000);
    expect(g.h.scam!.snapshot().seconds).toBe(seconds);
    expect(b.packet().totals.seconds).toBe(seconds);
});

it('editor previews never publish, and a duplicate waits for the active viewer to close', async () => {
    const b = bus(), first = game(b.api); await vi.advanceTimersByTimeAsync(350);
    first.h.scam!.newRound('Active player'); await vi.advanceTimersByTimeAsync(600);
    const second = game(b.api); await second.publisher.ready;
    expect(second.publisher.canControl()).toBe(false);
    expect(second.h.root.inert).toBe(true);
    await vi.advanceTimersByTimeAsync(15000);
    expect(b.packet().totals.player).toBe('Active player');
    first.publisher.dispose(); await vi.advanceTimersByTimeAsync(16000);
    expect(second.publisher.canControl()).toBe(true);
    const editorBus = bus(true), editor = game(editorBus.api); await editor.publisher.ready;
    await vi.advanceTimersByTimeAsync(15000);
    expect(editor.publisher.canControl()).toBe(false);
    expect(editor.h.root.dataset.liveRole).toBe('editor-preview');
    expect(editorBus.api.store.set).not.toHaveBeenCalled();
});

it('settles simultaneous startup to one publisher', async () => {
    const b = bus(), a = game(b.api), c = game(b.api);
    await vi.advanceTimersByTimeAsync(800);
    expect([a.publisher.canControl(), c.publisher.canControl()].filter(Boolean)).toHaveLength(1);
    const session = b.packet().session;
    await vi.advanceTimersByTimeAsync(15000);
    expect(b.packet().session).toBe(session);
});

it('stops controlling on API failure and resumes after storage recovers', async () => {
    const b = bus(), g = game(b.api); await vi.advanceTimersByTimeAsync(350);
    const m = monitor(b.api); await m.ready;
    vi.mocked(b.api.store.get).mockRejectedValue(new Error('offline'));
    await vi.advanceTimersByTimeAsync(3500);
    expect(g.publisher.canControl()).toBe(false);
    expect(m.root.querySelector('.monitor-status')!.textContent).toContain('interrupted');
    vi.mocked(b.api.store.get).mockImplementation(async () => structuredClone(b.packet()));
    await vi.advanceTimersByTimeAsync(3500);
    expect(g.publisher.canControl()).toBe(true);
    expect(m.root.querySelector('.monitor-status')!.textContent).toBe('LIVE FROM OBS');
});
