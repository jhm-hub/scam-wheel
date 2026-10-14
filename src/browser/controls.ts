import type { FieldData } from '../se/types.js';
import { defaultScamConfig, parseScamConfig } from '../scam/config.js';
import { MODES } from '../scam/catalog.js';
import { readPacket, type LivePacket } from '../scam/live-shared.js';
import { connectRoom } from './room.js';
import { randomKey, validKey, type BrowserCommand } from './protocol.js';
import { channelName } from './twitch.js';

const doc = document;
function readSaved(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function save(key: string, value: string) { try { localStorage.setItem(key, value); } catch { } }
const supplied = new URLSearchParams(location.hash.slice(1)).get('room'), retained = readSaved('scam-browser-room-v1');
const key = validKey(supplied) ? supplied : validKey(retained) ? retained : randomKey();
save('scam-browser-room-v1', key);
history.replaceState(null, '', location.pathname + location.search + '#room=' + key);
const viewerUrl = new URL('browser-wheel.html', location.href); viewerUrl.hash = 'room=' + key;
const settingsUrl = new URL('./', location.href);
const prefsKey = 'scam-browser-preferences-v1:' + key;
let prefs: { channel: string; moderators: boolean } = { channel: '', moderators: false };
try { prefs = { ...prefs, ...JSON.parse(readSaved(prefsKey) ?? '{}') }; } catch { }
let latest: LivePacket | undefined, lastSeen = 0, linked = false, lastAction = 0, muted = false, firstState = true, selectedCount = 0, pendingChat = false;

function node<K extends keyof HTMLElementTagNameMap>(tag: K, parent: HTMLElement, text = '', cls = ''): HTMLElementTagNameMap[K] {
    const element = doc.createElement(tag); element.className = cls; element.textContent = text; parent.append(element); return element;
}
function button(parent: HTMLElement, text: string, click: () => void, cls = '') { const b = node('button', parent, text, cls); b.type = 'button'; b.onclick = click; return b; }
function field(parent: HTMLElement, label: string, value = '') { const wrap = node('label', parent, label, 'field'); const input = node('input', wrap); input.value = value; return input; }
const main = node('main', doc.body, '', 'control-room');
const header = node('header', main);
node('p', header, 'FAITH / PRIVATE CONTROLS', 'eyebrow');
node('h1', header, 'Scam Wheel');
node('p', header, 'Run the wheel here. Only the wheel goes on stream.', 'intro');
const badge = node('p', header, 'Connecting...', 'connection'); badge.setAttribute('role', 'status');

const setup = node('details', main, '', 'panel setup'); setup.open = true;
node('summary', setup, 'Put the wheel on stream');
node('p', setup, 'Add a Browser Source in Streamlabs or OBS. Paste this link and use 800 x 800.');
const source = field(setup, 'Wheel link - keep private', viewerUrl.href); source.readOnly = true;
const sourceButtons = node('div', setup, '', 'button-row');
button(sourceButtons, 'Copy wheel link', () => copy(viewerUrl.href, source));
button(sourceButtons, 'Open wheel to test', () => window.open(viewerUrl.href, '_blank', 'noopener'), 'secondary');
button(sourceButtons, 'Copy private controls link', () => copy(location.href), 'secondary');
node('p', setup, 'Use one live wheel window. Close the test wheel before opening it in Streamlabs. Reuse the same source across scenes and turn off automatic refresh/shutdown. Refreshing the wheel starts a new round.', 'hint');
const notice = node('p', header, '', 'notice'); notice.setAttribute('role', 'status');

const play = node('section', main, '', 'panel play');
node('h2', play, 'Live round');
const roundName = node('p', play, 'Waiting for the wheel', 'round-name');
const stats = node('div', play, '', 'stats');
function stat(label: string) { const cell = node('div', stats); const title = node('span', cell, label); const value = node('strong', cell, '--'); return { title, value }; }
const cash = stat('Cash'), bank = stat('Multiplier'), spins = stat('Spins left');
const message = node('p', play, 'Open the wheel link or add it as a Browser Source to connect.', 'round-message');
const player = field(play, 'Player name (optional)'); player.maxLength = 40;
const spin = button(play, 'SPIN', () => command({ type: 'spin' }), 'primary spin');
const actions = node('div', play, '', 'button-row');
const fresh = button(actions, 'New round', () => command({ type: 'new', player: player.value }));
const finish = button(actions, 'Finish round', () => command({ type: 'finish' }), 'secondary');
const minus = button(actions, '- 1 spin', () => command({ type: 'bonus', amount: -1 }), 'secondary');
const plus = button(actions, '+ 1 spin', () => command({ type: 'bonus', amount: 1 }), 'secondary');
const pause = button(actions, 'Pause', () => command({ type: latest?.totals.paused ? 'resume' : 'pause' }), 'secondary');
const sound = button(actions, 'Sound on', () => command({ type: 'mute', value: !muted }), 'secondary');
const context = node('div', play, '', 'context');
const boundaries = node('div', context, '', 'button-row');
const both = button(boundaries, 'Count both prizes', () => command({ type: 'boundary', value: true }));
const pointer = button(boundaries, 'Pointer prize only', () => command({ type: 'boundary', value: false }), 'secondary');
const picksBox = node('div', context); node('p', picksBox, 'Choose six secret spaces, then reveal.');
const pickGrid = node('div', picksBox, '', 'pick-grid');
const picks = Array.from({ length: 12 }, (_, i) => button(pickGrid, String(i + 1), () => command({ type: 'pick', index: i }), 'pick'));
const reveal = button(picksBox, 'Reveal picks', () => command({ type: 'reveal' }));
const continueButton = button(context, 'Continue', () => command({ type: 'continue' }));
const encoreButtons = node('div', context, '', 'button-row');
const encore = button(encoreButtons, 'Take the encore', () => command({ type: 'encore', value: true }));
const exit = button(encoreButtons, 'Bank it', () => command({ type: 'encore', value: false }), 'secondary');
const final = node('p', play, '', 'final');

const chatPanel = node('section', main, '', 'panel');
node('h2', chatPanel, 'Twitch commands');
node('p', chatPanel, 'Enter Faith\'s channel name. The wheel listens to chat without posting messages or needing a login.');
const channelInput = field(chatPanel, 'Twitch channel name or link', prefs.channel); channelInput.autocomplete = 'off';
const modLabel = node('label', chatPanel, '', 'check'); const mods = node('input', modLabel); mods.type = 'checkbox'; mods.checked = prefs.moderators; node('span', modLabel, 'Let channel moderators use commands too');
const chatStatus = node('p', chatPanel, 'Twitch not connected', 'hint');
button(chatPanel, 'Connect Twitch chat', () => {
    const name = channelName(channelInput.value);
    if (!name) { chatStatus.textContent = 'Enter a Twitch channel name or twitch.tv channel link.'; return; }
    prefs = { channel: name, moderators: mods.checked }; save(prefsKey, JSON.stringify(prefs));
    channelInput.value = name;
    const sent = link.send({ type: 'chat', id: crypto.randomUUID(), ...prefs }); pendingChat = !sent;
    chatStatus.textContent = sent ? 'Connecting to Twitch...' : 'Saved. Open the wheel link to connect.';
});
button(chatPanel, 'Disconnect chat', () => {
    prefs = { channel: '', moderators: false }; save(prefsKey, JSON.stringify(prefs)); channelInput.value = ''; mods.checked = false;
    pendingChat = !link.send({ type: 'chat', id: crypto.randomUUID(), ...prefs }); chatStatus.textContent = 'Twitch disconnected';
}, 'secondary');
node('p', chatPanel, '!scam spin  /  !scam new Name  /  !scam finish', 'commands');
const more = node('details', chatPanel); node('summary', more, 'All commands');
node('p', more, '!scam bonus 1, !scam pause, !scam resume, !scam demo ID, !scam pick 1, !scam reveal, !scam yes, !scam no, !scam continue, !scam encore, !scam bank. Only Faith can control it unless moderators are enabled.', 'hint');

const settings = node('section', main, '', 'panel');
node('h2', settings, 'Prizes & game modes');
node('p', settings, 'Use the usual Settings page to edit amounts, colors, mode names and the random pool. Save there, then apply them here between rounds.');
const settingsLink = node('a', settings, 'Open settings & demos', 'button-link'); settingsLink.href = settingsUrl.href; settingsLink.target = '_blank'; settingsLink.rel = 'noopener';
const apply = button(settings, 'Apply saved settings & start fresh', () => sendConfig(true), 'secondary');
const demoLabel = node('label', settings, 'Demo a scam', 'field'); const demo = node('select', demoLabel);
function refreshModeNames() {
    const names = parseScamConfig(savedFields().scamConfig).modes;
    for (const mode of MODES) {
        let option = demo.querySelector<HTMLOptionElement>('option[value="' + mode.id + '"]');
        if (!option) { option = node('option', demo); option.value = String(mode.id); }
        option.textContent = mode.id + ' - ' + (names.find(m => m.id === mode.id)?.name ?? mode.name);
    }
}
refreshModeNames();
const demoButton = button(settings, 'Start demo', () => command({ type: 'demo', mode: Number(demo.value) }));
const footer = node('footer', main, 'Keep both links private. Internet is needed to pair the pages and receive Twitch chat. The existing StreamElements installer is still available on the setup page.');
footer.className = 'hint';

function savedFields(): FieldData {
    let fields: FieldData = { gameMode: 'scam', colorScheme: 'auto', colorPrimary: '#d994bb', colorSecondary: '#c1a9e6', spinDuration: 6.2, volumeWin: 55, scamConfig: JSON.stringify(defaultScamConfig()) };
    try {
        const path = new URL('scam.html', location.href).pathname;
        const saved = readSaved('faith-scam-wheel/native/v1:' + path) ?? readSaved('faith-scam-wheel/native/v1');
        if (saved) fields = { ...fields, ...JSON.parse(saved) };
    } catch { }
    fields.scamConfig = JSON.stringify(parseScamConfig(fields.scamConfig));
    fields.gameMode = 'scam'; fields.importConfig = '';
    return fields;
}
function sendConfig(reset: boolean) {
    refreshModeNames();
    const sent = link.send({ type: 'config', id: crypto.randomUUID(), fields: savedFields(), reset, ...prefs });
    notice.textContent = sent ? (reset ? 'Applying settings to the live wheel...' : 'Connecting your wheel...') : 'Open the wheel link first. Settings are ready for it.';
}
async function copy(value: string, input?: HTMLInputElement) {
    try { await navigator.clipboard.writeText(value); notice.textContent = 'Link copied.'; }
    catch { if (input) { input.focus(); input.select(); } notice.textContent = 'Copy the link from the selected field or address bar.'; }
}
function connected() { return linked && Date.now() - lastSeen < 5000 && !!latest; }
function command(value: BrowserCommand) {
    if (!connected()) { notice.textContent = 'The wheel is offline. Reconnect it before sending controls.'; return; }
    if (link.send({ type: 'action', id: crypto.randomUUID(), command: value })) { lastAction = Date.now(); render(); }
}
function render() {
    const online = connected(), s = latest?.totals, available = online && !!s && !s.busy && !s.paused && Date.now() - lastAction > 200;
    badge.classList.toggle('online', online);
    if (online) badge.textContent = 'LIVE WHEEL CONNECTED';
    else if (latest) badge.textContent = 'WHEEL OFFLINE - last received totals';
    spin.disabled = !available || s!.phase !== 'ready' || (s!.remaining === 0 && s!.mode !== 22 && !(s!.mode === undefined && s!.regularCompleted >= 2));
    spin.textContent = s?.busy ? 'IN PLAY' : s?.mode === undefined && (s?.regularCompleted ?? 0) >= 2 ? 'REVEAL THE SCAM' : 'SPIN';
    fresh.disabled = !online || !!s?.paused; finish.disabled = !available || s!.phase !== 'ready';
    minus.disabled = plus.disabled = !available || ['picking', 'finished'].includes(s!.phase) || s!.mode === 21 || s!.mode === 25;
    minus.textContent = s?.mode === 22 ? '- 1 sec' : '- 1 spin'; plus.textContent = s?.mode === 22 ? '+ 1 sec' : '+ 1 spin';
    pause.disabled = sound.disabled = !online; pause.textContent = s?.paused ? 'Resume' : 'Pause'; sound.textContent = muted ? 'Sound off' : 'Sound on';
    apply.disabled = demoButton.disabled = !available;
    boundaries.hidden = s?.phase !== 'boundary'; picksBox.hidden = s?.phase !== 'picking'; continueButton.hidden = s?.phase !== 'rainbow'; encoreButtons.hidden = s?.phase !== 'choice';
    for (const b of [both, pointer, continueButton, encore, exit, ...picks]) b.disabled = !available;
    reveal.disabled = !available || selectedCount !== 6;
    if (!s) return;
    roundName.textContent = (s.player ? s.player + ' / ' : '') + s.name;
    cash.value.textContent = '$' + s.cash.toLocaleString(undefined, { maximumFractionDigits: 2 }); bank.value.textContent = 'x' + (s.bank || 1);
    spins.title.textContent = s.mode === 22 ? 'Seconds left' : 'Spins left'; spins.value.textContent = String(s.mode === 22 ? s.seconds : s.remaining);
    message.textContent = s.message;
    final.hidden = s.final === undefined; final.textContent = s.final === undefined ? '' : 'Final total: $' + s.final.toLocaleString();
}
const link = connectRoom({ role: 'controls', key, status(value) {
    linked = value === 'connected';
    if (!linked) badge.textContent = value === 'connecting' ? 'Connecting...' : 'Waiting for the wheel - open its link';
    render();
}, ready() { link.send({ type: 'hello' }); }, message(raw) {
    if (!raw || typeof raw !== 'object') return;
    const data = raw as Record<string, unknown>;
    if (data.type === 'needs-config') sendConfig(false);
    if (data.type === 'notice' && typeof data.text === 'string') notice.textContent = data.text;
    if (data.type !== 'state') return;
    const packet = readPacket(data.packet); if (!packet) return;
    if (latest?.session === packet.session && latest.sequence >= packet.sequence) return;
    latest = packet; lastSeen = Date.now(); linked = true; muted = data.muted === true;
    if (typeof data.chatStatus === 'string') chatStatus.textContent = data.chatStatus;
    if (pendingChat) { pendingChat = !link.send({ type: 'chat', id: crypto.randomUUID(), ...prefs }); }
    else if (firstState) {
        firstState = false; setup.open = false; notice.textContent = '';
        prefs = { channel: typeof data.channel === 'string' ? data.channel : '', moderators: data.moderators === true };
        channelInput.value = prefs.channel; mods.checked = prefs.moderators; save(prefsKey, JSON.stringify(prefs));
    }
    const selected = Array.isArray(data.picks) ? data.picks : [];
    picks.forEach((b, i) => { b.classList.toggle('selected', selected.includes(i)); b.setAttribute('aria-pressed', String(selected.includes(i))); });
    selectedCount = selected.length; reveal.textContent = 'Reveal ' + selectedCount + '/6';
    render();
} });
render();
const timer = setInterval(render, 500);
window.addEventListener('pagehide', () => { clearInterval(timer); link.dispose(); });
