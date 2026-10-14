import type { MountHandle } from '../app.js';
import type { FieldData } from '../se/types.js';
import { liveTotals } from '../scam/live-shared.js';
import { connectRoom } from './room.js';
import { RecentIds, executeCommand, readCommand, validKey } from './protocol.js';
import { channelName, connectTwitch } from './twitch.js';
declare const Wheel: typeof import('../app.js');

const key = new URLSearchParams(location.hash.slice(1)).get('room');
if (validKey(key)) start(key);

function start(key: string) {
    const storageKey = 'scam-browser-viewer-v1:' + key;
    let mount: MountHandle | undefined, paused = false, fields: FieldData | undefined, chat: ReturnType<typeof connectTwitch> | undefined;
    let channel = '', moderators = false, chatStatus = 'Twitch not connected', session = crypto.randomUUID();
    const seen = new RecentIds();
    const link = connectRoom({ role: 'viewer', key, status(value) { document.body.dataset.connection = value; }, ready() {
        if (!mount) {
            try { const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null'); if (saved) configure(saved, false); } catch { }
        }
        if (mount) sendState(); else link.send({ type: 'needs-config' });
    }, message(raw) {
        if (!raw || typeof raw !== 'object') return;
        const message = raw as Record<string, unknown>;
        if (message.type === 'hello') { if (mount) sendState(); else link.send({ type: 'needs-config' }); }
        if (message.type === 'config' && seen.accept(message.id)) {
            if (mount?.scam?.snapshot().busy) { link.send({ type: 'notice', text: 'Wait for the current animation to finish before applying settings.' }); return; }
            if (!mount || message.reset === true) configure(message, true);
            sendState();
        }
        if (message.type === 'chat' && seen.accept(message.id)) { configureChat(message); persist(); sendState(); }
        if (message.type === 'action' && mount && seen.accept(message.id)) {
            const action = readCommand(message.command);
            if (action) paused = executeCommand(mount, action, paused);
            sendState();
        }
    } });
    function persist() { try { localStorage.setItem(storageKey, JSON.stringify({ fields, channel, moderators })); } catch { } }
    function configureChat(raw: Record<string, unknown>) {
        const next = typeof raw.channel === 'string' ? channelName(raw.channel) ?? '' : '';
        const allowMods = raw.moderators === true;
        if (next === channel && allowMods === moderators && chat) return;
        channel = next; moderators = allowMods; chat?.dispose(); chat = undefined;
        chatStatus = channel ? 'Connecting to Twitch' : 'Twitch not connected';
        if (channel) chat = connectTwitch(channel, moderators, action => {
            if (mount) { paused = executeCommand(mount, action, paused); sendState(); }
        }, text => { chatStatus = text; sendState(); });
    }
    function configure(raw: Record<string, unknown>, save: boolean) {
        if (!raw.fields || typeof raw.fields !== 'object' || Array.isArray(raw.fields)) return;
        fields = { ...raw.fields, gameMode: 'scam', importConfig: '', spinCommand: '!scam', wheelCommand: '!scam' };
        mount?.dispose(); paused = false; session = crypto.randomUUID();
        const result = Wheel.mountWidget(document, { fieldData: fields });
        if ('error' in result) { mount = undefined; link.send({ type: 'notice', text: 'Settings could not be loaded. Check the settings page.' }); return; }
        mount = result;
        mount.root.addEventListener('scamchange', sendState);
        configureChat(raw); if (save) persist();
    }
    let sequence = 0;
    function sendState() {
        if (!mount?.scam) return;
        const s = mount.scam.snapshot();
        link.send({ type: 'state', packet: { version: 1, session, sequence: ++sequence, updatedAt: Date.now(), totals: liveTotals(s, paused) }, picks: s.picks, muted: s.muted, chatStatus, channel, moderators });
    }
    const heartbeat = setInterval(sendState, 1000);
    window.addEventListener('pagehide', () => { clearInterval(heartbeat); chat?.dispose(); link.dispose(); mount?.dispose(); });
}
