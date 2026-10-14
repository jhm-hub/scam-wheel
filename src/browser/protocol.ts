import { MODES } from '../scam/catalog.js';
import type { MountHandle } from '../app.js';

export type BrowserCommand =
    | { type: 'spin' | 'finish' | 'reveal' | 'continue' | 'pause' | 'resume' }
    | { type: 'new'; player: string }
    | { type: 'bonus'; amount: number }
    | { type: 'demo'; mode: number }
    | { type: 'pick'; index: number }
    | { type: 'boundary' | 'encore' | 'mute'; value: boolean };

export function readCommand(raw: unknown): BrowserCommand | undefined {
    if (!raw || typeof raw !== 'object') return;
    const c = raw as Record<string, unknown>;
    if (['spin', 'finish', 'reveal', 'continue', 'pause', 'resume'].includes(String(c.type))) return { type: c.type } as BrowserCommand;
    if (c.type === 'new' && typeof c.player === 'string') return { type: 'new', player: c.player.slice(0, 40) };
    if (c.type === 'bonus' && Number.isInteger(c.amount) && Math.abs(c.amount as number) <= 60) return { type: 'bonus', amount: c.amount as number };
    if (c.type === 'demo' && MODES.some(m => m.id === c.mode)) return { type: 'demo', mode: c.mode as number };
    if (c.type === 'pick' && Number.isInteger(c.index) && (c.index as number) >= 0 && (c.index as number) < 12) return { type: 'pick', index: c.index as number };
    if (['boundary', 'encore', 'mute'].includes(String(c.type)) && typeof c.value === 'boolean') return { type: c.type, value: c.value } as BrowserCommand;
}

export function chatCommand(text: string): BrowserCommand | undefined {
    const match = /^!scam(?:\s+(\S+)(?:\s+([\s\S]*))?)?\s*$/i.exec(text.trim());
    if (!match) return;
    const sub = (match[1] ?? 'spin').toLowerCase(), arg = match[2]?.trim() ?? '';
    if (sub === 'new') return readCommand({ type: 'new', player: arg });
    if (['spin', 'finish', 'reveal', 'continue', 'pause', 'resume'].includes(sub) && !arg) return readCommand({ type: sub });
    if (['yes', 'no'].includes(sub) && !arg) return { type: 'boundary', value: sub === 'yes' };
    if (['encore', 'bank'].includes(sub) && !arg) return { type: 'encore', value: sub === 'encore' };
    if (!/^-?\d+$/.test(arg)) return;
    if (sub === 'bonus') return readCommand({ type: 'bonus', amount: Number(arg) });
    if (sub === 'demo') return readCommand({ type: 'demo', mode: Number(arg) });
    if (sub === 'pick') return readCommand({ type: 'pick', index: Number(arg) - 1 });
}

export function executeCommand(mount: MountHandle, command: BrowserCommand, paused: boolean): boolean {
    const api = mount.scam;
    if (!api) return paused;
    if (command.type === 'pause' || command.type === 'resume') { api.pause(command.type === 'pause'); return command.type === 'pause'; }
    if (command.type === 'mute') { api.mute(command.value); return paused; }
    if (paused) return paused;
    switch (command.type) {
        case 'spin': mount.spin(); break;
        case 'new': api.newRound(command.player); break;
        case 'finish': api.finish(); break;
        case 'bonus': api.bonus(command.amount); break;
        case 'demo': api.showcase(command.mode); break;
        case 'pick': api.pick(command.index); break;
        case 'boundary': api.confirmBoundary(command.value); break;
        case 'reveal': api.revealPicks(); break;
        case 'continue': api.continue(); break;
        case 'encore': api.encore(command.value); break;
    }
    return paused;
}

export function randomKey(): string { return [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join(''); }
export function validKey(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }
function keyBytes(key: string): Uint8Array<ArrayBuffer> { return Uint8Array.from(key.match(/../g)!, n => Number.parseInt(n, 16)); }
export async function roomId(key: string): Promise<string> {
    if (!validKey(key)) throw new Error('Invalid room key');
    const digest = await crypto.subtle.digest('SHA-256', keyBytes(key));
    return 'scam-' + [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
}
export async function proof(key: string, challenge: string): Promise<string> {
    const imported = await crypto.subtle.importKey('raw', keyBytes(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', imported, new TextEncoder().encode(challenge));
    return [...new Uint8Array(signature)].map(n => n.toString(16).padStart(2, '0')).join('');
}
export async function verifyProof(key: string, challenge: string, signature: unknown): Promise<boolean> {
    if (!validKey(signature)) return false;
    const imported = await crypto.subtle.importKey('raw', keyBytes(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return crypto.subtle.verify('HMAC', imported, keyBytes(signature), new TextEncoder().encode(challenge));
}

export class RecentIds {
    private ids = new Set<string>();
    accept(id: unknown): id is string {
        if (typeof id !== 'string' || !id || id.length > 128 || this.ids.has(id)) return false;
        this.ids.add(id);
        if (this.ids.size > 500) this.ids.delete(this.ids.values().next().value!);
        return true;
    }
}
