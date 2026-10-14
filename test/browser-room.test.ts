import { afterEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { connectRoom } from '../src/browser/room.js';
import { proof, randomKey } from '../src/browser/protocol.js';

const mock = vi.hoisted(() => {
    class Events {
        events = new Map<string, Array<(value?: any) => void>>();
        on(name: string, fn: (value?: any) => void) { this.events.set(name, [...(this.events.get(name) ?? []), fn]); }
        emit(name: string, value?: any) { for (const fn of this.events.get(name) ?? []) fn(value); }
    }
    class Connection extends Events {
        peer = 'controller'; open = true; sent: any[] = []; closed = false;
        send(value: any) { this.sent.push(value); }
        close() { if (this.closed) return; this.closed = true; const wasOpen = this.open; this.open = false; if (wasOpen) this.emit('close'); }
    }
    class Peer extends Events {
        static instances: Peer[] = [];
        id: string; open = true; destroyed = false; disconnected = false; dialed: Connection[] = [];
        constructor(id?: string | object) { super(); this.id = typeof id === 'string' ? id : 'controller'; Peer.instances.push(this); }
        connect(target: string) { const c = new Connection(); c.peer = target; c.open = false; this.dialed.push(c); return c; }
        reconnect() { this.disconnected = false; }
        destroy() { this.destroyed = true; }
    }
    return { Peer, Connection };
});
vi.mock('peerjs', () => ({ default: mock.Peer }));
const active: Array<ReturnType<typeof connectRoom>> = [];
afterEach(() => { active.splice(0).forEach(room => room.dispose()); mock.Peer.instances = []; vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
async function viewer() {
    vi.stubGlobal('crypto', webcrypto);
    const key = randomKey(), message = vi.fn(), ready = vi.fn(), status = vi.fn();
    const room = connectRoom({ role: 'viewer', key, message, ready, status }); active.push(room);
    await vi.waitFor(() => expect(mock.Peer.instances).toHaveLength(1));
    const peer = mock.Peer.instances[0]!; peer.emit('open');
    const connection = new mock.Connection(); peer.emit('connection', connection); connection.emit('open');
    return { key, message, ready, status, room, peer, connection };
}
it('keeps commands and snapshots private until the peer proves the room key', async () => {
    const v = await viewer();
    v.connection.emit('data', { kind: 'payload', value: { type: 'action' } });
    expect(v.room.send({ private: 'totals' })).toBe(false);
    const nonce = v.connection.sent[0].nonce;
    const signature = await proof(v.key, 'scam-room-v1:' + nonce + ':' + v.peer.id + ':controller');
    expect(v.message).not.toHaveBeenCalled();
    v.connection.emit('data', { kind: 'proof', signature });
    await vi.waitFor(() => expect(v.status).toHaveBeenCalledWith('connected'));
    v.connection.emit('data', { kind: 'payload', value: { type: 'action' } });
    await vi.waitFor(() => expect(v.message).toHaveBeenCalledWith({ type: 'action' }));
    expect(v.room.send({ private: 'totals' })).toBe(true);
    expect(v.connection.sent.at(-1)).toEqual({ kind: 'payload', value: { private: 'totals' } });
});
it('closes a peer that proves a different room key', async () => {
    const v = await viewer();
    const signature = await proof(randomKey(), 'scam-room-v1:' + v.connection.sent[0].nonce + ':' + v.peer.id + ':controller');
    v.connection.emit('data', { kind: 'proof', signature });
    await vi.waitFor(() => expect(v.connection.closed).toBe(true));
    expect(v.room.send({ secret: 'totals' })).toBe(false); expect(v.message).not.toHaveBeenCalled();
});
it('does not initialize a duplicate viewer that cannot reserve the live identity', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const ready = vi.fn(), status = vi.fn();
    active.push(connectRoom({ role: 'viewer', key: randomKey(), message: vi.fn(), ready, status }));
    await vi.waitFor(() => expect(mock.Peer.instances).toHaveLength(1));
    const peer = mock.Peer.instances[0]!; peer.emit('error', { type: 'unavailable-id' });
    expect(peer.destroyed).toBe(true); expect(status).toHaveBeenCalledWith('duplicate'); expect(ready).not.toHaveBeenCalled();
});
it('never queues a control action while the wheel is disconnected', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const room = connectRoom({ role: 'controls', key: randomKey(), message: vi.fn(), status: vi.fn() }); active.push(room);
    expect(room.send({ type: 'action', command: { type: 'spin' } })).toBe(false);
    await vi.waitFor(() => expect(mock.Peer.instances).toHaveLength(1));
    const peer = mock.Peer.instances[0]!; peer.emit('open');
    expect(peer.dialed).toHaveLength(1); expect(peer.dialed[0]!.sent).toEqual([]);
});

it('retries when an unopened channel times out without emitting close', async () => {
    vi.stubGlobal('crypto', webcrypto);
    active.push(connectRoom({ role: 'controls', key: randomKey(), message: vi.fn(), status: vi.fn() }));
    await vi.waitFor(() => expect(mock.Peer.instances).toHaveLength(1));
    vi.useFakeTimers();
    const peer = mock.Peer.instances[0]!; peer.emit('open');
    vi.advanceTimersByTime(15000);
    expect(peer.dialed[0]!.closed).toBe(true);
    expect(peer.dialed).toHaveLength(2);
});

it('closes a silent authenticated channel even when WebRTC reports it open', async () => {
    const v = await viewer();
    const signature = await proof(v.key, 'scam-room-v1:' + v.connection.sent[0].nonce + ':' + v.peer.id + ':controller');
    v.connection.emit('data', { kind: 'proof', signature });
    await vi.waitFor(() => expect(v.status).toHaveBeenCalledWith('connected'));
    const originalNow = Date.now;
    vi.spyOn(Date, 'now').mockImplementation(() => originalNow() + 11000);
    await vi.waitFor(() => expect(v.connection.closed).toBe(true), { timeout: 2500 });
    vi.restoreAllMocks();
    expect(v.room.send({ type: 'action' })).toBe(false);
});
