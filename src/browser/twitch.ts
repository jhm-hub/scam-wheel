import { chatCommand, RecentIds, type BrowserCommand } from './protocol.js';

export function channelName(value: string): string | undefined {
    let name = value.trim().toLowerCase();
    if (/^https?:\/\//.test(name)) {
        try { const url = new URL(name); if (!['twitch.tv', 'www.twitch.tv'].includes(url.hostname)) return; name = url.pathname.replace(/^\//, '').replace(/\/$/, ''); } catch { return; }
    }
    name = name.replace(/^#/, '');
    return /^[a-z0-9_]{1,25}$/.test(name) ? name : undefined;
}
export interface ChatLine { command: string; params: string; text: string; nick: string; tags: Record<string, string> }
export function parseLine(line: string): ChatLine | undefined {
    const match = /^(?:@([^ ]+) )?(?::([^ ]+) )?([A-Z0-9]+)(?: ([^:]*?))?(?: :([\s\S]*))?$/.exec(line);
    if (!match) return;
    const tags: Record<string, string> = {};
    for (const part of (match[1] ?? '').split(';')) {
        const at = part.indexOf('=');
        if (at > 0) tags[part.slice(0, at)] = part.slice(at + 1).replace(/\\([snr:])/g, (_, c: string) => ({ s: ' ', n: '\n', r: '\r', ':': ';' }[c]!)).replace(/\\\\/g, '\\');
    }
    return { command: match[3]!, params: (match[4] ?? '').trim(), text: match[5] ?? '', nick: (match[2] ?? '').split('!')[0]!.toLowerCase(), tags };
}
export function permittedCommand(line: ChatLine, channel: string, moderators: boolean, now = Date.now()): BrowserCommand | undefined {
    if (line.command !== 'PRIVMSG' || line.params !== '#' + channel) return;
    const source = line.tags['source-room-id'];
    if (source && source !== line.tags['room-id']) return;
    const timestamp = Number(line.tags['tmi-sent-ts']);
    if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > 30000) return;
    if (line.nick !== channel && !(moderators && line.tags.mod === '1')) return;
    return chatCommand(line.text);
}

export function connectTwitch(channel: string, moderators: boolean, command: (c: BrowserCommand) => void, status: (text: string) => void) {
    let socket: WebSocket | undefined, disposed = false, attempts = 0, buffer = '', joined = false, lastTraffic = Date.now();
    let retry: ReturnType<typeof setTimeout> | undefined;
    const seen = new RecentIds();
    const nickname = 'justinfan' + crypto.getRandomValues(new Uint32Array(1))[0];
    function schedule() {
        if (disposed || retry) return;
        status('Twitch disconnected - retrying');
        retry = setTimeout(() => { retry = undefined; open(); }, Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)));
    }
    function open() {
        if (disposed) return;
        buffer = ''; joined = false; lastTraffic = Date.now(); status('Connecting to Twitch');
        const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443'); socket = ws;
        ws.onopen = () => {
            ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands\r\n');
            ws.send('PASS SCHMOOPIIE\r\n');
            ws.send('NICK ' + nickname + '\r\n');
        };
        ws.onmessage = event => {
            if (disposed || socket !== ws || typeof event.data !== 'string') return;
            lastTraffic = Date.now(); buffer += event.data;
            if (buffer.length > 100000) { ws.close(); return; }
            const lines = buffer.split('\r\n'); buffer = lines.pop()!;
            for (const raw of lines) {
                const line = parseLine(raw); if (!line) continue;
                if (line.command === 'PING') ws.send('PONG :' + line.text + '\r\n');
                if (line.command === '001') ws.send('JOIN #' + channel + '\r\n');
                if (line.command === 'ROOMSTATE' || (line.command === '366' && line.params.includes('#' + channel))) {
                    joined = true; attempts = 0; status('Twitch connected: ' + channel);
                }
                if (line.command === 'RECONNECT') ws.close();
                if (!joined) continue;
                const action = permittedCommand(line, channel, moderators);
                if (action && seen.accept(line.tags.id)) command(action);
            }
        };
        ws.onclose = schedule;
        ws.onerror = () => ws.close();
    }
    const heartbeat = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
            if (Date.now() - lastTraffic > 90000) socket.close();
            else socket.send('PING :scam-wheel\r\n');
        }
    }, 30000);
    open();
    return { dispose() { disposed = true; clearInterval(heartbeat); if (retry) clearTimeout(retry); if (socket) { socket.onclose = null; socket.close(); } } };
}
