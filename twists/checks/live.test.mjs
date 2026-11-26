import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { cleanSnapshot, createLive, newRoomKey, permittedChatCommand, readChatCommand, readEnvelope, validRoomKey } from "../src/live.mjs";
import { MODES, createRound, activateRound, wheelItems, chooseIndex, land } from "../src/model.mjs";

const twitchBundle = await build({ entryPoints: [fileURLToPath(new URL("../../src/browser/twitch.ts", import.meta.url))], bundle: true, write: false, format: "esm", platform: "node", target: "es2022" });
const twitch = await import("data:text/javascript;base64," + Buffer.from(twitchBundle.outputFiles[0].text).toString("base64"));

function snapshot(total = 20) {
  return { round: { mode: "bin", phase: "active", total, opening: 20, scam: total - 20, quote: 50, data: { remaining: [2, 3, 4, 5] }, ledger: [] }, previousRound: null, items: [{ id: 2, label: "$8", sub: "GIFT" }], rotation: 35, spinMotion: { from: 0, to: 1475, at: 100000, duration: 6200 }, stage: "spin", stageAt: 100000, stageDuration: 6200, sceneActive: true, busy: true, theme: { pink: "#e599bd", lilac: "#bba6e4", cream: "#fff2d7", ink: "#35213f", gold: "#f3d68a", mint: "#a8ddce" }, showBill: false, scriptedLabel: "Guided preview" };
}

async function until(check, message = "Condition was not reached") {
  const deadline = Date.now() + 1500;
  while (!check()) {
    if (Date.now() > deadline) assert.fail(message);
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

function harness({ local = true, remote = true } = {}) {
  let now = 100000, timerId = 0;
  const intervals = new Map(), timeouts = new Map(), channels = new Map(), hosts = new Map(), packets = [], sockets = [];
  const timers = { setInterval(fn) { const id = ++timerId; intervals.set(id, fn); return id; }, clearInterval(id) { intervals.delete(id); }, setTimeout(fn) { const id = ++timerId; timeouts.set(id, fn); return id; }, clearTimeout(id) { timeouts.delete(id); } };
  function connectRoom(options) {
    const item = { options, clients: new Set(), host: null, closed: false };
    if (options.role === "viewer") {
      if (hosts.has(options.key)) queueMicrotask(() => options.status("duplicate"));
      else { hosts.set(options.key, item); queueMicrotask(() => { options.status(remote ? "waiting" : "offline"); options.ready(); }); }
    } else if (remote && hosts.has(options.key)) {
      item.host = hosts.get(options.key); item.host.clients.add(item);
      queueMicrotask(() => { options.status("connected"); item.host.options.status("connected"); options.ready(); item.host.options.ready(); });
    } else queueMicrotask(() => options.status("offline"));
    return {
      send(value) {
        if (item.closed || !remote) return false;
        packets.push({ transport: "peer", value: structuredClone(value), sender: item });
        const targets = item.host ? [item.host] : [...item.clients];
        targets.forEach(target => queueMicrotask(() => { if (!target.closed) target.options.message(structuredClone(value)); }));
        return targets.length > 0;
      },
      dispose() {
        item.closed = true;
        if (item.host) item.host.clients.delete(item);
        else if (hosts.get(options.key) === item) hosts.delete(options.key);
      },
    };
  }
  function broadcastFactory(name) {
    if (!local) return undefined;
    const item = { onmessage: null, closed: false, postMessage(value) {
      packets.push({ transport: "local", value: structuredClone(value), sender: item });
      for (const target of channels.get(name)) if (target !== item && !target.closed) queueMicrotask(() => target.onmessage?.({ data: structuredClone(value) }));
    }, close() { item.closed = true; channels.get(name).delete(item); } };
    if (!channels.has(name)) channels.set(name, new Set());
    channels.get(name).add(item);
    return item;
  }
  function socketFactory(url) {
    const socket = { url, readyState: 1, sent: [], closed: false, send(text) { socket.sent.push(text); }, close() { socket.closed = true; socket.readyState = 3; socket.onclose?.(); }, receive(text) { socket.onmessage?.({ data: text }); } };
    sockets.push(socket);
    queueMicrotask(() => socket.onopen?.());
    return socket;
  }
  return {
    dependencies: { crypto: webcrypto, now: () => now, timers, broadcastFactory, socketFactory, loadModules: async () => ({ connectRoom, channelName: twitch.channelName, parseLine: twitch.parseLine }) },
    packets, sockets, channels, hosts, intervals, timeouts,
    advance(ms) { now += ms; },
    pulse() { for (const fn of [...intervals.values()]) fn(); },
    deliverToViewers(raw) { for (const host of hosts.values()) for (const client of host.clients) client.options.message(structuredClone(raw)); },
  };
}

test("room keys are unguessable and distinct; malformed keys are rejected", () => {
  const a = newRoomKey(), b = newRoomKey();
  assert.ok(validRoomKey(a)); assert.ok(validRoomKey(b)); assert.notEqual(a, b);
  for (const invalid of [null, "", "a".repeat(63), "g".repeat(64), "A".repeat(64)]) assert.equal(validRoomKey(invalid), false);
});

test("an invalid room cannot open transports or Twitch and keeps an explicit invalid status", async () => {
  let loaded = false;
  const statuses = [];
  const live = createLive({ key: "broken", onStatus: (_text, state) => statuses.push(state.code) }, { loadModules: async () => { loaded = true; throw Error("Must not load"); } });
  assert.equal(live.sendState(snapshot()), false);
  assert.equal(await live.connectChat("faith"), false);
  assert.equal(loaded, false);
  assert.deepEqual(statuses, ["invalid"]);
  live.dispose();
});

test("snapshot whitelist excludes private controls, copies values and rejects unsafe payloads", () => {
  const source = { ...snapshot(), roomKey: "private", twitchChannel: "private", config: { token: "private" } };
  const clean = cleanSnapshot(source);
  assert.ok(clean);
  assert.equal(clean.roomKey, undefined); assert.equal(clean.config, undefined); assert.equal(clean.twitchChannel, undefined);
  source.round.total = 999;
  assert.equal(clean.round.total, 20);
  assert.equal(cleanSnapshot({ ...snapshot(), round: { ...snapshot().round, mode: "original" } }), undefined);
  assert.equal(cleanSnapshot({ ...snapshot(), round: { ...snapshot().round, total: NaN } }), undefined);
  assert.equal(cleanSnapshot({ ...snapshot(), stage: "execute" }), undefined);
  assert.equal(cleanSnapshot({ ...snapshot(), theme: { pink: "url(secret)" } }), undefined);
  assert.equal(cleanSnapshot({ ...snapshot(), round: { ...snapshot().round, payload: () => {} } }), undefined);
  assert.equal(cleanSnapshot({ ...snapshot(), items: Array(257).fill("x") }), undefined);
  assert.equal(cleanSnapshot({ ...snapshot(), round: { ...snapshot().round, text: "x".repeat(4097) } }), undefined);
  const prototype = JSON.parse('{"__proto__":{"polluted":true}}');
  assert.equal(cleanSnapshot({ ...snapshot(), round: { ...snapshot().round, data: prototype } }), undefined);
});

test("all eight real models can transport opening, reveal and final state without dropping their ledger", () => {
  for (const mode of Object.keys(MODES)) {
    let round = createRound(mode, undefined, { quick: false, scenario: "story" }), previousRound = null;
    while (round.phase !== "complete") {
      if (round.phase === "ready") round = activateRound(round);
      const original = { ...snapshot(), round, previousRound, items: wheelItems(round), stage: "reveal" };
      const transported = cleanSnapshot(original);
      assert.ok(transported, mode + " " + round.phase + " " + round.step);
      assert.deepEqual(transported.round.ledger, round.ledger);
      previousRound = round;
      round = land(round, chooseIndex(round, () => 0.5), () => 0.5);
    }
    assert.ok(cleanSnapshot({ round, previousRound, stage: "complete" }), mode + " final");
  }
});

test("chat command surface does not accept unrelated wheels, extra arguments or legacy actions", () => {
  assert.equal(readChatCommand("!scam"), "spin");
  assert.equal(readChatCommand(" !SCAM spin  "), "spin");
  assert.equal(readChatCommand("!scam reset"), "reset");
  assert.equal(readChatCommand("!scam next"), "next");
  for (const invalid of ["!wheel", "!scam bonus 5", "!scam reset someone", "!scam-next", "hello !scam", "!scammer", "!scam finish", "!scam new"]) assert.equal(readChatCommand(invalid), undefined);
});

test("Twitch permissions reject audience commands, stale messages and shared-chat cross-room traffic", () => {
  const now = 100000;
  const line = twitch.parseLine("@id=one;tmi-sent-ts=100000;mod=0;room-id=1 :faith!faith@faith.tmi.twitch.tv PRIVMSG #faith :!scam next");
  assert.equal(permittedChatCommand(line, "faith", false, now), "next");
  assert.equal(permittedChatCommand({ ...line, nick: "viewer" }, "faith", false, now), undefined);
  const mod = { ...line, nick: "moderator", tags: { ...line.tags, mod: "1" } };
  assert.equal(permittedChatCommand(mod, "faith", false, now), undefined);
  assert.equal(permittedChatCommand(mod, "faith", true, now), "next");
  assert.equal(permittedChatCommand({ ...line, params: "#someoneelse" }, "faith", true, now), undefined);
  assert.equal(permittedChatCommand({ ...line, tags: { ...line.tags, "source-room-id": "2" } }, "faith", true, now), undefined);
  assert.equal(permittedChatCommand(line, "faith", true, now + 30001), undefined);
  assert.equal(permittedChatCommand({ ...line, tags: { ...line.tags, id: "" } }, "faith", true, now), undefined);
});

test("envelope namespace, authority, sequence and snapshot are bounded", () => {
  const value = { namespace: "faith-twists-live-v1", version: 1, kind: "state", role: "operator", sender: "a".repeat(64), sequence: 1, revision: 1, sentAt: 100000, state: snapshot() };
  assert.ok(readEnvelope(value));
  for (const changed of [{ namespace: "scam-room-v1" }, { role: "audience" }, { sequence: 0 }, { revision: 0 }, { sentAt: Infinity }, { kind: "action" }, { state: {} }]) assert.equal(readEnvelope({ ...value, ...changed }), undefined);
});

test("separate-browser peer views receive only authenticated state and deduplicate heartbeat copies", async t => {
  const h = harness({ local: false });
  const received = [], statuses = [], key = newRoomKey();
  const operator = createLive({ key, onStatus: (text, state) => statuses.push(state.code) }, h.dependencies);
  t.after(() => operator.dispose());
  assert.equal(operator.sendState(snapshot()), true);
  await until(() => h.hosts.size === 1);
  const viewer = createLive({ key, viewer: true, onState: (state, timing) => received.push({ state, timing }) }, h.dependencies);
  t.after(() => viewer.dispose());
  await until(() => received.length === 1);
  assert.equal(received[0].state.round.total, 20);
  assert.equal(received[0].timing.transport, "peer");
  assert.ok(statuses.includes("connected"));
  h.pulse();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(received.length, 1);
  operator.sendState(snapshot(60));
  await until(() => received.length === 2);
  assert.equal(received[1].state.round.total, 60);
  const latest = [...h.packets].reverse().find(packet => packet.value.envelope.kind === "state").value;
  h.deliverToViewers(latest);
  const forged = structuredClone(latest); forged.envelope.sequence += 100; forged.envelope.state.round.total = 9000;
  h.deliverToViewers(forged);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(received.length, 2);
  assert.equal(viewer.sendState(snapshot(100)), false);
  assert.equal(await viewer.connectChat("faith"), false);
});

test("same-browser view works while internet pairing is offline and cannot cross rooms", async t => {
  const h = harness({ remote: false });
  const key = newRoomKey(), received = [], wrong = [];
  const operator = createLive({ key }, h.dependencies);
  t.after(() => operator.dispose());
  operator.sendState(snapshot(45));
  await until(() => h.channels.size === 1);
  const viewer = createLive({ key, viewer: true, onState: state => received.push(state) }, h.dependencies);
  const stranger = createLive({ key: newRoomKey(), viewer: true, onState: state => wrong.push(state) }, h.dependencies);
  t.after(() => viewer.dispose()); t.after(() => stranger.dispose());
  await until(() => received.length === 1);
  assert.equal(received[0].round.total, 45);
  assert.equal(wrong.length, 0);
});

test("an unchanged snapshot is redelivered after a stale connection recovers", async t => {
  const h = harness({ local: false });
  const key = newRoomKey(), states = [], statuses = [];
  const operator = createLive({ key }, h.dependencies);
  t.after(() => operator.dispose());
  operator.sendState(snapshot());
  await until(() => h.hosts.size === 1);
  const viewer = createLive({ key, viewer: true, onState: state => states.push(state), onStatus: (_text, state) => statuses.push(state.code) }, h.dependencies);
  t.after(() => viewer.dispose());
  await until(() => states.length === 1);
  h.advance(6500);
  h.pulse();
  await until(() => states.length === 2);
  assert.equal(states[1].round.total, 20);
  assert.ok(statuses.includes("waiting"));
  assert.equal(statuses.at(-1), "connected");
});

test("viewer timing rebases a controller clock without accepting old state revisions", async t => {
  const h = harness({ local: false });
  const key = newRoomKey(), states = [];
  const operator = createLive({ key }, h.dependencies);
  t.after(() => operator.dispose());
  operator.sendState(snapshot());
  await until(() => h.hosts.size === 1);
  const viewer = createLive({ key, viewer: true, onState: (state, timing) => states.push({ state, timing }) }, { ...h.dependencies, now: () => 150000 });
  t.after(() => viewer.dispose());
  await until(() => states.length === 1);
  assert.equal(states[0].timing.clockOffsetMs, 50000);
  assert.equal(states[0].state.spinMotion.at + states[0].timing.clockOffsetMs, 150000);
  const oldPacket = h.packets.find(packet => packet.value.envelope.kind === "state").value;
  operator.sendState(snapshot(70));
  await until(() => states.length === 2);
  h.deliverToViewers(oldPacket);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(states.length, 2);
  assert.equal(states[1].state.round.total, 70);
});

test("a replacement desk resyncs through the local channel after the old desk disconnects", async t => {
  const h = harness();
  const key = newRoomKey(), states = [];
  const first = createLive({ key }, h.dependencies);
  first.sendState(snapshot());
  await until(() => h.hosts.size === 1);
  const viewer = createLive({ key, viewer: true, onState: state => states.push(state) }, h.dependencies);
  t.after(() => viewer.dispose());
  await until(() => states.length === 1);
  first.dispose();
  h.advance(6500);
  const next = createLive({ key }, h.dependencies);
  t.after(() => next.dispose());
  next.sendState(snapshot(80));
  await until(() => h.hosts.size === 1);
  h.pulse();
  await until(() => states.some(state => state.round.total === 80));
});

test("a duplicate operator stops broadcasting instead of fighting the existing control desk", async t => {
  const h = harness({ local: false });
  const key = newRoomKey(), statuses = [];
  const first = createLive({ key }, h.dependencies);
  t.after(() => first.dispose());
  await until(() => h.hosts.size === 1);
  const duplicate = createLive({ key, onStatus: (_text, state) => statuses.push(state.code) }, h.dependencies);
  t.after(() => duplicate.dispose());
  await until(() => statuses.includes("duplicate"));
  assert.equal(duplicate.sendState(snapshot()), false);
  assert.equal(await duplicate.connectChat("faith"), false);
});

test("a temporary room-name collision can recover after the old browser releases it", async t => {
  const h = harness({ local: false });
  let controls;
  const operator = createLive({ key: newRoomKey() }, { ...h.dependencies, loadModules: async () => ({ ...twitch, connectRoom(options) { controls = options; queueMicrotask(() => options.status("duplicate")); return { send: () => true, dispose() {} }; } }) });
  t.after(() => operator.dispose());
  await until(() => controls !== undefined);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(operator.sendState(snapshot()), false);
  controls.status("connecting");
  assert.equal(operator.sendState(snapshot()), false);
  controls.status("waiting");
  assert.equal(operator.sendState(snapshot()), true);
});

test("Twitch listener joins read-only, deduplicates commands, and stops completely on disconnect", async t => {
  const h = harness({ local: false, remote: false });
  const actions = [], statuses = [];
  const operator = createLive({ key: newRoomKey(), onCommand: action => actions.push(action), onChatStatus: text => statuses.push(text) }, h.dependencies);
  t.after(() => operator.dispose());
  assert.equal(await operator.connectChat("https://twitch.tv/faith", false), true);
  const socket = h.sockets[0];
  await until(() => socket.sent.length === 3);
  socket.receive(":tmi.twitch.tv 001 justinfan :Welcome\r\n@room-id=1 :tmi.twitch.tv ROOMSTATE #faith\r\n");
  assert.ok(socket.sent.includes("JOIN #faith\r\n"));
  const command = "@id=one;tmi-sent-ts=100000;mod=0;room-id=1 :faith!faith@faith.tmi.twitch.tv PRIVMSG #faith :!scam reset\r\n";
  socket.receive(command.slice(0, 50)); socket.receive(command.slice(50)); socket.receive(command);
  socket.receive(command.replace("id=one", "id=two").replace(":faith!", ":viewer!"));
  assert.deepEqual(actions, ["reset"]);
  assert.ok(statuses.includes("Twitch connected: faith"));
  assert.ok(socket.sent.every(line => !line.startsWith("PRIVMSG")));
  operator.disconnectChat();
  socket.receive(command.replace("id=one", "id=three"));
  assert.deepEqual(actions, ["reset"]);
  assert.equal(socket.closed, true);
  assert.equal(h.timeouts.size, 0);
});
