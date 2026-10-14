import type { MountHandle } from '../app.js';
import type { ScamConfig } from './config.js';
import type { ScamSnapshot } from './widget.js';
import type { FieldData } from '../se/types.js';
declare const Wheel: typeof import('../app.js');
declare global {
    interface Window {
        FAITH_ASSETS: {
            wheel: string;
            desk: string;
            css: string;
        };
        FAITH_SETTINGS?: FieldData;
        FAITH_STREAM?: boolean;
        FAITH_HOSTED_URL?: string | null;
        faithWheel?: MountHandle;
    }
}
const doc = document, stream = window.FAITH_STREAM === true;
const settingsPath = location.pathname.endsWith('/') ? location.pathname + 'scam.html' : location.pathname.replace(/\/index\.html$/, '/scam.html');
const STORAGE = 'faith-scam-wheel/native/v1:' + settingsPath;
let base: FieldData = { gameMode: 'scam', colorScheme: 'auto', colorPrimary: '#d994bb', colorSecondary: '#c1a9e6', fontFamily: '', spinDuration: 6.2, disableSound: false, volumeWin: 55, volumeTick: 35, enableCommands: true, hubMode: 'text', hubText: 'SCAM\nWHEEL', hubSize: 30, ...window.FAITH_SETTINGS };
try {
    const saved = localStorage.getItem(STORAGE) ?? (!window.FAITH_SETTINGS ? localStorage.getItem('faith-scam-wheel/native/v1') : null);
    if (saved)
        base = { ...base, ...JSON.parse(saved) };
}
catch { }
let settings = Wheel.parseScamConfig(base.scamConfig), mount: MountHandle | undefined, tab = 'round';
const shell = doc.createElement('aside');
shell.id = 'faith-desk';
doc.body.append(shell);
doc.body.classList.toggle('stream-view', stream);
if (stream)
    doc.body.classList.add('desk-hidden');
function make<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '', parent: HTMLElement = shell): HTMLElementTagNameMap[K] { const e = doc.createElement(tag); e.className = cls; e.textContent = text; parent.append(e); return e; }
const head = make('div', 'desk-head');
make('div', 'desk-eyebrow', 'FAITH / STREAM GAMES', head);
make('h1', '', 'Scam Wheel', head);
make('p', '', 'The third spin has other plans.', head);
const tabs = make('nav', 'desk-tabs');
const panels = new Map<string, HTMLElement>();
for (const [id, label] of [['round', 'Play'], ['showcase', 'Showcase'], ['settings', 'Settings'], ['stream', 'Stream setup']]) {
    const b = make('button', '', label, tabs);
    b.dataset.tab = id;
    b.onclick = () => selectTab(id!);
    const p = make('section', 'desk-panel');
    p.dataset.panel = id;
    panels.set(id!, p);
}
const round = panels.get('round')!, showcase = panels.get('showcase')!, editor = panels.get('settings')!;
function button(parent: HTMLElement, text: string, action: () => void, cls = '') { const b = make('button', cls, text, parent); b.type = 'button'; b.onclick = action; return b; }
function input(parent: HTMLElement, label: string, value: string, type = 'text') { const wrap = make('label', 'field', label, parent), e = make('input', '', '', wrap); e.type = type; e.value = value; return e; }
const player = input(round, 'PLAYER NAME', settings.player);
player.placeholder = 'Optional';
player.maxLength = 40;
const start = button(round, 'New round', () => mount?.scam?.newRound(player.value), 'secondary');
const spin = button(round, 'SPIN', () => mount?.spin(), 'primary spin-button');
const row = make('div', 'button-row', '', round);
const minus = button(row, '- 1', () => mount?.scam?.bonus(-1));
const plus = button(row, '+ 1', () => mount?.scam?.bonus(1));
const finish = button(row, 'Finish round', () => mount?.scam?.finish());
const action = make('div', 'context-actions', '', round);
const status = make('div', 'desk-status', 'Ready when you are.', round);
status.setAttribute('aria-live', 'polite');
const summary = make('div', 'desk-summary', '', round);
const hostStats = make('dl', 'host-stats', '', round);
hostStats.setAttribute('aria-label', 'Local preview totals');
make('p', 'desk-hint', 'These totals belong to this preview. For the live OBS round, use the private totals panel from Stream setup.', round);
function hostStat(label: string) { const group = make('div', 'host-stat', '', hostStats); const title = make('dt', '', label, group); const value = make('dd', '', '', group); return { title, value }; }
const hostCash = hostStat('Cash'), hostBank = hostStat('Multiplier'), hostSpins = hostStat('Spins left');
function refreshHostStats(s: ScamSnapshot) {
    hostCash.value.textContent = '$' + s.cash;
    hostBank.value.textContent = 'x' + (s.bank || 1);
    hostSpins.title.textContent = s.mode === 22 ? 'Seconds left' : 'Spins left';
    hostSpins.value.textContent = String(s.mode === 22 ? s.seconds : s.remaining);
}
make('p', 'desk-hint', 'Space: spin  /  H: hide controls\nUse Finish round to apply the multiplier and reveal the final total.', round);
const demoHeader = make('div', 'section-head', '', showcase);
make('h2', '', 'Try every twist', demoHeader);
make('p', '', '25 renamed originals, plus 3 new ideas. Demos start with $50.', demoHeader);
const search = input(showcase, 'FIND A SCAM', '', 'search');
search.placeholder = 'Name or original mode';
const demos = make('div', 'demo-list', '', showcase);
function renderDemos() { demos.replaceChildren(); for (const info of Wheel.MODES) {
    const name = settings.modes.find(m => m.id === info.id)!.name;
    if (search.value && !(`${name} ${info.original}`.toLowerCase().includes(search.value.toLowerCase())))
        continue;
    const item = make('div', 'demo-item', '', demos);
    item.style.setProperty('--swatch', info.colors[0]);
    make('span', 'demo-tag', info.experimental ? 'NEW IDEA - AWAITING FAITH' : 'MODE ' + String(Wheel.MODES.filter(m => !m.experimental).indexOf(info) + 1).padStart(2, '0'), item);
    make('h3', '', name, item);
    make('p', '', info.rule, item);
    const old = make('details', 'original-name', '', item);
    make('summary', '', 'Original name', old);
    make('p', '', info.original, old);
    button(item, 'Demo this scam', () => { mount?.scam?.showcase(info.id); selectTab('round'); }, 'demo-play');
} }
search.oninput = renderDemos;
make('h2', '', 'Make it hers', editor);
make('p', 'desk-hint', 'Save starts a fresh round. Names are working ideas; every name and random-pool choice is editable.', editor);
const configForm = make('form', 'settings-form', '', editor);
configForm.onsubmit = e => e.preventDefault();
const grid = make('div', 'settings-grid', '', configForm);
const cashInputs = settings.cash.map((v, i) => { const e = input(grid, 'CASH ' + (i + 1), String(v), 'number'); e.min = '0'; e.max = '100000'; e.step = '.01'; return e; });
const startInput = input(configForm, 'STARTING SPINS', String(settings.startingSpins), 'number');
startInput.min = '3';
startInput.max = '99';
startInput.step = '1';
const demoCashInput = input(configForm, 'DEMO STARTING CASH', String(settings.demoBalance), 'number');demoCashInput.min='0';demoCashInput.max='100000';
const volumeInput = input(configForm, 'SOUND LEVEL (0 - 100)', String(base.volumeWin ?? 55), 'number');volumeInput.min='0';volumeInput.max='100';
const boostInput = input(configForm, 'TIP JAR CASH BOOST', String(settings.boost), 'number');
boostInput.min = '0';
boostInput.max = '100000';
const flatInput = input(configForm, 'PRICE TAG CASH AMOUNT', String(settings.flatCash), 'number');
flatInput.min = '0';
flatInput.max = '100000';
const angelsInput = input(configForm, 'ANGEL CASH VALUES (6)', settings.angels.join(', '));
const multInput = input(configForm, 'MULTIPLIER VALUES (10)', settings.multipliers.join(', '));
const duration = input(configForm, 'SPIN LENGTH (SECONDS)', String(settings.spinSeconds), 'number');
duration.min = '4.5';
duration.max = '12';
duration.step = '.1';
const mainColor = input(configForm, 'BASE PINK', String(base.colorPrimary), 'color'), secondaryColor = input(configForm, 'BASE LILAC', String(base.colorSecondary), 'color');
let colorsDirty = false;
mainColor.oninput = secondaryColor.oninput = () => { colorsDirty = true; };
const pool = make('details', 'pool-editor', '', configForm);
make('summary', '', 'Scam names & random pool', pool);
make('p', 'desk-hint', 'Checked modes can appear on turn three. Weight 2 appears twice as often as weight 1. New ideas stay off until approved.', pool);
const modeFields = settings.modes.map(m => { const row = make('div', 'mode-setting', '', pool); const enabled = input(row, 'IN POOL', '', 'checkbox'); enabled.checked = m.enabled; const name = input(row, 'NAME', m.name); name.maxLength = 44; const weight = input(row, 'WEIGHT', String(m.weight), 'number'); weight.min = '.01'; weight.max = '100'; weight.step = '.01'; const info = Wheel.MODES.find(x => x.id === m.id)!; make('p', 'desk-hint', info.experimental ? 'NEW IDEA - enable only after Faith approves.' : 'Original: ' + info.original, row); return { id: m.id, enabled, name, weight }; });
const formError = make('p', 'form-error', '', configForm);
formError.setAttribute('role', 'alert');
button(configForm, 'Save & start fresh', () => { if (!configForm.reportValidity())
    return; const list = (value: string, n: number, min: number) => { const values = value.split(',').map(v => v.trim()); if (values.length !== n || values.some(v => !v || !Number.isFinite(Number(v)) || Number(v) < min || Number(v) > 100000))
    throw new Error('Enter ' + n + ' comma-separated numbers, each at least ' + min + '.'); return values.map(Number); }; try {
    const next: ScamConfig = { ...settings, cash: cashInputs.map(i => Number(i.value)), startingSpins: Number(startInput.value), demoBalance: Number(demoCashInput.value), boost: Number(boostInput.value), flatCash: Number(flatInput.value), angels: list(angelsInput.value, 6, 0), multipliers: list(multInput.value, 10, 1), spinSeconds: Number(duration.value), player: player.value, modes: modeFields.map(f => ({ id: f.id, name: f.name.value.trim(), enabled: f.enabled.checked, weight: Number(f.weight.value) })) };
    if (next.modes.some(m => !m.name))
        throw new Error('Give every scam a name.');
    if (!next.modes.some(m => m.enabled))
        throw new Error('Keep at least one scam in the random pool.');
    settings = next;
    if (colorsDirty)
        base = { ...base, colorScheme: 'auto', colorPrimary: mainColor.value, colorSecondary: secondaryColor.value };
    colorsDirty = false;
    base.importConfig = '';base.volumeWin=Number(volumeInput.value);
    save();
    remount();
    renderDemos();
    formError.textContent = 'Saved. New round ready.';
    selectTab('round');
}
catch (e) {
    formError.textContent = e instanceof Error ? e.message : String(e);
} }, 'primary');
const importBox = make('details', 'import-box', '', editor);
make('summary', '', 'Import Faith\'s wheel look', importBox);
make('p', 'desk-hint', 'Paste a saved config code from the supplied wheel. Applies its colors and sound level while keeping this game\'s prizes, arcade text and round center.', importBox);
const code = make('textarea', '', '', importBox);
code.placeholder = 'Wheel config code';
button(importBox, 'Apply wheel look', () => { const decoded = Wheel.decodeSharedConfig(code.value); if (!decoded) {
    formError.textContent = 'That config code could not be read.';
    return;
} const keys = ['colorScheme', 'colorPrimary', 'colorSecondary', 'colorSliceEven', 'colorSliceOdd', 'colorSliceBorder', 'colorRim', 'colorHub', 'colorHubInner', 'colorPlate', 'colorTitle', 'colorEntry', 'volumeWin', 'volumeTick', 'volumeSeam', 'disableSound', 'disableTickSound', 'disableConfetti', 'gemMatchScheme', 'gemColor']; for (const key of keys)
    if (decoded[key] !== undefined)
        base[key] = decoded[key]; mainColor.value = String(base.colorPrimary); secondaryColor.value = String(base.colorSecondary); volumeInput.value=String(base.volumeWin??55); colorsDirty = false; save(); remount(); formError.textContent = 'Wheel look applied.'; });
const files = make('div', 'file-actions', '', editor);
button(files, 'Export settings', () => download('Faith-Scam-Wheel-Settings.json', JSON.stringify({ ...base, gameMode: 'scam', spinCommand: '!scam', wheelCommand: '!scam', scamConfig: JSON.stringify(settings) }, null, 2), 'application/json'));
const fileInput = make('input', '', '', files);
fileInput.type = 'file';
fileInput.accept = '.json,application/json';
fileInput.hidden = true;
button(files, 'Import settings', () => fileInput.click());
fileInput.onchange = async () => { try {
    const f = fileInput.files?.[0];
    if (!f)
        return;
    let value = JSON.parse(await f.text());if(value.format==='faith-wheel-25'&&value.version===2&&value.config){const old=value.config;value={...base,gameMode:'scam',disableSound:old.sound===false,volumeWin:old.volume??55,scamConfig:JSON.stringify({...old,boost:old.cashBoost,flatCash:old.cashSet})};}
    if (value.gameMode !== 'scam' || typeof value.scamConfig !== 'string')
        throw new Error('Use a settings file exported from this wheel.');
    base = { ...base, ...value };
    settings = Wheel.parseScamConfig(base.scamConfig);
    save();
    cashInputs.forEach((e, i) => e.value = String(settings.cash[i]));
    startInput.value = String(settings.startingSpins);demoCashInput.value=String(settings.demoBalance);volumeInput.value=String(base.volumeWin??55);
    boostInput.value = String(settings.boost);
    flatInput.value = String(settings.flatCash);
    angelsInput.value = settings.angels.join(', ');
    multInput.value = settings.multipliers.join(', ');
    duration.value = String(settings.spinSeconds);
    player.value = settings.player;
    mainColor.value = String(base.colorPrimary);
    secondaryColor.value = String(base.colorSecondary);
    modeFields.forEach(f => { const m = settings.modes.find(m => m.id === f.id)!; f.name.value = m.name; f.enabled.checked = m.enabled; f.weight.value = String(m.weight); });
    colorsDirty = false;
    remount();
    renderDemos();
    formError.textContent = 'Settings imported.';
}
catch (e) {
    formError.textContent = e instanceof Error ? e.message : String(e);
} };
button(files, 'Download stream overlay', () => download('Faith-Scam-Wheel-Stream.html', exportHtml(true), 'text/html'));
button(files, 'Download this desk', () => download('Faith-Scam-Wheel.html', exportHtml(false), 'text/html'));
button(files, 'Offline StreamElements HTML', () => { const html = '<!doctype html><html><head><style>html,body{margin:0;background:transparent;overflow:hidden}</style></head><body><script>window.WHEEL_CONFIG=' + JSON.stringify(currentConfigCode()) + ';<\/script><script>' + window.FAITH_ASSETS.wheel.replace(/<\/script/gi, '<\\/script') + '<\/script></body></html>'; download('Faith-StreamElements-HTML.txt', html, 'text/plain'); });
const streamSetup = panels.get('stream')!;
make('h2', '', 'Ready for stream', streamSetup);
make('p', 'desk-hint', 'Save your amounts and modes in Settings first. This installer includes those saved choices and loads the wheel from Faith\'s website.', streamSetup);
const siteAddress = input(streamSetup, 'PUBLISHED WHEEL ADDRESS', Wheel.publishedSiteUrl(location.href) ?? window.FAITH_HOSTED_URL ?? '', 'url');
siteAddress.placeholder = 'Paste the published HTTPS website address';
siteAddress.autocomplete = 'off';
const hostedStatus = make('p', 'desk-hint', '', streamSetup);
hostedStatus.setAttribute('role', 'status');
const installerLabel = make('label', 'field', '1. VIEWER WHEEL - STREAMELEMENTS HTML', streamSetup);
const installerCode = make('textarea', 'hosted-installer', '', installerLabel);
installerCode.readOnly = true;
installerCode.spellcheck = false;
const installButtons = make('div', 'file-actions', '', streamSetup);
const copyInstaller = button(installButtons, 'Copy installer', async () => {
    const html = currentHostedInstaller();
    if (!html) return;
    try { await navigator.clipboard.writeText(html); hostedStatus.textContent = 'Copied. Paste into the new widget\'s HTML tab.'; }
    catch { installerCode.focus(); installerCode.select(); hostedStatus.textContent = 'The installer is selected. Copy it, or use Download installer.'; }
}, 'primary');
const downloadInstaller = button(installButtons, 'Download installer', () => {
    const html = currentHostedInstaller();
    if (html) download('Faith-StreamElements-Hosted-HTML.txt', html, 'text/plain');
});
make('p', 'desk-hint', 'In StreamElements, add a new Custom Widget. Clear its HTML, CSS, JS, Fields and Data tabs, paste this installer into HTML, then save.', streamSetup);
make('p', 'desk-hint', 'Code updates load when the widget refreshes. To change saved amounts or modes, copy a fresh installer after saving. The overlay stays transparent.', streamSetup);
make('p', 'desk-hint', 'Use !scam spin, !scam new and !scam finish in chat (broadcaster by default). This preview is separate from the OBS round. The private panel below follows the actual OBS wheel.', streamSetup);
make('p', 'desk-hint', 'Need a self-contained copy? The offline downloads are in Settings.', streamSetup);
const monitorLabel = make('label', 'field', '2. PRIVATE LIVE TOTALS - STREAMELEMENTS HTML', streamSetup);
const monitorCode = make('textarea', 'hosted-installer', '', monitorLabel);
monitorCode.readOnly = true;
monitorCode.spellcheck = false;
const monitorButtons = make('div', 'file-actions', '', streamSetup);
const copyMonitor = button(monitorButtons, 'Copy private panel', async () => {
    const html = Wheel.hostedMonitorInstaller(siteAddress.value);
    if (!html) return;
    try { await navigator.clipboard.writeText(html); hostedStatus.textContent = 'Private panel copied. Install in a separate StreamElements overlay.'; }
    catch { monitorCode.focus(); monitorCode.select(); hostedStatus.textContent = 'Select and copy the private panel code, or download it.'; }
});
const downloadMonitor = button(monitorButtons, 'Download private panel', () => {
    const html = Wheel.hostedMonitorInstaller(siteAddress.value);
    if (html) download('Faith-StreamElements-Private-Totals-Hosted.txt', html, 'text/plain');
});
make('p', 'desk-hint', 'Create a SECOND StreamElements overlay on Faith\'s same account, named Private Scam Totals. Add a new Custom Widget, clear all its code tabs, and paste this code into HTML.', streamSetup);
make('p', 'desk-hint', 'Open that second overlay URL in a private browser window or OBS Custom Browser Dock. Keep its URL private and never add it as a scene source. Only the first viewer overlay goes into the broadcast.', streamSetup);
make('p', 'desk-hint', 'LIVE FROM OBS means the panel is receiving the viewer wheel\'s totals. If the wheel stops or disconnects, it marks the last received values offline. The panel cannot spin or create a second round.', streamSetup);
make('p', 'desk-hint', 'Keep one active viewer instance. Editor previews do not broadcast totals. Reuse the same OBS source across scenes; a second open viewer waits while the first is live. Refreshing the viewer starts a fresh round.', streamSetup);
siteAddress.oninput = refreshHostedInstaller;
function currentConfigCode() {
    const current = { ...base, gameMode: 'scam', spinCommand: '!scam', wheelCommand: '!scam', scamConfig: JSON.stringify(settings), importConfig: '' };
    return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(current)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function currentHostedInstaller() { return Wheel.hostedInstaller(currentConfigCode(), siteAddress.value); }
function refreshHostedInstaller() {
    const html = currentHostedInstaller();
    installerCode.value = html ?? '';
    monitorCode.value = Wheel.hostedMonitorInstaller(siteAddress.value) ?? '';
    copyMonitor.disabled = downloadMonitor.disabled = !monitorCode.value;
    copyInstaller.disabled = downloadInstaller.disabled = !html;
    hostedStatus.textContent = html ? 'Ready. This installer uses your saved settings.' : siteAddress.value.trim() ? 'Use the published HTTPS website address, not the github.com repository link or a local preview.' : 'The hosted installer will be ready when the site is published. Open the published homepage, or paste its website address here.';
}
refreshHostedInstaller();
const notes = make('details', 'rules-note', '', editor);
make('summary', '', 'Round rules & scripted surprises', notes);
make('p', '', 'Two completed regular spins unlock the scam on the next press. Bonus spins never delay it. Multipliers add to a bank; cash is multiplied when the round ends. Totals at $30 or less triple, and totals from $31 to $50 double, as part of the final gag. Fatal Attraction guarantees its first multiplier; Sweet Little Lie uses a fake jackpot board; Lucky-ish always lands on $7 before awarding $77. The rules are intentional and are visible in each demo description.', notes);
const footer = make('div', 'desk-footer');
const mute = button(footer, 'Sound on', () => { mount?.scam?.mute(!mount.scam.snapshot().muted); save(); });
button(footer, 'Hide controls', () => setHidden(true));
const reveal = make('button', 'desk-reveal', 'Controls', doc.body);
reveal.onclick = () => setHidden(false);
function selectTab(id: string) { tab = id; if (id === 'stream') refreshHostedInstaller(); for (const [key, p] of panels)
    p.hidden = key !== id; tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.tab === id)); }
function save() { base = { ...base, gameMode: 'scam', spinCommand: '!scam', wheelCommand: '!scam', scamConfig: JSON.stringify(settings), importConfig: '' }; try {
    localStorage.setItem(STORAGE, JSON.stringify(base));
}
catch {
    formError.textContent = 'Saved for this session. Export settings to keep a copy.';
} }
function fit() { if (!mount)
    return; const width = doc.body.classList.contains('desk-hidden') ? 0 : shell.getBoundingClientRect().width; mount.root.dataset.reservedWidth = String(width); dispatchEvent(new Event('resize')); }
function setHidden(hide: boolean) { doc.body.classList.toggle('desk-hidden', hide); fit(); }
function remount() { mount?.dispose(); const result = Wheel.mountWidget(doc, { fieldData: { ...base, gameMode: 'scam', spinCommand: '!scam', wheelCommand: '!scam', scamConfig: JSON.stringify(settings), importConfig: '' } }); if ('error' in result) {
    status.textContent = 'Could not load these settings.';
    return;
} mount = result; window.faithWheel = mount; mount.root.addEventListener('scamchange', e => refresh((e as CustomEvent<ScamSnapshot>).detail)); fit(); refresh(mount.scam!.snapshot()); }
function refresh(s: ScamSnapshot) { refreshHostStats(s); spin.disabled = s.busy || s.phase !== 'ready' || (s.remaining === 0 && s.mode !== 22 && !(s.mode === undefined && s.regularCompleted >= 2)); spin.textContent = s.busy ? 'IN PLAY' : s.mode === undefined && s.regularCompleted >= 2 ? 'REVEAL THE SCAM' : s.mode === 22 ? 'SPIN / GO' : 'SPIN'; finish.disabled = s.busy || s.phase !== 'ready'; minus.disabled = plus.disabled = s.busy || s.phase === 'picking' || s.phase === 'finished' || s.mode === 21 || s.mode === 25; minus.textContent = s.mode === 22 ? '- 1 sec' : '- 1'; plus.textContent = s.mode === 22 ? '+ 1 sec' : '+ 1'; status.textContent = s.message; summary.textContent = s.completed + ' spins played'; mute.textContent = s.muted ? 'Sound off' : 'Sound on'; base.disableSound = s.muted; action.replaceChildren(); if (s.phase === 'picking') {
    button(action, 'REVEAL ' + s.picks.length + '/6', () => mount?.scam?.revealPicks(), 'primary').disabled = s.busy || s.picks.length !== 6;
} if (s.phase === 'boundary') {
    button(action, 'Count both', () => mount?.scam?.confirmBoundary(true));
    button(action, 'Pointer only', () => mount?.scam?.confirmBoundary(false));
} if (s.phase === 'rainbow')
    button(action, 'Continue', () => mount?.scam?.continue(), 'primary'); if (s.phase === 'choice') {
    button(action, 'Bank it', () => mount?.scam?.encore(false));
    button(action, 'Encore', () => mount?.scam?.encore(true));
} }
function download(name: string, text: string, type: string) { const url = URL.createObjectURL(new Blob([text], { type })); const a = doc.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function exportHtml(isStream: boolean) { const escape = (s: string) => s.replace(/</g, '\\u003c'); return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Faith Scam Wheel</title></head><body><script>window.FAITH_STREAM=' + isStream + ';window.FAITH_SETTINGS=' + escape(JSON.stringify({ ...base, gameMode: 'scam', spinCommand: '!scam', wheelCommand: '!scam', scamConfig: JSON.stringify(settings) })) + ';window.FAITH_HOSTED_URL=' + escape(JSON.stringify(Wheel.publishedSiteUrl(siteAddress.value) ?? null)) + ';window.FAITH_ASSETS=' + escape(JSON.stringify(window.FAITH_ASSETS)) + ';const s=document.createElement("style");s.textContent=FAITH_ASSETS.css;document.head.append(s);for(const source of [FAITH_ASSETS.wheel,FAITH_ASSETS.desk]){const script=document.createElement("script");script.textContent=source;document.body.append(script)}<\/script></body></html>'; }
addEventListener('keydown', e => { if ((e.target as HTMLElement)?.closest('input,textarea,select,button'))
    return; if (e.code === 'Space') {
    e.preventDefault();
    mount?.spin();
} if (e.key.toLowerCase() === 'h')
    setHidden(!doc.body.classList.contains('desk-hidden')); });
renderDemos();
selectTab(tab);
remount();
