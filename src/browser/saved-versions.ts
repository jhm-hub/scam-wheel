import type { FieldData } from '../se/types.js';

export const VERSIONS_KEY = 'faith-scam-wheel/saved-versions/v1';
interface SavedVersion { id: string; name: string; config: FieldData }
interface Library { version: 1; selected: string; versions: SavedVersion[] }
export function createVersionLibrary(storage: Pick<Storage, 'getItem' | 'setItem'>, initial: FieldData) {
    function read(): Library {
        const text = storage.getItem(VERSIONS_KEY);
        if (!text) return { version: 1, selected: 'original', versions: [{ id: 'original', name: 'My saved settings', config: structuredClone(initial) }] };
        let data: Library;
        try { data = JSON.parse(text); } catch { throw new Error('Saved versions could not be read. They have not been overwritten.'); }
        if (data?.version !== 1 || !Array.isArray(data.versions) || !data.versions.length || data.versions.length > 30 || data.versions.some(v => !v || typeof v.id !== 'string' || !v.id || typeof v.name !== 'string' || !v.config || typeof v.config !== 'object') || new Set(data.versions.map(v => v.id)).size !== data.versions.length) throw new Error('Saved versions could not be read. They have not been overwritten.');
        return data;
    }
    function write(data: Library) { storage.setItem(VERSIONS_KEY, JSON.stringify(data)); }
    function find(data: Library, id: string): SavedVersion { const v = data.versions.find(v => v.id === id); if (!v) throw new Error('Choose a saved version.'); return v; }
    return {
        list: () => read().versions.map(({ id, name }) => ({ id, name })),
        current() { const d = read(); return structuredClone(find(d, d.selected ?? d.versions[0]!.id)); },
        select(id: string) { const d = read(), v = find(d, id); d.selected = id; write(d); return structuredClone(v); },
        save(id: string, name: string, config: FieldData, copy = false) {
            name = name.trim(); if (!name || name.length > 40) throw new Error('Give this version a name, up to 40 characters.');
            const d = read();
            if (copy) { if (d.versions.length >= 30) throw new Error('Save up to 30 versions.'); id = crypto.randomUUID(); d.versions.push({ id, name, config: structuredClone(config) }); }
            else { const v = find(d, id); v.name = name; v.config = structuredClone(config); }
            d.selected = id; write(d); return structuredClone(find(d, id));
        },
    };
}
export function canApplySettings(s: { busy: boolean; phase: string; completed: number; regularCompleted: number; mode?: number } | undefined) {
    return !!s && !s.busy && (s.phase === 'finished' || s.phase === 'ready' && s.completed === 0 && s.regularCompleted === 0 && s.mode === undefined);
}
