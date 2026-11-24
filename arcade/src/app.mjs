import { motionClock, sceneTiming } from "./motion.mjs";
import { MODES, SWEETS, DEFAULTS, createRound, validPrices, board, activate, choose, land } from "./model.mjs";
import { EXTRA_MODES, isExtra, extraStatus, startExtra } from "./extended.mjs";
import { THEME, PRESETS, readConfig, saveConfig, validateConfig, makeDiscoveryDeck } from "./config.mjs";
import { makeRenderer, rotationAt } from "./render.mjs";
import { nextRotation, spinTurns, resolveLanding } from "../vendor/model/spin.ts";
import { sliceCenterDeg, sliceAtAngle } from "../vendor/model/geometry.ts";
const $ = (id) => document.getElementById(id), canvas = $("game"), renderer = makeRenderer(canvas);
const params = new URLSearchParams(location.search), viewer = params.get("view") === "stream", room = params.get("room") || crypto.randomUUID();
if (!viewer && !params.has("room")) {
  const url = new URL(location.href);
  url.searchParams.set("room", room);
  try {
    history.replaceState(null, "", url);
  } catch {
  }
}
document.body.classList.toggle("viewer", viewer);
if (viewer) document.documentElement.style.background = "transparent";
const reduced = matchMedia("(prefers-reduced-motion:reduce)").matches;
let channel = null;
try {
  if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel("faith-scam-duo-v1-" + room);
} catch {
}
let config;
try {
  config = readConfig(localStorage);
} catch {
  config = readConfig({ getItem: () => null });
}
let selectedMode = MODES[params.get("mode")] ? params.get("mode") : config.mode;
let epoch = 0, ready = false, auto = false, sound = config.sound, audio, viewWindow, prices = { ...config.profiles[config.stake] }, lastTick = 0, lastSector = -1;
const orderedModes = ["dice", "roulette", "rent", "gumball", ...Object.keys(EXTRA_MODES)];
$("mode-select").add(new Option("Surprise me - discover together", "surprise"));
for (const mode of orderedModes) {
  $("mode-select").add(new Option(MODES[mode].name, mode));
  const button = document.createElement("button");
  button.className = "mode";
  button.dataset.mode = mode;
  button.textContent = MODES[mode].name;
  button.title = MODES[mode].rule;
  $("mode-cards").append(button);
}
const nextMystery = makeDiscoveryDeck(orderedModes, () => random());
function persist() {
  config.sound = sound;
  config.mode = selectedMode;
  config.profiles[config.stake] = { ...prices };
  let saved = false;
  try {
    saved = saveConfig(localStorage, config);
  } catch {
  }
  $("save-status").textContent = saved ? "Saved in this browser. Save a settings file to move browsers." : "Browser storage unavailable. Save a settings file to keep changes.";
}
function configFields() {
  for (const key of ["cash", "bonus", "spins"]) $(key).value = prices[key];
  for (const key of ["pink", "lilac", "gold"]) $("theme-" + key).value = config.theme[key];
  $("volume").value = config.volume;
  $("theme-preset").value = Object.keys(PRESETS).find((k) => JSON.stringify(PRESETS[k]) === JSON.stringify(config.theme)) || "custom";
  $("sound").textContent = sound ? "Sound on" : "Sound off";
  $("sound").setAttribute("aria-pressed", String(sound));
  document.documentElement.style.setProperty("--wheel-pink", config.theme.pink);
  document.documentElement.style.setProperty("--wheel-lilac", config.theme.lilac);
}
configFields();
const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const money = (n) => "$" + n.toLocaleString("en-US");
function initial(mode = selectedMode, scripted = false) {
  const round = createRound(mode === "surprise" ? "dice" : mode, prices, $("quick").checked, scripted);
  round.mystery = mode === "surprise";
  round.revealed = false;
  return { round, items: board({ ...round, phase: "normal" }), scene: "normal", rotation: 0, motion: null, selected: null, selection: null, overlay: null, effect: null, busy: false, reduced, theme: { ...config.theme }, transformAt: 0, previousScene: null, hudAt: 0, tickAt: 0, waiting: viewer, status: "", error: null };
}
let state = initial();
function tone(freq, len = 0.09, type = "triangle", volume = 0.025, delay = 0) {
  if (!sound || viewer || !audio) return;
  const token = epoch;
  setTimeout(() => {
    if (token !== epoch || !sound || !audio) return;
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(1e-4, t);
    g.gain.linearRampToValueAtTime(Math.max(1e-4, volume * config.volume / 100), t + 8e-3);
    g.gain.exponentialRampToValueAtTime(1e-4, t + len);
    o.connect(g);
    g.connect(audio.destination);
    o.start(t);
    o.stop(t + len + 0.02);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }, delay);
}
function soundFor(kind) {
  const notes = { intro: [392, 523, 659, 784, 1047], cash: [659, 784, 1047], boost: [523, 659, 880, 1047], bonus: [659, 523, 784, 1047], exit: [196, 147, 98], final: [523, 659, 784, 1047, 1319, 1568] };
  const ns = notes[kind] || notes.cash;
  ns.forEach((n, i) => tone(n, kind === "exit" ? 0.22 : 0.16, kind === "boost" ? "square" : "triangle", kind === "boost" ? 0.014 : 0.025, i * (kind === "final" ? 95 : 80)));
}
async function unlockSound() {
  if (!sound || viewer) return;
  try {
    audio ??= new AudioContext();
    await audio.resume();
  } catch {
  }
}
function publish() {
  if (viewer) return;
  const message = { type: "state", state, room };
  channel?.postMessage(message);
  if (viewWindow && !viewWindow.closed) viewWindow.postMessage(message, location.protocol === "file:" ? "*" : location.origin);
}
channel?.addEventListener("message", (e) => {
  if (e.data?.room !== room) return;
  if (e.data.type === "request" && !viewer) publish();
  if (e.data.type === "state" && viewer) {
    state = { ...e.data.state, waiting: false, reduced };
    ui();
  }
});
window.addEventListener("message", (e) => {
  if (e.data?.room !== room) return;
  if (viewer && e.source === window.opener && e.data.type === "state") {
    state = { ...e.data.state, waiting: false, reduced };
    ui();
  }
  if (!viewer && e.source === viewWindow && e.data.type === "request") publish();
});
function requestState() {
  channel?.postMessage({ type: "request", room });
  if (window.opener) window.opener.postMessage({ type: "request", room }, location.protocol === "file:" ? "*" : location.origin);
}
if (viewer) {
  requestState();
  setInterval(() => {
    if (state.waiting) requestState();
  }, 1e3);
}
document.addEventListener("visibilitychange", () => {
  if (viewer && !document.hidden) requestState();
});
function caption() {
  const r = state.round;
  if (state.error) return state.error;
  if (state.busy) return state.status || "Let it roll\u2026";
  if (r.phase === "complete") return r.reason === "limit" ? "Round limit reached. Your bill is settled." : "Round complete. Play again for a new result.";
  if (r.phase === "normal") return "Opening spin " + (r.normal + 1) + " of 2.";
  if (r.phase === "activate") return r.mystery ? "The next spin reveals your mystery scam." : "The next spin activates " + MODES[r.mode].name + ".";
  if (isExtra(r.mode)) return (r.spins === null ? "Keep spinning. " : r.spins + " spins left. ") + MODES[r.mode].short;
  if (r.mode === "rent") return r.spins + " spins left. Build one property, then pay the whole street.";
  if (r.mode === "gumball") return r.spins + " candies left. Match three of a colour for a set bonus.";
  return r.mode === "dice" ? r.spins + " cash spins left. " + (r.mult > 1 ? "Next cash pays \xD7" + r.mult + "." : "Keep the bonuses coming.") : "Still in. Spin again to find EXIT.";
}
function ui() {
  canvas.dataset.mode = state.round.mode;
  canvas.dataset.phase = state.round.phase;
  canvas.dataset.scene = state.scene;
  canvas.dataset.total = state.round.total;
  canvas.dataset.multiplier = state.round.mult;
  canvas.dataset.spins = state.round.spins;
  canvas.dataset.overlay = state.overlay?.kind || "none";
  canvas.dataset.busy = state.busy;
  canvas.dataset.scripted = state.round.scripted;
  canvas.setAttribute("aria-label", (state.round.mystery && !state.round.revealed ? "Mystery scam" : MODES[state.round.mode].name) + ". " + caption() + " Total " + money(state.round.total));
  if (viewer) return;
  const r = state.round, hidden = r.mystery && !r.revealed;
  $("mode-select").value = selectedMode;
  $("mode-select").disabled = state.busy || auto;
  $("stakes-low").setAttribute("aria-pressed", String(config.stake === "low"));
  $("stakes-high").setAttribute("aria-pressed", String(config.stake === "high"));
  $("stakes-low").disabled = $("stakes-high").disabled = state.busy || auto;
  $("stakes-summary").textContent = (config.stake === "low" ? "LOW" : "HIGH") + " STAKES / $" + prices.cash + " cash / $" + prices.bonus + " bonus / " + prices.spins + " base spins";
  $("autoplay").disabled = !ready || auto && r.scripted || state.busy && !auto;
  $("autoplay").textContent = auto && !r.scripted ? "Pause after spin" : "Play random round";
  $("appearance").querySelectorAll("input,button,select").forEach((el) => el.disabled = state.busy || auto);
  document.querySelectorAll(".mode").forEach((b) => {
    b.disabled = state.busy || auto;
    b.classList.toggle("active", b.dataset.mode === selectedMode);
    b.setAttribute("aria-pressed", String(b.dataset.mode === selectedMode));
  });
  $("mode-tag").textContent = hidden ? "DISCOVER THE SCAM TOGETHER" : MODES[r.mode].tag;
  $("rule").textContent = hidden ? "Two normal spins. Then one of 20 scams transforms the wheel. Every scam appears before the mystery bag repeats." : MODES[r.mode].rule;
  $("total").textContent = money(r.total);
  $("power-label").textContent = { dice: "NEXT CASH", roulette: "ENDING TOTAL", rent: "STREET RENT", gumball: "SETS CHARGED" }[r.mode];
  $("power").textContent = r.mode === "rent" ? money(r.rents.reduce((a, b) => a + b, 0)) : r.mode === "gumball" ? String(r.sets) : "\xD7" + r.mult;
  if (isExtra(r.mode) && !hidden) {
    const [label, value] = extraStatus(r);
    $("power-label").textContent = label;
    $("power").textContent = value;
  }
  if (hidden) {
    $("power-label").textContent = "MYSTERY SCAM";
    $("power").textContent = "?";
  }
  $("inspect-result").hidden = r.phase !== "complete" || state.busy;
  $("inspect-result").textContent = state.overlay?.kind === "final" ? "See final wheel" : "Show final bill";
  $("status").textContent = caption();
  $("spin").disabled = state.busy || auto || !ready;
  $("spin").replaceChildren(document.createTextNode(r.phase === "complete" ? "Play again" : r.scripted ? "Next demo spin" : "Spin"));
  const key = document.createElement("span");
  key.textContent = "SPACE";
  $("spin").append(key);
  $("showcase").disabled = !ready || auto && !r.scripted || state.busy && !auto;
  $("showcase").textContent = auto && r.scripted ? "\u2161 Pause after spin" : r.scripted && r.phase !== "complete" ? "\u25B6 Resume showcase" : "\u25B6 Play showcase";
  $("quick").disabled = state.busy || auto;
  $("demo-note").textContent = r.scripted ? "SCRIPTED SHOWCASE \xB7 A planned bonus chain so you can see every effect. Reset to return to random spins." : "Showcase plays a scripted bonus chain automatically. Spin gives random results.";
  $("demo-note").classList.toggle("scripted", r.scripted);
  $("progress").style.display = r.quick ? "none" : "flex";
  ["step1", "step2", "step3"].forEach((id, i) => {
    $(id).className = i < 2 ? r.normal > i ? "done" : r.normal === i && r.phase === "normal" ? "current" : "" : r.phase === "complete" ? "done" : r.phase !== "normal" ? "current" : "";
  });
  $("settings").querySelectorAll("input,button").forEach((el) => el.disabled = state.busy || auto);
  const ledger = $("ledger");
  ledger.replaceChildren();
  r.ledger.forEach((e, i) => {
    const li = document.createElement("li"), label = document.createElement("span"), value = document.createElement("strong");
    label.textContent = i + 1 + ". " + e.label;
    value.textContent = e.kind === "arcade" ? money(e.amount) : e.kind === "exit" ? money(e.before) + " \u2192 " + money(e.after) : e.amount ? "+" + money(e.amount) : "\xD7" + Math.min(64, e.mult * 2);
    if (e.lines?.length) {
      const detail = document.createElement("small");
      detail.textContent = e.lines.map((v) => v.label + ": " + money(v.value)).join(" + ");
      label.append(detail);
    }
    li.append(label, value);
    ledger.append(li);
  });
  $("history-count").textContent = r.ledger.length;
  $("mode-settings-note").textContent = hidden ? "These base amounts and spins apply to whichever scam is revealed. Its live counter shows the resulting round length or target." : isExtra(r.mode) ? "Cash and bonus amounts scale this scam. Base spins set its round length, target distance or boss health. Its live counter shows the resulting limit." : r.mode === "rent" ? "Rent Free uses starting spins + 1. Cash sets the three rent tiers: half cash, cash, and one-and-a-half cash. Bonus cash is unused." : r.mode === "gumball" ? "Gumball Ransom uses starting spins + 3 draws. Every candy costs the cash amount; Berry/Violet/Mint trios add 8x/10x/12x cash. Bonus cash is unused." : "Dice Boost adds the die roll to starting spins. Russian Roulette ends only at EXIT. Boosts stop at x64; 60 landings settles either round.";
  publish();
}
function reset(mode = selectedMode, scripted = false) {
  selectedMode = mode;
  try {
    const url = new URL(location.href);
    url.searchParams.set("mode", mode);
    history.replaceState(null, "", url);
  } catch {
  }
  epoch++;
  reviewFrames = [];
  auto = false;
  state = initial(mode, scripted);
  lastSector = -1;
  persist();
  ui();
}
const ms = (n) => reduced ? Math.min(n, 350) : n;
function wait(n, token) {
  return new Promise((resolve, reject) => setTimeout(() => token === epoch ? resolve() : reject(new Error("cancelled")), n));
}
async function dismissOverlay(token) {
  if (!state.overlay) return;
  state.overlay = { ...state.overlay, exitAt: motionClock() };
  publish();
  await wait(reduced ? 80 : 240, token);
  state.overlay = null;
}
function popup(title, main, sub, accent) {
  state.overlay = { kind: "popup", title, main, sub, accent, at: motionClock() };
  ui();
}
function burst(kind) {
  state.effect = { kind, at: motionClock(), seed: state.round.ledger.length };
  publish();
}
async function activateScam(token) {
  if (state.round.mystery && !state.round.revealed) {
    state.round = { ...state.round, mode: nextMystery(), revealed: true };
  }
  const mode = state.round.mode;
  state.overlay = { kind: "intro", name: MODES[mode].name, at: motionClock() };
  state.status = "Scam activated.";
  soundFor("intro");
  ui();
  await wait(1500, token);
  await dismissOverlay(token);
  state.previousScene = { ...state, motion: null, overlay: null, effect: null, previousScene: null };
  state.scene = mode;
  state.items = board({ ...state.round, ...isExtra(mode) ? startExtra(state.round) : {}, phase: "active" });
  state.transformAt = motionClock();
  state.rotation = 0;
  state.selected = null;
  state.selection = null;
  if (mode === "dice") {
    const die = state.round.scripted ? 2 : 1 + Math.floor(random() * 6), rollTime = ms(1450);
    state.overlay = { kind: "die", value: die, start: state.round.prices.spins, rollTime, at: motionClock() };
    state.status = "Rolling the bonus die\u2026";
    ui();
    if (!reduced) for (let i = 0; i < 10; i++) tone(250 + i % 4 * 95, 0.05, "square", 0.011, i * 140);
    await wait(1450, token);
    state.round = activate(state.round, die);
    state.hudAt = motionClock();
    burst("bonus");
    soundFor("bonus");
    ui();
    await wait(1250, token);
  } else {
    state.round = activate(state.round);
    state.overlay = null;
    state.status = MODES[mode].short;
    soundFor("boost");
    ui();
    await wait(1050, token);
  }
  await dismissOverlay(token);
  ui();
}
async function runStep() {
  if (viewer || state.busy || !ready) return;
  const token = epoch;
  state.busy = true;
  state.error = null;
  state.overlay = null;
  state.effect = null;
  if (state.selection) state.selection = { ...state.selection, exitAt: motionClock() };
  state.selected = null;
  state.status = "Here we go\u2026";
  ui();
  try {
    await unlockSound();
    if (token !== epoch) return;
    if (state.round.phase === "activate") await activateScam(token);
    const r = state.round, items = board(r), n = items.length, index = choose(r, random);
    state.items = items;
    const layout = items.map((_, i) => ({ index: i, startTurn: i / n, sizeTurn: 1 / n }));
    const center = sliceCenterDeg(layout[index]), rest = center + (r.scripted ? 0 : (random() - 0.5) * (360 / n) * 0.35);
    const landing = resolveLanding(layout, rest, { magnetism: false, seamBandDeg: 0 });
    if (landing.kind !== "winner" || landing.slice !== index) throw new Error("Landing does not match the slice");
    const target = nextRotation(state.rotation, landing.restAngle, spinTurns(0.3));
    state.motion = { from: state.rotation, to: target, at: motionClock(), duration: ms(5600) };
    state.status = r.phase === "normal" ? "Opening spin " + (r.normal + 1) + "\u2026" : r.mode === "dice" ? "Watch the next cash boost\u2026" : r.mode === "rent" ? "Where are we building?" : r.mode === "gumball" ? "Which sweet joins the collection?" : isExtra(r.mode) ? MODES[r.mode].short : "Cash, multiplier\u2026 or EXIT?";
    ui();
    await wait(ms(5600), token);
    state.rotation = target;
    state.motion = null;
    state.selected = index;
    state.selection = { index, at: motionClock() };
    const actual = sliceAtAngle(layout, ((90 - target) % 360 + 360) % 360);
    canvas.dataset.landed = String(index);
    canvas.dataset.pointer = String(actual);
    canvas.dataset.rotation = String(target);
    if (actual !== index) throw new Error("Pointer did not reach the result");
    state.round = land(r, index, random);
    state.settledAt = motionClock();
    const e = state.round.last;
    state.hudAt = motionClock();
    if (e.kind === "arcade") {
      state.items = board(state.round);
      state.overlay = { kind: "arcade", entry: e, at: motionClock() };
      state.status = e.headline + " " + e.detail;
      ui();
      const timing = sceneTiming(r.mode, e);
      await wait(timing.reveal, token);
      soundFor(e.amount > r.prices.cash * 3 ? "bonus" : "cash");
      burst(e.amount > r.prices.cash * 3 ? "bonus" : "cash");
      await wait(timing.duration - timing.reveal, token);
    } else if (e.kind === "rent") {
      state.items = board(state.round);
      soundFor("bonus");
      burst("bonus");
      state.overlay = { kind: "property", entry: e, at: motionClock() };
      state.status = e.name + " " + (e.level === 1 ? "built" : "upgraded") + ". Now collecting the whole street.";
      ui();
      await wait(1400, token);
      await dismissOverlay(token);
      state.overlay = { kind: "rent", entry: e, at: motionClock() };
      soundFor("cash");
      ui();
      await wait(2700, token);
    } else if (e.kind === "candy") {
      state.overlay = { kind: "candy", entry: e, at: motionClock() };
      soundFor("cash");
      state.status = SWEETS[e.color].name + " candy: +" + money(e.base) + ".";
      ui();
      await wait(1600, token);
      if (e.matched) {
        await dismissOverlay(token);
        state.overlay = { kind: "match", entry: e, at: motionClock() };
        burst("final");
        soundFor("final");
        state.status = "Three " + SWEETS[e.color].name.toLowerCase() + " candies! Set bonus +" + money(e.setBonus) + ".";
        ui();
        await wait(2300, token);
      }
    } else if (e.kind === "boost" || e.kind === "total") {
      soundFor("boost");
      burst("boost");
      popup(e.kind === "boost" ? "BOOST STACKED" : "ENDING MULTIPLIER", "\xD7" + state.round.mult, e.kind === "boost" ? "Next cash hit \xB7 this spin is free" : "Applied to the whole bill at EXIT", "#e7c6ff");
      state.status = e.kind === "boost" ? "Next cash pays \xD7" + state.round.mult + ". No spin used." : "Ending multiplier is now \xD7" + state.round.mult + ".";
      ui();
      await wait(1650, token);
    } else if (e.kind === "exit") {
      soundFor("exit");
      burst("exit");
      state.overlay = { kind: "exit", at: motionClock() };
      state.status = "EXIT! Time to settle the bill.";
      ui();
      await wait(1700, token);
      await dismissOverlay(token);
      state.overlay = { kind: "math", before: e.before, after: e.after, mult: r.mult, at: motionClock() };
      soundFor("boost");
      burst("final");
      ui();
      await wait(2e3, token);
    } else {
      soundFor(e.kind === "bonus" ? "bonus" : "cash");
      burst(e.kind);
      const sub = r.phase === "normal" ? "Added to the round total" : r.mode === "dice" && e.mult > 1 ? money(e.base) + " \xD7 " + e.mult + (e.kind === "bonus" ? " \xB7 +1 free spin" : " \xB7 boost collected") : e.kind === "bonus" ? "Cash collected \xB7 spin replaced" : "Added to the bill";
      popup(e.kind === "bonus" ? "CASH + FREE SPIN" : e.mult > 1 && r.mode === "dice" ? "BOOST COLLECTED" : "CASH HIT", "+" + money(e.amount), sub);
      state.status = sub;
      ui();
      await wait(e.mult > 1 ? 1800 : 1350, token);
    }
    await dismissOverlay(token);
    if (state.round.phase === "complete") {
      state.overlay = { kind: "final", detail: state.round.reason === "limit" ? "Round limit reached - charges settled" : isExtra(state.round.mode) ? state.round.step + " spins - every charge shown in round history" : state.round.mode === "rent" ? state.round.step + " spins - rent charged after every build" : state.round.mode === "gumball" ? state.round.step + " candies + " + state.round.sets + " set bonuses" : state.round.mode === "dice" ? state.round.ledger.length + " landings \xB7 every cash hit counted" : money(e.before) + " \xD7 " + r.mult + " = " + money(state.round.total), at: motionClock() };
      burst("final");
      soundFor("final");
    } else state.overlay = null;
    state.busy = false;
    ui();
  } catch (err) {
    if (token !== epoch) return;
    auto = false;
    state.busy = false;
    state.motion = null;
    state.error = "The demo hit an error. Reset to start a fresh round.";
    console.error(err);
    ui();
  }
}
async function playShowcase(scripted = true) {
  if (auto) {
    auto = false;
    ui();
    return;
  }
  if (state.busy || !ready) return;
  if (state.round.scripted !== scripted || state.round.phase === "complete") reset(selectedMode, scripted);
  auto = true;
  const token = epoch;
  ui();
  while (auto && token === epoch && state.round.phase !== "complete" && !state.error) {
    await runStep();
    if (token !== epoch) return;
    if (auto && state.round.phase !== "complete") {
      try {
        await wait(600, token);
      } catch {
        return;
      }
    }
  }
  if (token === epoch) {
    auto = false;
    ui();
  }
}
$("inspect-result").addEventListener("click", () => {
  if (state.overlay?.kind === "final") {
    state.finalOverlay = state.overlay;
    state.overlay = null;
  } else state.overlay = state.finalOverlay;
  ui();
});
$("spin").addEventListener("click", () => {
  if (state.round.phase === "complete") reset();
  runStep();
});
$("showcase").addEventListener("click", () => playShowcase(true));
$("autoplay").addEventListener("click", () => playShowcase(false));
$("reset").addEventListener("click", () => reset());
document.querySelectorAll(".mode").forEach((b) => b.addEventListener("click", () => {
  $("mode-select").value = b.dataset.mode;
  reset(b.dataset.mode);
  $("mode-cards").closest("details").open = false;
}));
$("quick").addEventListener("change", () => reset());
$("sound").addEventListener("click", () => {
  sound = !sound;
  $("sound").textContent = sound ? "Sound on" : "Sound off";
  $("sound").setAttribute("aria-pressed", String(sound));
  if (sound) unlockSound();
  persist();
});
$("apply").addEventListener("click", () => {
  const next = { cash: Number($("cash").value), bonus: Number($("bonus").value), spins: Number($("spins").value) };
  if (!validPrices(next)) {
    $("settings-error").textContent = "Use whole dollar amounts from 1 to 1,000, and 1\u201310 starting spins.";
    return;
  }
  prices = next;
  $("settings-error").textContent = "Settings applied.";
  reset();
});
$("mode-select").addEventListener("change", () => reset($("mode-select").value));
for (const stake of ["low", "high"]) $("stakes-" + stake).addEventListener("click", () => {
  if (config.stake === stake) return;
  config.profiles[config.stake] = { ...prices };
  config.stake = stake;
  prices = { ...config.profiles[stake] };
  configFields();
  reset();
});
function applyTheme() {
  state.theme = { ...config.theme };
  configFields();
  persist();
  publish();
}
$("theme-preset").addEventListener("change", () => {
  if (PRESETS[$("theme-preset").value]) {
    config.theme = { ...PRESETS[$("theme-preset").value] };
    applyTheme();
  }
});
for (const k of ["pink", "lilac", "gold"]) $("theme-" + k).addEventListener("input", () => {
  config.theme[k] = $("theme-" + k).value;
  applyTheme();
});
$("volume").addEventListener("input", () => {
  config.volume = Number($("volume").value);
  persist();
});
$("export-settings").addEventListener("click", () => {
  persist();
  const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: "application/json" })), a = document.createElement("a");
  a.href = url;
  a.download = "faith-scam-wheel-settings.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
});
$("import-settings").addEventListener("click", () => $("settings-file").click());
$("settings-file").addEventListener("change", async () => {
  const file = $("settings-file").files[0];
  if (!file) return;
  try {
    if (file.size > 1e5) throw new Error("Settings file is too large.");
    const next = validateConfig(JSON.parse(await file.text()));
    if (state.busy || auto) throw new Error("Finish the spin before loading settings.");
    config = next;
    prices = { ...config.profiles[config.stake] };
    selectedMode = config.mode;
    sound = config.sound;
    configFields();
    reset();
    $("save-status").textContent = "Settings loaded and saved.";
  } catch (e) {
    $("save-status").textContent = "Could not load settings: " + e.message;
  } finally {
    $("settings-file").value = "";
  }
});
$("viewer").addEventListener("click", () => {
  const url = new URL(location.href);
  url.searchParams.set("view", "stream");
  url.searchParams.set("room", room);
  url.searchParams.set("mode", state.round.mode);
  viewWindow = window.open(url.href, "faith-scam-clean-" + room);
  if (!viewWindow) {
    $("status").textContent = "Allow this page to open a window for the clean view.";
    return;
  }
  publish();
});
window.addEventListener("keydown", (e) => {
  if (viewer || auto || e.repeat || e.code !== "Space" || ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "SUMMARY"].includes(document.activeElement?.tagName)) return;
  e.preventDefault();
  if (!state.busy) {
    if (state.round.phase === "complete") reset();
    runStep();
  }
});
let frameStart = motionClock(), previousFrame = null, samples = [], drawSamples = [], reviewFrames = [];
const percentile = (values, p) => values.length ? [...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))] : 0;
function frame() {
  const start = performance.now(), t = motionClock();
  if (!document.hidden && previousFrame !== null) {
    const delta = start - previousFrame;
    samples.push(delta);
    if (state.busy) reviewFrames.push(delta);
  }
  previousFrame = document.hidden ? null : start;
  if (state.motion) {
    const angle = rotationAt(state, t), sector = Math.floor(((90 - angle) % 360 + 360) % 360 / (360 / state.items.length));
    if (sector !== lastSector) {
      lastSector = sector;
      state.tickAt = t;
      if (!reduced && t - lastTick > 65) {
        tone(650 + sector % 4 * 40, 0.025, "triangle", 0.013);
        lastTick = t;
      }
    }
  }
  renderer.draw(state, t);
  if (!document.hidden) drawSamples.push(performance.now() - start);
  if (t - frameStart >= 1000) {
    canvas.dataset.fps = String(Math.round(samples.length * 1000 / Math.max(1, samples.reduce((a,b)=>a+b,0))));
    canvas.dataset.frameP95 = percentile(samples,0.95).toFixed(2);
    canvas.dataset.drawP95 = percentile(drawSamples,0.95).toFixed(2);
    canvas.dataset.roundFrameP95 = percentile(reviewFrames,0.95).toFixed(2);
    canvas.dataset.roundFrames = String(reviewFrames.length);
    canvas.dataset.longFrames = String(reviewFrames.filter(n=>n>50).length);
    samples=[];drawSamples=[];frameStart=t;
  }
  requestAnimationFrame(frame);
}
document.fonts.ready.then(() => {
  ready = true;
  ui();
  requestAnimationFrame(frame);
});
ui();
