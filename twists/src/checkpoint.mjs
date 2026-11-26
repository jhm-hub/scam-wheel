import { MODES, defaultSettings, normalizeSettings, createRound, activateRound, wheelItems, land } from "./model.mjs";

const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const validMoney = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100000 && Math.abs(value * 100 - Math.round(value * 100)) <= 0.00001;

function validSettings(mode, input) {
  if (!plain(input)) return false;
  return Object.entries(defaultSettings(mode)).every(([key, fallback]) => {
    const value = input[key];
    return Array.isArray(fallback)
      ? Array.isArray(value) && value.length === fallback.length && value.every(validMoney)
      : validMoney(value);
  });
}

export function restoreCheckpoint(saved, expectedMode) {
  if (!plain(saved) || saved.version !== 1 || !Object.hasOwn(MODES, saved.mode)) return null;
  if (expectedMode !== undefined && saved.mode !== expectedMode) return null;
  if (typeof saved.quick !== "boolean" || !["random", "story", "gentle", "big"].includes(saved.scenario)) return null;
  if (!validSettings(saved.mode, saved.settings)) return null;
  const maxActions = MODES[saved.mode].spins + (saved.quick ? 0 : 2);
  if (!Array.isArray(saved.actions) || saved.actions.length === 0 || saved.actions.length > maxActions) return null;
  try {
    let round = createRound(saved.mode, normalizeSettings(saved.mode, saved.settings), { quick: saved.quick, scenario: saved.scenario });
    let previousRound = null, items = wheelItems(round), rotation = 0;
    for (const action of saved.actions) {
      if (!plain(action) || !Number.isInteger(action.index) || !Array.isArray(action.draws) || action.draws.length > 40) return null;
      if (!action.draws.every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1)) return null;
      if (round.phase === "complete") return null;
      if (round.phase === "ready") round = activateRound(round);
      items = wheelItems(round);
      if (action.index < 0 || action.index >= items.length) return null;
      // A legacy Plinko draw stream must not become a different wheel bill.
      const expectedDraws = round.phase === "active" && round.mode === "fall" && round.scenario === "random" && action.index === 3 ? 2 : 0;
      if (action.draws.length !== expectedDraws) return null;
      previousRound = round;
      let cursor = 0;
      round = land(round, action.index, () => {
        if (cursor >= action.draws.length) throw Error("Missing saved random draw");
        return action.draws[cursor++];
      });
      if (round === previousRound || cursor !== action.draws.length) return null;
      // The saved display retains the wheel that produced the landing, even when a
      // giveaway removes a wedge from the next wheel.
      rotation = ((90 - (action.index + 0.5) * 360 / items.length) % 360 + 360) % 360;
    }
    return { round, previousRound, items, rotation, actions: structuredClone(saved.actions) };
  } catch {
    return null;
  }
}
