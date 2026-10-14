import { afterEach, describe, expect, it, vi } from 'vitest';
import { channelName, connectTwitch, parseLine, permittedCommand } from '../src/browser/twitch.js';

const stamp = 1800000000000;
function chat(nick: string, extra = '', message = '!scam spin') {
    return parseLine('@id=message-1;room-id=10;user-id=20;tmi-sent-ts=' + stamp + ';mod=0' + extra + ' :' + nick + '!' + nick + '@' + nick + '.tmi.twitch.tv PRIVMSG #faith :' + message)!;
}
describe('Twitch command permissions', () => {
    it('accepts channel names and Twitch links only', () => {
        expect(channelName('https://www.twitch.tv/Faith/')).toBe('faith');
        expect(channelName('#Faith')).toBe('faith');
        expect(channelName('https://evil.example/faith')).toBeUndefined();
        expect(channelName('faith\r\nPRIVMSG #other')).toBeUndefined();
    });
    it('accepts the owner but ignores ordinary viewers and moderators by default', () => {
        expect(permittedCommand(chat('faith'), 'faith', false, stamp)).toEqual({ type: 'spin' });
        expect(permittedCommand(chat('viewer'), 'faith', true, stamp)).toBeUndefined();
        expect(permittedCommand(chat('moderator', ';mod=1'), 'faith', false, stamp)).toBeUndefined();
        expect(permittedCommand(chat('moderator', ';mod=1'), 'faith', true, stamp)).toEqual({ type: 'spin' });
    });
    it('rejects shared-chat copies, wrong channels and stale messages', () => {
        expect(permittedCommand(chat('faith', ';source-room-id=99'), 'faith', false, stamp)).toBeUndefined();
        expect(permittedCommand(chat('faith'), 'other', false, stamp)).toBeUndefined();
        expect(permittedCommand(chat('faith'), 'faith', false, stamp + 31000)).toBeUndefined();
    });
    it('parses keepalive traffic without interpreting it as a command', () => {
        expect(parseLine('PING :tmi.twitch.tv')).toMatchObject({ command: 'PING', text: 'tmi.twitch.tv' });
        expect(parseLine(':tmi.twitch.tv 001 guest :Welcome')).toMatchObject({ command: '001', params: 'guest' });
    });
});

class FakeSocket {
    static OPEN = 1; static instances: FakeSocket[] = [];
    readyState = 1; sent: string[] = [];
    onopen: (() => void) | null = null; onmessage: ((event: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null; onerror: (() => void) | null = null;
    constructor(public url: string) { FakeSocket.instances.push(this); }
    send(text: string) { this.sent.push(text); }
    close() { this.readyState = 3; this.onclose?.(); }
    receive(data: string) { this.onmessage?.({ data }); }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); FakeSocket.instances = []; });
it('reads fragmented chat, ignores duplicates, reconnects, and never posts a chat message', () => {
    vi.useFakeTimers(); vi.setSystemTime(stamp); vi.stubGlobal('WebSocket', FakeSocket);
    const act = vi.fn(), status = vi.fn();
    const connection = connectTwitch('faith', false, act, status), ws = FakeSocket.instances[0]!;
    ws.onopen?.(); ws.receive(':tmi.twitch.tv 001 guest :Welcome\r\n');
    ws.receive('@room-id=10 :tmi.twitch.tv ROOMSTATE #faith\r\n');
    const raw = '@id=a;room-id=10;user-id=10;tmi-sent-ts=' + stamp + ' :faith!faith@faith.tmi.twitch.tv PRIVMSG #faith :!scam spin\r\n';
    ws.receive(raw.slice(0, 30)); expect(act).not.toHaveBeenCalled();
    ws.receive(raw.slice(30)); ws.receive(raw); expect(act).toHaveBeenCalledOnce();
    ws.receive('PING :tmi.twitch.tv\r\n'); expect(ws.sent).toContain('PONG :tmi.twitch.tv\r\n');
    expect(ws.sent.some(s => s.startsWith('PRIVMSG'))).toBe(false);
    ws.close(); vi.advanceTimersByTime(1000); expect(FakeSocket.instances).toHaveLength(2);
    connection.dispose(); vi.advanceTimersByTime(60000); expect(FakeSocket.instances).toHaveLength(2);
});
