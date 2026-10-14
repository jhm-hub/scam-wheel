import type { WheelController, ControllerOpts } from '../app/controller.js';
import type { WidgetLoadDetail, ChatEventData } from '../se/types.js';
import type { WheelConfig } from '../config/parse.js';
import { hasCommandPermission } from '../se/permissions.js';
import { buildScamWidget } from './widget.js';
import { publishLiveTotals } from './live-publisher.js';
export function createScamController(doc: Document, parent: HTMLElement, detail: WidgetLoadDetail, cfg: WheelConfig, opts: ControllerOpts): WheelController {
    const built = buildScamWidget(doc, cfg, opts), api = built.scam!;
    let paused = false, disposed = false;
    parent.append(built.container);
    built.refit();
    const live = publishLiveTotals(built.container, () => api.snapshot(), () => paused);
    function spin() { if (!paused && !disposed && live.canControl())
        built.spin(); }
    function handleChatMessage(text: string, data: ChatEventData, broadcaster: string | undefined) {
        if (disposed || !cfg.enableCommands || !live.canControl() || !hasCommandPermission(cfg.commandPermission, data, broadcaster))
            return;
        const normalized = text.trim().replace(/\s+/g, ' '), lower = normalized.toLowerCase();
        if (lower === cfg.spinCommand.trim().toLowerCase()) {
            spin();
            return;
        }
        const base = cfg.wheelCommand.trim().toLowerCase();
        if (!cfg.enableCommands || !base || (lower !== base && !lower.startsWith(base + ' ')))
            return;
        const rest = normalized.slice(base.length).trim(), [cmd = '', ...args] = rest.split(' '), arg = args.join(' ');
        if (cmd.toLowerCase() === 'pause') {
            paused = true;
            api.pause(true);
            return;
        }
        if (cmd.toLowerCase() === 'resume') {
            paused = false;
            api.pause(false);
            return;
        }
        if (paused)
            return;
        switch (cmd.toLowerCase()) {
            case '':
            case 'spin':
                spin();
                break;
            case 'new':
                api.newRound(arg);
                break;
            case 'finish':
                api.finish();
                break;
            case 'bonus': {
                const n = Number(arg);
                if (Number.isInteger(n) && Math.abs(n) <= 60)
                    api.bonus(n);
                break;
            }
            case 'demo': {
                const id = Number(arg);
                if (arg && Number.isInteger(id))
                    api.showcase(id);
                break;
            }
            case 'yes':
                api.confirmBoundary(true);
                break;
            case 'no':
                api.confirmBoundary(false);
                break;
            case 'continue':
                api.continue();
                break;
            case 'pick': {
                const n = Number(arg);
                if (Number.isInteger(n))
                    api.pick(n - 1);
                break;
            }
            case 'reveal':
                api.revealPicks();
                break;
            case 'encore':
                api.encore(true);
                break;
            case 'bank':
                api.encore(false);
                break;
            case 'list':
                opts.announceList?.list(cfg.scam.modes.map(m => m.id + ': ' + m.name));
                break;
        }
    }
    return { render: () => built.refit(), spin, pause: () => { paused = true; api.pause(true); }, resume: () => { paused = false; api.pause(false); }, isPaused: () => paused, addEntry: () => ({ kind: 'rejected', reason: 'empty-text' }), removeEntry: () => ({ kind: 'not-found' }), resetEntries() { }, entries: () => cfg.scam.modes.map(m => m.name), handleChatMessage, handleRedemption() { }, ready: live.ready, flush: live.flush, dispose() { disposed = true; live.dispose(); built.dispose(); built.container.remove(); } };
}
