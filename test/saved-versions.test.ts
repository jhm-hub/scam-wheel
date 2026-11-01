import { describe, it, expect } from 'vitest';
import { createVersionLibrary, VERSIONS_KEY, canApplySettings } from '../src/browser/saved-versions.js';
function fixture() { const data = new Map([['scam-browser-room-v1', 'existing-room']]); return { data, storage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } } }; }
describe('saved wheel versions', () => {
 it('migrates old fields, keeps unknown fields, and edits/copies/selects without changing the room', () => {
  const f = fixture(), old = { colorPrimary: '#123456', volumeWin: 42, customLegacy: true }; let lib = createVersionLibrary(f.storage, old);
  expect(lib.current().config).toEqual(old); lib.save('original', 'Everyday', old);
  const copy = lib.save('original', 'Birthday', { ...old, volumeWin: 70 }, true); lib.save(copy.id, 'Birthday VIP', copy.config);
  lib = createVersionLibrary(f.storage, {}); expect(lib.current().name).toBe('Birthday VIP'); expect(lib.current().config.volumeWin).toBe(70);
  lib.select('original'); expect(lib.current().config.volumeWin).toBe(42); expect(lib.list()).toHaveLength(2); expect(f.data.get('scam-browser-room-v1')).toBe('existing-room');
 });
 it('does not overwrite corruption or claim failed writes are saved', () => {
  const f = fixture(), lib = createVersionLibrary(f.storage, {}); lib.save('original', 'Original', {}); const before = f.data.get(VERSIONS_KEY);
  expect(() => lib.save('original', ' ', {})).toThrow(); expect(() => lib.select('missing')).toThrow(); expect(f.data.get(VERSIONS_KEY)).toBe(before);
  f.storage.setItem = () => { throw Error('Storage full'); }; expect(() => lib.save('original', 'Changed', {})).toThrow('Storage full'); expect(f.data.get(VERSIONS_KEY)).toBe(before);
  f.data.set(VERSIONS_KEY, 'bad'); expect(() => lib.save('original', 'Overwrite', {})).toThrow(); expect(f.data.get(VERSIONS_KEY)).toBe('bad');
 });
 it('only applies at a fresh round or after its final total', () => {
  const fresh = { phase: 'ready', busy: false, completed: 0, regularCompleted: 0 };
  expect(canApplySettings(fresh)).toBe(true); expect(canApplySettings({ ...fresh, completed: 1 })).toBe(false);
  expect(canApplySettings({ ...fresh, mode: 1 })).toBe(false); expect(canApplySettings({ ...fresh, busy: true })).toBe(false);
  expect(canApplySettings({ ...fresh, phase: 'finished', completed: 8, mode: 1 })).toBe(true); expect(canApplySettings(undefined)).toBe(false);
 });
});
