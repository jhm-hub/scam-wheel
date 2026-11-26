const NAMESPACE = "faith-twists-live-v1";
const MODES = new Set(["bin", "sticky", "cutting", "rent", "seats", "baggage", "refund", "fall"]);
const PHASES = new Set(["normal", "ready", "active", "complete"]);
const STAGES = new Set(["idle", "activation", "spin", "reveal", "complete"]);
const FIELDS = new Set(["round", "previousRound", "items", "rotation", "spinMotion", "stage", "stageAt", "stageDuration", "sceneActive", "busy", "theme", "showBill", "scriptedLabel"]);
const MAX_PACKET = 90000;
const noop = () => {};

export function newRoomKey() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map(value => value.toString(16).padStart(2, "0")).join("");
}

export function validRoomKey(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function safeTree(value, depth = 0) {
  if (depth > 20) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value) && Math.abs(value) <= 1e15;
  if (typeof value === "string") return value.length <= 4096;
  if (Array.isArray(value)) return value.length <= 256 && value.every(item => safeTree(item, depth + 1));
  if (!plainObject(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= 64 && entries.every(([key, item]) => !["__proto__", "prototype", "constructor"].includes(key) && key.length <= 80 && safeTree(item, depth + 1));
}

function validRound(round) {
  if (!plainObject(round) || !MODES.has(round.mode) || !PHASES.has(round.phase)) return false;
  return ["total", "opening", "scam", "quote"].every(key => round[key] === undefined || (typeof round[key] === "number" && Number.isFinite(round[key]) && round[key] >= 0));
}

export function cleanSnapshot(value) {
  if (!plainObject(value)) return undefined;
  const state = Object.fromEntries(Object.entries(value).filter(([key]) => FIELDS.has(key)));
  if (!validRound(state.round) || !safeTree(state)) return undefined;
  if (state.previousRound !== undefined && state.previousRound !== null && !validRound(state.previousRound)) return undefined;
  if (state.stage !== undefined && !STAGES.has(state.stage)) return undefined;
  if (state.theme && (!plainObject(state.theme) || Object.values(state.theme).some(color => typeof color !== "string" || !/^#[a-f0-9]{6}$/i.test(color)))) return undefined;
  if (state.spinMotion && (!plainObject(state.spinMotion) || !["from", "to", "at", "duration"].every(key => typeof state.spinMotion[key] === "number" && Number.isFinite(state.spinMotion[key])) || state.spinMotion.duration < 0)) return undefined;
  try {
    const json = JSON.stringify(state);
    return json.length <= MAX_PACKET - 2000 ? JSON.parse(json) : undefined;
  } catch {
    return undefined;
  }
}

export function readChatCommand(text) {
  if (typeof text !== "string") return undefined;
  const match = /^!scam(?:\s+(spin|reset|next))?\s*$/i.exec(text.trim());
  return match ? (match[1] || "spin").toLowerCase() : undefined;
}

export function permittedChatCommand(line, channel, allowMods = false, now = Date.now()) {
  if (!plainObject(line) || line.command !== "PRIVMSG" || line.params !== "#" + channel || !plainObject(line.tags)) return undefined;
  if (line.tags["source-room-id"] && line.tags["source-room-id"] !== line.tags["room-id"]) return undefined;
  const sentAt = Number(line.tags["tmi-sent-ts"]);
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > 30000) return undefined;
  if (line.nick !== channel && !(allowMods === true && line.tags.mod === "1")) return undefined;
  if (typeof line.tags.id !== "string" || !line.tags.id || line.tags.id.length > 128) return undefined;
  return readChatCommand(line.text);
}

export function readEnvelope(value) {
  if (!plainObject(value) || value.namespace !== NAMESPACE || value.version !== 1) return undefined;
  if (!["state", "request", "hello"].includes(value.kind) || !["operator", "audience"].includes(value.role)) return undefined;
  if (!validRoomKey(value.sender) || !Number.isSafeInteger(value.sequence) || value.sequence < 1 || !Number.isFinite(value.sentAt)) return undefined;
  if (value.kind === "state") {
    if (value.role !== "operator" || !Number.isSafeInteger(value.revision) || value.revision < 1) return undefined;
    const state = cleanSnapshot(value.state);
    return state ? { ...value, state } : undefined;
  }
  return { namespace: NAMESPACE, version: 1, kind: value.kind, role: value.role, sender: value.sender, sequence: value.sequence, sentAt: value.sentAt };
}

async function loadModules() {
  const [room, twitch] = await Promise.all([import("../../src/browser/room.ts"), import("../../src/browser/twitch.ts")]);
  return { connectRoom: room.connectRoom, channelName: twitch.channelName, parseLine: twitch.parseLine };
}

export function createLive(options, dependencies = {}) {
  const { key, viewer = false, onState = noop, onStatus = noop, onCommand = noop, onChatStatus = noop } = options;
  if (!validRoomKey(key)) {
    onStatus("Open the stream link from the private controls.", { code: "invalid" });
    return { sendState: () => false, requestState: noop, connectChat: async () => false, disconnectChat: noop, dispose: noop };
  }
  const clock = dependencies.now || (() => Date.now());
  const timers = dependencies.timers || globalThis;
  const cryptoApi = dependencies.crypto || crypto;
  const broadcastFactory = dependencies.broadcastFactory || (name => typeof BroadcastChannel === "function" ? new BroadcastChannel(name) : undefined);
  const socketFactory = dependencies.socketFactory || (url => new WebSocket(url));
  const modulesPromise = (dependencies.loadModules || loadModules)();
  void modulesPromise.catch(noop);
  const sender = [...cryptoApi.getRandomValues(new Uint8Array(32))].map(value => value.toString(16).padStart(2, "0")).join("");
  const role = viewer ? "audience" : "operator";
  let disposed = false, duplicate = false, sequence = 0, revision = 0, latest, peer, channel;
  let peerStatus = "connecting", lastStateAt = null, owner = null, ownerRevision = null, lastStatus = "", chat = null, chatAttempt = 0;
  const seen = new Map(), retiredOwners = new Set(), audience = new Map();
  let sends = Promise.resolve(), receives = Promise.resolve();
  const encoder = new TextEncoder();
  let authKeyPromise;

  function status() {
    if (disposed) return;
    const now = clock();
    for (const [id, at] of audience) if (now - at > 6000) audience.delete(id);
    const fresh = lastStateAt !== null && now - lastStateAt < 6000;
    const code = duplicate ? "duplicate" : viewer ? (fresh ? "connected" : "waiting") : (peerStatus === "connected" || audience.size ? "connected" : "waiting");
    const text = duplicate ? "Another control desk is using this room. Close one or create a new room." : viewer ? (fresh ? "Connected to private controls" : "Waiting for private controls") : code === "connected" ? "Stream view connected" : peerStatus === "offline" ? "Internet pairing unavailable. Same-browser preview still works." : "Ready. Open the stream view to connect.";
    const signature = code + ":" + peerStatus + ":" + text;
    if (signature !== lastStatus) {
      lastStatus = signature;
      onStatus(text, { code, peerStatus, localViewers: audience.size, viewer });
    }
  }

  async function sign(text) {
    const bytes = await cryptoApi.subtle.sign("HMAC", await authKeyPromise, encoder.encode(text));
    return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("");
  }

  async function verify(text, signature) {
    if (!validRoomKey(signature)) return false;
    const bytes = Uint8Array.from(signature.match(/../g), value => parseInt(value, 16));
    return cryptoApi.subtle.verify("HMAC", await authKeyPromise, bytes, encoder.encode(text));
  }

  function emit(kind) {
    if (disposed || duplicate || !authKeyPromise || (kind === "state" && (!latest || viewer))) return;
    const envelope = { namespace: NAMESPACE, version: 1, kind, role, sender, sequence: ++sequence, sentAt: clock(), ...(kind === "state" ? { revision, state: latest } : {}) };
    sends = sends.then(async () => {
      const sealed = { envelope, signature: await sign(NAMESPACE + ":" + JSON.stringify(envelope)) };
      if (disposed || duplicate) return;
      try { channel?.postMessage(sealed); } catch { }
      try { peer?.send(sealed); } catch { }
    }).catch(() => { peerStatus = "offline"; status(); });
  }

  function ingest(raw, transport) {
    receives = receives.then(async () => {
      if (disposed || !plainObject(raw) || !validRoomKey(raw.signature) || !plainObject(raw.envelope)) return;
      let json;
      try { json = JSON.stringify(raw.envelope); } catch { return; }
      if (json.length > MAX_PACKET || !await verify(NAMESPACE + ":" + json, raw.signature)) return;
      const envelope = readEnvelope(raw.envelope);
      if (!envelope || envelope.sender === sender || envelope.sequence <= (seen.get(envelope.sender) || 0)) return;
      seen.set(envelope.sender, envelope.sequence);
      if (seen.size > 32) seen.delete(seen.keys().next().value);
      const now = clock();
      if (!viewer && envelope.role === "audience") {
        audience.set(envelope.sender, now);
        if (envelope.kind === "request" || envelope.kind === "hello") emit("state");
      } else if (viewer && envelope.kind === "state" && !retiredOwners.has(envelope.sender)) {
        const stale = lastStateAt === null || now - lastStateAt >= 6000;
        if (owner && owner !== envelope.sender && lastStateAt !== null && now - lastStateAt < 6000) return;
        if (owner && owner !== envelope.sender) {
          retiredOwners.add(owner);
          if (retiredOwners.size > 32) retiredOwners.delete(retiredOwners.values().next().value);
          ownerRevision = null;
        }
        owner = envelope.sender;
        lastStateAt = now;
        if (ownerRevision !== envelope.revision || stale) {
          ownerRevision = envelope.revision;
          onState(envelope.state, { sentAt: envelope.sentAt, receivedAt: now, clockOffsetMs: now - envelope.sentAt, transport });
        }
      }
      status();
    }).catch(() => {});
  }

  function disconnectChat() {
    chatAttempt++;
    chat?.dispose();
    chat = null;
    onChatStatus("Twitch disconnected");
  }

  async function connectChat(input, allowMods = false) {
    if (viewer || disposed || duplicate) return false;
    disconnectChat();
    const attempt = chatAttempt;
    let modules;
    try { modules = await modulesPromise; } catch { onChatStatus("Twitch connection unavailable"); return false; }
    if (disposed || attempt !== chatAttempt) return false;
    const name = typeof input === "string" ? modules.channelName(input) : undefined;
    if (!name) { onChatStatus("Enter a Twitch channel name or twitch.tv link."); return false; }
    chat = openChat(name, allowMods === true, modules.parseLine);
    return true;
  }

  function openChat(name, allowMods, parseLine) {
    let socket, stopped = false, attempts = 0, buffer = "", joined = false, retry, trafficAt = clock();
    const nickname = "justinfan" + cryptoApi.getRandomValues(new Uint32Array(1))[0];
    const messageIds = new Set();
    function schedule() {
      if (stopped || disposed || retry) return;
      onChatStatus("Twitch disconnected - retrying");
      retry = timers.setTimeout(() => { retry = undefined; open(); }, Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)));
    }
    function open() {
      if (stopped || disposed) return;
      buffer = ""; joined = false; trafficAt = clock();
      onChatStatus("Connecting to Twitch");
      let ws;
      try { ws = socketFactory("wss://irc-ws.chat.twitch.tv:443"); } catch { schedule(); return; }
      socket = ws;
      ws.onopen = () => {
        if (stopped || disposed || socket !== ws) return;
        ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands\r\n");
        ws.send("PASS SCHMOOPIIE\r\n");
        ws.send("NICK " + nickname + "\r\n");
      };
      ws.onmessage = event => {
        if (stopped || disposed || socket !== ws || typeof event.data !== "string") return;
        trafficAt = clock(); buffer += event.data;
        if (buffer.length > 100000) { ws.close(); return; }
        const lines = buffer.split("\r\n"); buffer = lines.pop();
        for (const raw of lines) {
          const line = parseLine(raw);
          if (!line) continue;
          if (line.command === "PING") ws.send("PONG :" + line.text + "\r\n");
          if (line.command === "001") ws.send("JOIN #" + name + "\r\n");
          if ((line.command === "ROOMSTATE" && line.params === "#" + name) || (line.command === "366" && line.params.split(" ").includes("#" + name))) {
            joined = true; attempts = 0; onChatStatus("Twitch connected: " + name);
          }
          if (line.command === "RECONNECT") { ws.close(); continue; }
          if (!joined) continue;
          const action = permittedChatCommand(line, name, allowMods, clock());
          if (action && !messageIds.has(line.tags.id)) {
            messageIds.add(line.tags.id);
            if (messageIds.size > 500) messageIds.delete(messageIds.values().next().value);
            onCommand(action);
          }
        }
      };
      ws.onclose = schedule;
      ws.onerror = () => ws.close();
    }
    const heartbeat = timers.setInterval(() => {
      if (socket?.readyState === 1) {
        if (clock() - trafficAt > 90000) socket.close();
        else socket.send("PING :faith-twists\r\n");
      }
    }, 30000);
    open();
    return { dispose() { stopped = true; timers.clearInterval(heartbeat); if (retry) timers.clearTimeout(retry); if (socket) { socket.onclose = null; socket.close(); } } };
  }

  async function start() {
    try {
      const bytes = Uint8Array.from(key.match(/../g), value => parseInt(value, 16));
      authKeyPromise = cryptoApi.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
      const scopedKey = await sign(NAMESPACE + ":room");
      const digest = await cryptoApi.subtle.digest("SHA-256", encoder.encode(scopedKey));
      const name = NAMESPACE + ":" + [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
      if (disposed) return;
      try {
        channel = broadcastFactory(name);
        if (channel) channel.onmessage = event => ingest(event.data, "local");
      } catch { }
      emit(viewer ? "request" : "hello");
      const modules = await modulesPromise;
      if (disposed) return;
      peer = modules.connectRoom({ role: viewer ? "controls" : "viewer", key: scopedKey, status(value) {
        if (disposed) return;
        peerStatus = value;
        if (!viewer && value === "duplicate") {
          duplicate = true;
          disconnectChat();
        } else if (["waiting", "connected"].includes(value)) duplicate = false;
        status();
      }, ready() { if (!disposed) emit(viewer ? "request" : "state"); }, message(value) { ingest(value, "peer"); } });
      status();
    } catch {
      peerStatus = "offline";
      status();
    }
  }

  const heartbeat = timers.setInterval(() => { if (!disposed) { emit(viewer ? "request" : "state"); status(); } }, 1500);
  void start();
  return {
    sendState(state) {
      if (viewer || disposed || duplicate) return false;
      const safe = cleanSnapshot(state);
      if (!safe) { onStatus("The stream update was too large or invalid. The game is still available here.", { code: "invalid-state" }); return false; }
      latest = safe; revision++;
      emit("state");
      return true;
    },
    requestState() { if (viewer) emit("request"); },
    connectChat,
    disconnectChat,
    dispose() {
      if (disposed) return;
      disposed = true;
      timers.clearInterval(heartbeat);
      chatAttempt++; chat?.dispose(); chat = null;
      try { channel?.close(); } catch { }
      try { peer?.dispose(); } catch { }
    },
  };
}
