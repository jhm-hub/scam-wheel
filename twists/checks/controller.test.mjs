import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const html = await readFile(new URL("../src/page.html", import.meta.url), "utf8");
const stubLive = `
export const newRoomKey=()=> 'a'.repeat(64);
export const validRoomKey=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function createLive(options){
  window.__liveOptions=options;
  options.onStatus('Connected for controller tests.',{code:'connected'});
  return {
    sendState(state){window.__snapshots.push(structuredClone(state));return true;},
    requestState(){window.__requests++;},
    connectChat:async(channel,moderators)=>{
      window.__chatCalls.push({channel,moderators});
      options.onChatStatus('Twitch disconnected');
      options.onChatStatus('Connecting to Twitch');
      if(window.__deferChat)return new Promise(resolve=>window.__pendingChat.push(resolve));
      return true;
    },
    disconnectChat(){window.__chatDisconnects++;options.onChatStatus('Twitch disconnected');},
    dispose(){}
  };
}`;
const stubRender = `
export const THEME={pink:'#e599bd',lilac:'#bba6e4',cream:'#fff2d7',ink:'#35213f',gold:'#f3d68a',mint:'#a8ddce'};
export const rotationAt=state=>state.rotation;
export function makeRenderer(){return {draw(state){window.__renderState=state;}};}
`;
const bundled = await build({
  entryPoints: [root + "src/app.mjs"], bundle: true, write: false, format: "iife", target: "es2022",
  plugins: [{ name: "controller-boundaries", setup(builder) {
    builder.onResolve({ filter: /^\.\/live\.mjs$/ }, () => ({ path: "live", namespace: "controller-stub" }));
    builder.onResolve({ filter: /^\.\/render\.mjs$/ }, () => ({ path: "render", namespace: "controller-stub" }));
    builder.onLoad({ filter: /.*/, namespace: "controller-stub" }, ({ path }) => ({ contents: path === "live" ? stubLive : stubRender, loader: "js" }));
  } }],
});

async function setup(options = {}) {
  const errors = [];
  const console = new VirtualConsole();
  console.on("jsdomError", error => errors.push(error));
  const dom = new JSDOM(html.replace("__CSS__", "").replace("__APP__", ""), {
    url: options.url || "https://example.test/demos/twists/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: console,
  });
  const { window } = dom, document = window.document;
  let clock = 1806000000000, timerId = 0, raf;
  const timeouts = new Map();
  const NativeDate = window.Date;
  window.Date = class extends NativeDate { static now() { return clock; } };
  window.structuredClone = structuredClone;
  window.matchMedia = query => ({ matches: query.includes("prefers-reduced-motion") ? options.reduced !== false : false, addEventListener() {}, removeEventListener() {} });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  Object.defineProperty(document, "fonts", { value: { load: async () => [] } });
  window.setTimeout = (callback, ms = 0, ...args) => { const id = ++timerId; timeouts.set(id, { at: clock + Math.max(0, Number(ms) || 0), callback: () => callback(...args) }); return id; };
  window.clearTimeout = id => timeouts.delete(id);
  window.requestAnimationFrame = callback => { raf = callback; return 1; };
  window.cancelAnimationFrame = () => { raf = null; };
  window.__snapshots = [];
  window.__requests = 0;
  window.__chatCalls = [];
  window.__chatDisconnects = 0;
  window.__pendingChat = [];
  window.__deferChat = false;
  window.AudioContext = class {
    get currentTime() { return clock / 1000; }
    resume() { return options.audioBlocked ? new Promise(() => {}) : Promise.resolve(); }
    createOscillator() { return { type: "triangle", frequency: { setValueAtTime() {} }, connect() {}, disconnect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  };
  const dialog = document.getElementById("confirm");
  dialog.returnValue = "";
  dialog.showModal = function () { this.open = true; };
  dialog.close = function (value) { if (value !== undefined) this.returnValue = value; this.open = false; this.dispatchEvent(new window.Event("close")); };
  dialog.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (button) { event.preventDefault(); dialog.close(button.value); }
  });
  window.addEventListener("error", event => errors.push(event.error || Error(event.message)));
  if (options.storage) {
    for (const [key, value] of Object.entries(options.storage)) window.localStorage.setItem(key, value);
  } else {
    window.localStorage.setItem("faith-twists-v1", JSON.stringify({ version: 1, sound: false, quick: true, ...options.config }));
  }
  async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
  function frame() { if (raf) { const callback = raf; raf = null; callback(clock - 1806000000000); } }
  async function nextTimer() {
    await flush();
    const next = [...timeouts.entries()].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
    if (!next) return false;
    timeouts.delete(next[0]);clock = next[1].at;next[1].callback();await flush();frame();await flush();return true;
  }
  async function until(predicate, message = "controller condition", limit = 10000) {
    await flush();frame();
    for (let count = 0; !predicate(); count++) {
      assert.ok(count < limit, "Timed out waiting for " + message);
      assert.ok(await nextTimer(), "No pending timer while waiting for " + message);
    }
    assert.deepEqual(errors, []);
  }
  window.eval(bundled.outputFiles[0].text);
  await flush();frame();
  assert.equal(document.getElementById("spin").disabled, false, "font boot enables controls");
  const harness = {
    window, document, errors, dialog,
    element: id => document.getElementById(id),
    data: () => ({ ...document.getElementById("game").dataset }),
    current: () => window.__snapshots.at(-1),
    async click(id) { document.getElementById(id).click();await flush();frame(); },
    async change(id, value) { const element = document.getElementById(id);if (element.type === "checkbox") element.checked = value;else element.value = value;element.dispatchEvent(new window.Event("change", { bubbles: true }));await flush();frame(); },
    async closeDialog(value) { assert.equal(dialog.open, true);dialog.close(value);await flush();frame(); },
    async escapeDialog() { const cancel = new window.Event("cancel", { cancelable: true });if (dialog.dispatchEvent(cancel)) dialog.close();await flush();frame(); },
    async idle() { await until(() => document.getElementById("game").dataset.busy === "false", "idle wheel"); },
    async spin() { await harness.click("spin");await harness.idle(); },
    async drain() { for (let count = 0; timeouts.size; count++) { assert.ok(count < 10000);await nextTimer(); } },
    until, nextTimer, flush,
    snapshotStorage: () => Object.fromEntries(Array.from({ length: window.localStorage.length }, (_, i) => { const key = window.localStorage.key(i);return [key, window.localStorage.getItem(key)]; })),
    close() { timeouts.clear();raf = null;dom.window.close(); },
  };
  return harness;
}

test("actual controls play two ordinary spins then activate and perform the first scam on press three", async () => {
  const h = await setup({ config: { quick: false } });
  try {
    assert.equal(h.data().phase, "normal");
    await h.spin();assert.equal(h.data().normalStep, "1");assert.equal(h.data().step, "0");assert.equal(h.data().opening, "10");
    await h.spin();assert.equal(h.data().normalStep, "2");assert.equal(h.data().phase, "ready");assert.equal(h.data().opening, "20");
    await h.click("spin");assert.equal(h.data().stage, "activation");assert.equal(h.data().step, "0");
    await h.idle();assert.equal(h.data().step, "1");assert.equal(h.data().phase, "active");assert.equal(h.data().opening, "20");
    assert.deepEqual(h.current().round.data.removed, [0]);
    await h.spin();await h.spin();await h.spin();
    assert.equal(h.data().phase, "complete");assert.equal(h.data().scam, "50");assert.equal(h.data().total, "70");
    assert.equal(h.element("total").textContent, "$70");
  } finally { h.close(); }
});

test("all-eight tour completes every approved story and stops after Free Fall", async () => {
  const h = await setup();
  try {
    await h.click("tour");
    await h.until(() => h.element("notice").textContent.includes("All eight demos complete"), "complete tour");
    const completed = new Map(h.window.__snapshots.filter(state => state.stage === "complete").map(state => [state.round.mode, state.round.scam]));
    assert.deepEqual([...completed], [["bin", 50], ["sticky", 40], ["cutting", 60], ["rent", 35], ["seats", 60], ["baggage", 50], ["refund", 40], ["fall", 90]]);
    assert.equal(h.data().mode, "fall");assert.equal(h.data().step, "3");assert.equal(h.data().busy, "false");
    assert.equal(h.element("tour").textContent, "Show all eight");
    await h.drain();assert.equal(h.data().mode, "fall");
  } finally { h.close(); }
});

test("pausing autoplay finishes its current reveal without starting another spin", async () => {
  const h = await setup();
  try {
    await h.click("auto");
    await h.until(() => h.data().stage === "reveal" && h.data().step === "1", "first reveal");
    await h.click("auto");assert.equal(h.data().busy, "true");
    await h.idle();await h.drain();
    assert.equal(h.data().step, "1");assert.equal(h.data().phase, "active");
    await h.spin();assert.equal(h.data().step, "2");
  } finally { h.close(); }
});

test("reset during an animation invalidates pending landings and reveal continuations", async () => {
  for (const stage of ["spin", "reveal"]) {
    const h = await setup();
    try {
      await h.click("spin");await h.until(() => h.data().stage === stage, stage);
      await h.click("reset");await h.closeDialog("confirm");
      assert.equal(h.data().step, "0");assert.equal(h.data().phase, "ready");assert.equal(h.data().busy, "false");
      await h.drain();
      assert.equal(h.data().step, "0");assert.equal(h.data().total, "0");assert.equal(h.data().busy, "false");
      await h.spin();assert.equal(h.data().step, "1");assert.equal(h.current().round.data.removed.length, 1);
    } finally { h.close(); }
  }
});

test("rapid duplicate Spin input never creates duplicate landings or charges", async () => {
  const h = await setup({ config: { mode: "rent" } });
  try {
    for (let turn = 0; turn < 4; turn++) {
      await h.click("spin");
      h.element("spin").dispatchEvent(new h.window.MouseEvent("click", { bubbles: true }));
      h.window.__liveOptions.onCommand("spin");
      await h.idle();
      assert.equal(Number(h.data().step), turn + 1);
    }
    assert.equal(h.data().scam, "35");assert.equal(h.current().round.ledger.length, 4);
  } finally { h.close(); }
});

test("autoplay can start the same guided demo again after completion", async () => {
  const h = await setup({ config: { mode: "sticky" } });
  try {
    await h.click("auto");
    await h.until(() => h.data().phase === "complete" && h.element("auto").textContent === "Play this demo", "first autoplay completion");
    await h.click("auto");
    assert.equal(h.data().busy, "true");
    assert.equal(h.data().step, "0");
    await h.until(() => h.data().phase === "complete" && h.element("auto").textContent === "Play this demo", "second autoplay completion");
    assert.equal(h.data().scam, "40");assert.equal(h.current().round.ledger.length, 1);
  } finally { h.close(); }
});

test("Escape cancels a confirmation even after an earlier dialog was confirmed", async () => {
  const h = await setup();
  try {
    await h.spin();await h.click("reset");await h.closeDialog("confirm");
    await h.spin();assert.equal(h.data().step, "1");
    await h.click("reset");await h.escapeDialog();
    assert.equal(h.data().step, "1");assert.equal(h.data().phase, "active");
    assert.equal(h.current().round.data.removed.length, 1);
  } finally { h.close(); }
});

test("a mode query still restores the matching round, landed wheel and bank after refresh", async () => {
  const h = await setup({ config: { quick: false } });
  let restored;
  try {
    await h.change("mode", "bin");
    await h.spin();await h.spin();await h.spin();
    assert.ok(h.window.location.search.includes("mode=bin"));
    const expected = structuredClone(h.current());
    restored = await setup({ url: h.window.location.href, storage: h.snapshotStorage() });
    assert.deepEqual(restored.current().round, expected.round);
    assert.deepEqual(restored.current().items, expected.items);
    assert.equal(restored.current().rotation, expected.rotation);
    assert.equal(restored.data().opening, "20");assert.equal(restored.data().step, "1");
    assert.equal(restored.current().items.length, 6);
    assert.match(restored.element("notice").textContent, /Restored/);
  } finally { restored?.close();h.close(); }
});

test("final-round refresh retains its final presentation and does not add another charge", async () => {
  const h = await setup();
  let restored;
  try {
    for (let i = 0; i < 4; i++) await h.spin();
    restored = await setup({ url: h.window.location.href, storage: h.snapshotStorage() });
    assert.equal(restored.data().stage, "complete");assert.equal(restored.data().busy, "false");
    assert.equal(restored.data().total, "50");assert.equal(restored.current().items.length, 3);
    assert.equal(restored.current().round.ledger.length, 1);
    await restored.drain();assert.equal(restored.data().total, "50");
  } finally { restored?.close();h.close(); }
});

test("blocked audio resume cannot keep a spin stuck before activation", async () => {
  const h = await setup({ config: { sound: true }, audioBlocked: true });
  try {
    await h.click("spin");await h.idle();
    assert.equal(h.data().step, "1");assert.equal(h.data().busy, "false");
  } finally { h.close(); }
});

test("a duplicate private desk disables both clicks and chat commands", async () => {
  const h = await setup();
  try {
    h.window.__liveOptions.onStatus("Another desk is active.", { code: "duplicate" });
    assert.equal(h.element("spin").disabled, true);
    h.element("spin").dispatchEvent(new h.window.MouseEvent("click", { bubbles: true }));
    h.window.__liveOptions.onCommand("spin");
    await h.flush();await h.drain();
    assert.equal(h.data().step, "0");assert.equal(h.data().busy, "false");
  } finally { h.close(); }
});

test("Twitch retry retains the enabled listener, applies moderator revocation and remains disconnectable", async () => {
  const h = await setup();
  try {
    h.element("channel").value = "faith";
    await h.change("allow-mods", true);
    await h.click("connect-chat");
    assert.deepEqual(h.window.__chatCalls.map(call => [call.channel, call.moderators]), [["faith", true]]);
    assert.equal(h.element("connect-chat").textContent, "Disconnect chat");
    h.window.__liveOptions.onChatStatus("Twitch disconnected - retrying");
    assert.equal(h.element("connect-chat").textContent, "Disconnect chat");
    await h.change("allow-mods", false);
    assert.deepEqual(h.window.__chatCalls.map(call => call.moderators), [true, false]);
    assert.equal(h.element("connect-chat").textContent, "Disconnect chat");
    h.window.__liveOptions.onChatStatus("Twitch disconnected - retrying");
    await h.click("connect-chat");
    assert.equal(h.window.__chatDisconnects, 1);
    assert.equal(h.window.__chatCalls.length, 2);
    assert.equal(h.element("connect-chat").textContent, "Connect chat");
  } finally { h.close(); }
});

test("the newest moderator choice wins while earlier reconnect requests are still pending", async () => {
  const h = await setup();
  try {
    h.element("channel").value = "faith";
    await h.click("connect-chat");
    h.window.__deferChat = true;
    await h.change("allow-mods", true);
    await h.change("allow-mods", false);
    assert.deepEqual(h.window.__chatCalls.map(call => call.moderators), [false, true, false]);
    assert.equal(h.window.__pendingChat.length, 2);
    h.window.__pendingChat[1](true);await h.flush();
    assert.equal(h.element("connect-chat").textContent, "Disconnect chat");
    h.window.__pendingChat[0](false);await h.flush();
    assert.equal(h.element("connect-chat").textContent, "Disconnect chat");
    await h.click("connect-chat");
    assert.equal(h.window.__chatDisconnects, 1);
    assert.equal(h.window.__chatCalls.length, 3);
  } finally { h.close(); }
});

test("a duplicate desk cannot reset, change settings or overwrite its active room checkpoint", async () => {
  const h = await setup();
  try {
    await h.spin();
    const saved = h.snapshotStorage(), expected = structuredClone(h.current()), count = h.window.__snapshots.length;
    h.window.__liveOptions.onStatus("Another desk is active.", { code: "duplicate" });
    for (const id of ["spin", "reset", "next", "mode", "guided", "random", "scenario", "quick", "auto", "tour", "apply-settings", "load-settings", "settings-file", "pink", "lilac", "show-bill", "connect-chat", "allow-mods"]) assert.equal(h.element(id).disabled, true, id + " disabled");
    for (const id of ["reset", "next", "random", "auto", "tour", "apply-settings", "load-settings", "sound", "connect-chat"]) h.element(id).dispatchEvent(new h.window.MouseEvent("click", { bubbles: true }));
    await h.change("mode", "fall");
    await h.change("scenario", "big");
    await h.change("quick", false);
    await h.change("show-bill", false);
    for (const [id, value] of [["pink", "#123456"], ["lilac", "#654321"], ["pace", "8"], ["volume", "80"]]) {
      h.element(id).value = value;h.element(id).dispatchEvent(new h.window.Event("input", { bubbles: true }));
    }
    for (const command of ["spin", "reset", "next"]) h.window.__liveOptions.onCommand(command);
    h.document.dispatchEvent(new h.window.KeyboardEvent("keydown", { code: "Space", bubbles: true }));
    h.document.dispatchEvent(new h.window.Event("visibilitychange"));
    await h.flush();await h.drain();
    assert.equal(h.dialog.open, false);
    assert.equal(h.data().mode, expected.round.mode);assert.equal(h.data().step, "1");
    assert.equal(h.window.__snapshots.length, count);
    assert.deepEqual(h.snapshotStorage(), saved);
    h.window.__liveOptions.onStatus("Ready. Open the stream view to connect.", { code: "waiting" });
    assert.equal(h.element("spin").disabled, false);
    await h.spin();assert.equal(h.data().step, "2");
    assert.notDeepEqual(h.snapshotStorage(), saved);
  } finally { h.close(); }
});

test("losing room authority cancels a pending landing and lets the desk resume after reclaim", async () => {
  const h = await setup();
  try {
    await h.spin();
    const saved = h.snapshotStorage();
    await h.click("spin");await h.until(() => h.data().stage === "spin", "pending second landing");
    h.window.__liveOptions.onStatus("Another desk is active.", { code: "duplicate" });
    assert.equal(h.data().busy, "false");
    await h.drain();
    assert.equal(h.data().step, "1");
    assert.deepEqual(h.snapshotStorage(), saved);
    h.window.__liveOptions.onStatus("Stream view connected", { code: "connected" });
    await h.spin();assert.equal(h.data().step, "2");
  } finally { h.close(); }
});

test("ownership loss cancels open confirmations and delayed settings imports", async () => {
  const h = await setup();
  try {
    await h.spin();
    const saved = h.snapshotStorage();
    await h.click("reset");assert.equal(h.dialog.open, true);
    h.window.__liveOptions.onStatus("Another desk is active.", { code: "duplicate" });
    await h.flush();
    assert.equal(h.dialog.open, false);assert.equal(h.data().step, "1");
    h.window.__liveOptions.onStatus("Stream view connected", { code: "connected" });
    let resolveFile;
    const file = { size: 100, text: () => new Promise(resolve => { resolveFile = resolve; }) };
    Object.defineProperty(h.element("settings-file"), "files", { value: [file], configurable: true });
    h.element("settings-file").dispatchEvent(new h.window.Event("change"));await h.flush();
    assert.equal(typeof resolveFile, "function");
    h.window.__liveOptions.onStatus("Another desk is active.", { code: "duplicate" });
    h.window.__liveOptions.onStatus("Stream view connected", { code: "connected" });
    resolveFile(JSON.stringify({ version: 1, mode: "fall", settings: {} }));await h.flush();
    assert.equal(h.dialog.open, false);assert.equal(h.data().mode, "bin");assert.equal(h.data().step, "1");
    assert.deepEqual(h.snapshotStorage(), saved);
  } finally { h.close(); }
});

test("a pending Twitch connection cannot re-enable itself after the desk loses authority", async () => {
  const h = await setup();
  try {
    h.element("channel").value = "faith";h.window.__deferChat = true;
    await h.click("connect-chat");
    assert.equal(h.window.__pendingChat.length, 1);
    h.window.__liveOptions.onStatus("Another desk is active.", { code: "duplicate" });
    h.window.__pendingChat[0](true);await h.flush();
    assert.equal(h.element("connect-chat").textContent, "Connect chat");
    assert.equal(h.element("connect-chat").disabled, true);
    h.window.__liveOptions.onStatus("Stream view connected", { code: "connected" });
    assert.equal(h.element("connect-chat").disabled, false);
    assert.equal(h.element("connect-chat").textContent, "Connect chat");
  } finally { h.close(); }
});
