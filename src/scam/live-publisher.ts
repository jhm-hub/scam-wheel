import type { ScamSnapshot } from './widget.js';
import { LIVE_KEY, STALE_MS, isFresh, liveApi, liveTotals, readPacket, type LiveApi, type LivePacket } from './live-shared.js';

export function publishLiveTotals(root: HTMLElement, snapshot: () => ScamSnapshot, paused: () => boolean, api: LiveApi | undefined = liveApi()) {
    if (!api) return { ready: Promise.resolve(), canControl: () => true, flush: () => Promise.resolve(), dispose() {} };
    const session = crypto.randomUUID();
    let active = false, disposed = false, editor = false, verifying = false, dirty = true, sequence = 0, lastSent = 0, lastVerified = 0;
    let writing: Promise<void> | undefined;
    function setActive(value: boolean) { active = value; root.inert = !value; root.dataset.liveRole = editor ? 'editor-preview' : value ? 'live' : 'standby'; }
    setActive(false);
    function canControl() { return active && !disposed && Date.now() - lastVerified < STALE_MS; }
    function write(claim = false): Promise<void> {
        if (disposed || editor || writing || (!claim && !canControl())) return writing ?? Promise.resolve();
        const packet: LivePacket = { version: 1, session, sequence: ++sequence, updatedAt: Date.now(), totals: liveTotals(snapshot(), paused()) };
        dirty = false; lastSent = packet.updatedAt;
        writing = Promise.resolve().then(() => api!.store.set(LIVE_KEY, packet)).then(() => {}).catch(() => { dirty = true; setActive(false); }).finally(() => { writing = undefined; });
        return writing;
    }
    async function verify() {
        if (disposed || verifying || editor) return;
        verifying = true;
        try {
            const status = await api!.getOverlayStatus();
            if (disposed) return;
            if (status.isEditorMode) { editor = true; setActive(false); return; }
            if (status.isEditorMode !== false) { setActive(false); return; }
            const current = readPacket(await api!.store.get(LIVE_KEY));
            if (disposed) return;
            if (current && isFresh(current) && current.session !== session) { setActive(false); return; }
            if (current?.session === session && isFresh(current)) { lastVerified = Date.now(); setActive(true); return; }
            setActive(false);
            await write(true);
            // A read-back prevents a second open viewer from blindly publishing over the first.
            await new Promise(resolve => setTimeout(resolve, 300));
            if (disposed) return;
            const claimed = readPacket(await api!.store.get(LIVE_KEY));
            if (disposed) return;
            if (claimed?.session === session && isFresh(claimed)) { lastVerified = Date.now(); setActive(true); }
        } catch { if (!disposed) setActive(false); }
        finally { verifying = false; }
    }
    const changed = () => { dirty = true; };
    root.addEventListener('scamchange', changed);
    const publishTimer = setInterval(() => { if (canControl() && (dirty || Date.now() - lastSent >= 4000)) void write(); }, 500);
    const leaseTimer = setInterval(() => { void verify(); }, 2000);
    const ready = verify();
    return { ready, canControl, flush: () => write(), dispose() { disposed = true; active = false; clearInterval(publishTimer); clearInterval(leaseTimer); root.removeEventListener('scamchange', changed); } };
}
