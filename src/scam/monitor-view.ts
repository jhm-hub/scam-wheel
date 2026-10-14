import css from '../styles/monitor.css';
import { LIVE_KEY, isFresh, liveApi, packetFromEvent, readPacket, type LiveApi, type LivePacket } from './live-shared.js';

export function mountLiveMonitor(doc: Document, api: LiveApi | undefined = liveApi()) {
    const style = doc.createElement('style'); style.textContent = css; doc.head.append(style);
    const root = doc.createElement('main'); root.className = 'live-monitor'; doc.body.append(root);
    function node(tag: string, cls: string, text = '', parent = root) { const n = doc.createElement(tag); n.className = cls; n.textContent = text; parent.append(n); return n; }
    node('div', 'monitor-eyebrow', 'FAITH / PRIVATE LIVE TOTALS');
    node('h1', '', 'Scam Wheel');
    const status = node('p', 'monitor-status', 'Waiting for the OBS wheel'); status.setAttribute('role', 'status');
    const player = node('div', 'monitor-player', 'No round received');
    const mode = node('div', 'monitor-mode', 'Open the viewer overlay in OBS');
    const grid = node('dl', 'monitor-grid');
    function stat(label: string) { const card = node('div', 'monitor-stat', '', grid); return { label: node('dt', '', label, card), value: node('dd', '', '--', card) }; }
    const cash = stat('CASH'), bank = stat('MULTIPLIER'), spins = stat('SPINS LEFT');
    const final = node('div', 'monitor-final'); final.hidden = true;
    const message = node('div', 'monitor-message', 'This panel reads the live wheel. It does not start or control another round.');
    const meta = node('p', 'monitor-meta');
    const commands = node('div', 'monitor-commands');
    for (const text of ['!scam new PlayerName - new round', '!scam spin - spin / reveal scam', '!scam finish - show final total', '!scam bonus 1 - add a spin', '!scam pause / !scam resume']) node('code', '', text, commands);
    node('p', 'monitor-help', 'Keep this panel in a private browser window or OBS Custom Browser Dock. Do not add it as a scene source. Commands are typed in Twitch chat; broadcaster only by default.');
    let packet: LivePacket | undefined, disposed = false, polling = false, failed = false;
    function render() {
        const fresh = packet && isFresh(packet);
        root.dataset.stale = String(!fresh);
        status.dataset.state = failed ? 'error' : fresh ? 'live' : packet ? 'stale' : 'waiting';
        status.textContent = !api ? 'Install this panel in StreamElements to connect' : failed ? 'Connection interrupted - last received totals' : fresh ? 'LIVE FROM OBS' : packet ? 'Wheel offline - last received totals' : 'Waiting for the OBS wheel';
        if (!packet) return;
        const s = packet.totals;
        player.textContent = s.player || 'Current round'; mode.textContent = s.mode === undefined ? 'Regular spins' : s.name;
        cash.value.textContent = '$' + s.cash; bank.value.textContent = 'x' + (s.bank || 1);
        spins.label.textContent = s.mode === 22 ? 'SECONDS LEFT' : 'SPINS LEFT'; spins.value.textContent = String(s.mode === 22 ? s.seconds : s.remaining);
        message.textContent = (s.paused ? 'PAUSED / ' : '') + s.message;
        meta.textContent = s.completed + ' spins played / ' + (s.busy ? 'In play' : s.phase === 'finished' ? 'Round finished' : 'Ready') + ' / Updated ' + new Date(packet.updatedAt).toLocaleTimeString();
        if (s.queuedSeconds) meta.textContent += ' / +' + s.queuedSeconds + ' seconds queued';
        final.hidden = s.final === undefined; final.textContent = s.final === undefined ? '' : 'Final total: $' + s.final;
    }
    function accept(value: unknown) {
        const next = readPacket(value);
        if (!next || disposed) return;
        if (packet && (next.session === packet.session ? next.sequence <= packet.sequence : next.updatedAt < packet.updatedAt)) return;
        packet = next; failed = false; render();
    }
    const event = (e: Event) => accept(packetFromEvent(e));
    doc.defaultView?.addEventListener('onEventReceived', event);
    async function poll() {
        if (!api || disposed || polling) return;
        polling = true;
        try { const value = await api.store.get(LIVE_KEY); if (!disposed) { failed = false; accept(value); render(); } }
        catch { if (!disposed) { failed = true; render(); } }
        finally { polling = false; }
    }
    render(); const ready = poll();
    const timer = setInterval(() => { render(); }, 1000);
    const pollTimer = setInterval(() => { void poll(); }, 3000);
    return { root, ready, dispose() { disposed = true; clearInterval(timer); clearInterval(pollTimer); doc.defaultView?.removeEventListener('onEventReceived', event); root.remove(); style.remove(); } };
}
