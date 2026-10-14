import { mountLiveMonitor } from './monitor-view.js';
import { liveApi } from './live-shared.js';
let mounted: ReturnType<typeof mountLiveMonitor> | undefined;
let connected = false;
function start() { const api = liveApi(); if (mounted && (connected || !api)) return; mounted?.dispose(); mounted = mountLiveMonitor(document, api); connected = !!api; }
window.addEventListener('onWidgetLoad', start);
function fallback() { setTimeout(start, liveApi() ? 1500 : 0); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fallback); else fallback();
window.addEventListener('pagehide', () => mounted?.dispose(), { once: true });
