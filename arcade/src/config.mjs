import { MODES, validPrices } from "./model.mjs";
const THEME = { pink: "#ce6ca1", lilac: "#bca3e6", gold: "#ffd98c", cream: "#fff2dc", ink: "#512545" };
const PRESETS = { sweet: { ...THEME }, mint: { ...THEME, pink: "#5e9f91", lilac: "#a7cce5", gold: "#ffdf9e" }, royal: { ...THEME, pink: "#9a5c9a", lilac: "#a69bd3", gold: "#f3ca7e" } };
const freshConfig = () => ({ version: 1, stake: "low", profiles: { low: { cash: 10, bonus: 2, spins: 3 }, high: { cash: 50, bonus: 10, spins: 3 } }, theme: { ...THEME }, mode: "surprise", sound: true, volume: 70 });
function validateConfig(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Settings must be an object.");
  const result = freshConfig();
  if (raw.version !== void 0 && raw.version !== 1) throw new Error("This settings version is not supported.");
  if (raw.stake !== void 0 && !["low", "high"].includes(raw.stake)) throw new Error("Choose low or high stakes.");
  result.stake = raw.stake ?? result.stake;
  for (const k of ["low", "high"]) {
    if (raw.profiles?.[k]) {
      if (!validPrices(raw.profiles[k])) throw new Error("Amounts must be whole dollars from 1 to 1,000; starting spins from 1 to 10.");
      result.profiles[k] = { cash: raw.profiles[k].cash, bonus: raw.profiles[k].bonus, spins: raw.profiles[k].spins };
    }
  }
  if (raw.mode !== void 0 && raw.mode !== "surprise" && !MODES[raw.mode]) throw new Error("Unknown scam.");
  result.mode = raw.mode ?? result.mode;
  for (const k of Object.keys(THEME)) {
    if (raw.theme?.[k] !== void 0) {
      if (!/^#[0-9a-f]{6}$/i.test(raw.theme[k])) throw new Error("Theme colours must use six-digit hex values.");
      result.theme[k] = raw.theme[k];
    }
  }
  if (raw.sound !== void 0) result.sound = !!raw.sound;
  if (raw.volume !== void 0) {
    if (!Number.isFinite(raw.volume) || raw.volume < 0 || raw.volume > 100) throw new Error("Volume must be from 0 to 100.");
    result.volume = raw.volume;
  }
  return result;
}
function readConfig(storage) {
  try {
    return validateConfig(JSON.parse(storage.getItem("faith-scam-arcade-v2")));
  } catch {
    return freshConfig();
  }
}
function saveConfig(storage, config) {
  try {
    storage.setItem("faith-scam-arcade-v2", JSON.stringify(validateConfig(config)));
    return true;
  } catch {
    return false;
  }
}
function makeDiscoveryDeck(ids, rng = Math.random) {
  const choices = [...new Set(ids)];
  if (!choices.length) throw new Error("Choose at least one scam.");
  let deck = [], previous;
  return () => {
    if (!deck.length) {
      deck = [...choices];
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      if (deck.length > 1 && deck[0] === previous) [deck[0], deck[1]] = [deck[1], deck[0]];
    }
    previous = deck.shift();
    return previous;
  };
}
export {
  PRESETS,
  THEME,
  freshConfig,
  makeDiscoveryDeck,
  readConfig,
  saveConfig,
  validateConfig
};
