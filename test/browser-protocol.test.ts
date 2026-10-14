import { describe, it, expect, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { chatCommand, executeCommand, proof, randomKey, readCommand, RecentIds, roomId, verifyProof } from '../src/browser/protocol.js';
import type { MountHandle } from '../src/app.js';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
describe('browser room authorization and commands', () => {
    it('uses unpredictable room keys and does not put the key in the signaling id', async () => {
        const first = randomKey(), second = randomKey();
        expect(first).toMatch(/^[a-f0-9]{64}$/); expect(first).not.toBe(second);
        expect(await roomId(first)).not.toContain(first);
        expect(await roomId(first)).toBe(await roomId(first));
    });
    it('rejects the wrong room and a replayed proof for another connection', async () => {
        const key = randomKey(), signature = await proof(key, 'nonce:viewer:controller');
        expect(await verifyProof(key, 'nonce:viewer:controller', signature)).toBe(true);
        expect(await verifyProof(randomKey(), 'nonce:viewer:controller', signature)).toBe(false);
        expect(await verifyProof(key, 'other:viewer:controller', signature)).toBe(false);
        expect(await verifyProof(key, 'nonce:controller:viewer', signature)).toBe(false);
        expect(await verifyProof(key, 'nonce:viewer:controller', 'broken')).toBe(false);
    });
    it('accepts a delivered action id once and bounds duplicate history', () => {
        const seen = new RecentIds();
        expect(seen.accept('spin-1')).toBe(true); expect(seen.accept('spin-1')).toBe(false);
        expect(seen.accept(null)).toBe(false); expect(seen.accept('')).toBe(false);
        for (let i = 0; i < 501; i++) expect(seen.accept('action-' + i)).toBe(true);
        expect(seen.accept('action-500')).toBe(false);
    });
    it.each(['!wheel', '!spin', '!scammer', '!scam bonus', '!scam bonus 999', '!scam pick 0', '!scam pick 13', '!scam demo 7', '!scam demo 999', '!scam spin surprise'])('ignores invalid or unrelated chat command %s', text => {
        expect(chatCommand(text)).toBeUndefined();
    });
    it('keeps player names and maps one-based picks to the game API', () => {
        expect(chatCommand(' !SCAM new Faith Fan ')).toEqual({ type: 'new', player: 'Faith Fan' });
        expect(chatCommand('!scam pick 12')).toEqual({ type: 'pick', index: 11 });
        expect(chatCommand('!scam')).toEqual({ type: 'spin' });
        expect(chatCommand('!scam no')).toEqual({ type: 'boundary', value: false });
        expect(chatCommand('!scam demo 0')).toEqual({ type: 'demo', mode: 0 });
    });
    it('rejects malformed remote actions', () => {
        for (const command of [null, { type: 'bonus', amount: '5' }, { type: 'encore', value: 'yes' }, { type: 'eval', source: 'evil' }, { type: 'pick', index: 1.5 }]) expect(readCommand(command)).toBeUndefined();
    });
    it('does not spin while paused and resumes through the same game API', () => {
        const mount = { spin: vi.fn(), scam: { pause: vi.fn(), newRound: vi.fn() } } as unknown as MountHandle;
        let paused = executeCommand(mount, { type: 'pause' }, false);
        executeCommand(mount, { type: 'spin' }, paused); expect(mount.spin).not.toHaveBeenCalled();
        paused = executeCommand(mount, { type: 'resume' }, paused);
        executeCommand(mount, { type: 'spin' }, paused); expect(mount.spin).toHaveBeenCalledOnce();
    });
});
