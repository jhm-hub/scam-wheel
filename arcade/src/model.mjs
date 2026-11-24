import { EXTRA_MODES, isExtra, startExtra, extraBoard, landExtra } from "./extended.mjs";
const MODES = {
  ...EXTRA_MODES,
  dice: { name: "Dice Boost", tag: "ONE ROLL. MORE TROUBLE.", rule: "Roll for extra spins. Stack x2 boosts for your next cash hit.", short: "Boosts stack. Cash collects." },
  roulette: { name: "Russian Roulette", tag: "SIX CHAMBERS. ONE WAY OUT.", rule: "Keep adding cash. Stack x2 on the whole bill. EXIT ends the round.", short: "Keep spinning until EXIT." },
  rent: { name: "Rent Free", tag: "CUTE STREET. EXPENSIVE ADDRESS.", rule: "Build where you land. Then pay rent on EVERY property you've built. Revisit to upgrade.", short: "Build one. Pay the whole street." },
  gumball: { name: "Gumball Ransom", tag: "ONE SWEET. A VERY SOUR BILL.", rule: "Every candy costs cash. Collect 3 of one colour and its set bonus joins the bill.", short: "Three of a colour charges the set." }
};
const STREETS = ["ROSE", "LILAC", "PEACH", "CHERRY", "MINT", "GOLD"];
const SWEETS = [{ name: "BERRY", color: "#f09bc6", factor: 8 }, { name: "VIOLET", color: "#bea2ef", factor: 10 }, { name: "MINT", color: "#a3e1d3", factor: 12 }];
const DEFAULTS = { cash: 10, bonus: 2, spins: 3 };
function validPrices(p) {
  return Number.isInteger(p.cash) && p.cash >= 1 && p.cash <= 1e3 && Number.isInteger(p.bonus) && p.bonus >= 1 && p.bonus <= 1e3 && Number.isInteger(p.spins) && p.spins >= 1 && p.spins <= 10;
}
function createRound(mode, prices = DEFAULTS, quick = false, scripted = false) {
  if (!MODES[mode] || !validPrices(prices)) throw new Error("Invalid round settings");
  return { mode, prices: { ...prices }, phase: quick ? "activate" : "normal", normal: 0, quick, scripted, step: 0, spins: prices.spins, mult: 1, total: 0, die: null, ledger: [], last: null, reason: null, rents: Array(6).fill(0), levels: Array(6).fill(0), candies: Array(3).fill(0), sets: 0 };
}
function board(s) {
  if (s.phase === "normal") return [1, 1.2, 0.8, 0.6, 1, 1.5, 0.5, 1, 0.8, 1.2, 0.6, 1].map((k) => ({ kind: "cash", value: Math.max(1, Math.round(s.prices.cash * k)) }));
  if (isExtra(s.mode)) return extraBoard(s);
  if (s.mode === "roulette") return [{ kind: "cash", value: s.prices.cash }, { kind: "cash", value: s.prices.cash }, { kind: "cash", value: s.prices.cash }, { kind: "cash", value: s.prices.cash }, { kind: "total", value: 2 }, { kind: "exit", value: 0 }];
  if (s.mode === "rent") return STREETS.map((name, i) => ({ kind: "rent", name, value: Math.max(1, Math.round(s.prices.cash * (0.5 + 0.5 * (i % 3)))), rent: s.rents[i], level: s.levels[i] }));
  if (s.mode === "gumball") return Array.from({ length: 9 }, (_, i) => ({ kind: "candy", color: i % 3, value: s.prices.cash }));
  return Array.from({ length: 12 }, (_, i) => [2, 5, 8].includes(i) ? { kind: "boost", value: 2 } : [4, 10].includes(i) ? { kind: "bonus", value: s.prices.bonus } : { kind: "cash", value: s.prices.cash });
}
function activate(s, die) {
  if (s.phase !== "activate") throw new Error("Scam is not ready");
  if (s.mode === "dice" && (!Number.isInteger(die) || die < 1 || die > 6)) throw new Error("Invalid die");
  const spins = s.mode === "dice" ? s.prices.spins + die : s.mode === "rent" ? s.prices.spins + 1 : s.mode === "gumball" ? s.prices.spins + 3 : null;
  if (isExtra(s.mode)) return { ...s, ...startExtra(s), phase: "active", step: 0, last: null };
  return { ...s, phase: "active", die: s.mode === "dice" ? die : null, spins, mult: 1, last: null, step: 0 };
}
function choose(s, rng = Math.random) {
  if (s.scripted) {
    if (s.phase === "normal") return [0, 1][s.normal];
    const seq = EXTRA_MODES[s.mode]?.showcase ?? { dice: [0, 2, 5, 8, 1, 4, 3, 2, 6, 7], roulette: [0, 4, 1, 2, 4, 3, 5], rent: [0, 1, 0, 2], gumball: [0, 1, 3, 2, 6, 4] }[s.mode];
    return seq[s.step] ?? 0;
  }
  return Math.min(board(s).length - 1, Math.floor(rng() * board(s).length));
}
function land(s, index, rng = Math.random) {
  if (!["normal", "active"].includes(s.phase)) throw new Error("No spin is pending");
  const item = board(s)[index];
  if (!item) throw new Error("Invalid landing");
  let next = { ...s, step: s.step + 1, ledger: [...s.ledger] }, entry = { kind: item.kind, index, before: s.total, mult: s.mult, amount: 0 };
  if (s.phase === "normal") {
    next.total += item.value;
    next.normal++;
    entry.amount = item.value;
    entry.label = "Opening spin " + next.normal;
    if (next.normal === 2) {
      next.phase = "activate";
      next.step = 0;
    }
  } else if (item.kind === "arcade") {
    const result = landExtra(s, item, index, rng);
    next.data = result.data;
    next.spins = result.spins;
    entry = { ...entry, ...result.entry };
    next.total += entry.amount;
    if (result.complete) {
      next.phase = "complete";
      next.reason = s.mode;
    }
  } else if (item.kind === "rent") {
    next.rents = [...s.rents];
    next.levels = [...s.levels];
    next.rents[index] += item.value;
    next.levels[index]++;
    entry.rents = [...next.rents];
    entry.name = item.name;
    entry.level = next.levels[index];
    entry.previousRent = s.rents[index];
    entry.newRent = next.rents[index];
    entry.amount = next.rents.reduce((a, b) => a + b, 0);
    entry.label = item.name + " " + (entry.level === 1 ? "built" : "upgraded") + " - street rent";
    next.total += entry.amount;
    next.spins--;
    if (next.spins === 0) {
      next.phase = "complete";
      next.reason = "street";
    }
  } else if (item.kind === "candy") {
    next.candies = [...s.candies];
    next.candies[item.color]++;
    entry.color = item.color;
    entry.matched = next.candies[item.color] === 3;
    entry.setBonus = entry.matched ? s.prices.cash * SWEETS[item.color].factor : 0;
    entry.candies = [...next.candies];
    if (entry.matched) {
      next.candies[item.color] = 0;
      next.sets++;
    }
    entry.amount = item.value + entry.setBonus;
    entry.label = SWEETS[item.color].name + (entry.matched ? " trio + candy" : " candy");
    next.total += entry.amount;
    next.spins--;
    if (next.spins === 0) {
      next.phase = "complete";
      next.reason = "sweets";
    }
  } else if (item.kind === "boost" || item.kind === "total") {
    next.mult = Math.min(64, s.mult * 2);
    entry.label = item.kind === "boost" ? "Next cash x" + next.mult : "Ending total x" + next.mult;
  } else if (item.kind === "exit") {
    next.total = s.total * s.mult;
    entry.amount = next.total - s.total;
    entry.label = "Final bill x" + s.mult;
    next.phase = "complete";
    next.reason = "exit";
  } else {
    entry.amount = item.value * (s.mode === "dice" ? s.mult : 1);
    next.total += entry.amount;
    entry.label = item.kind === "bonus" ? "Cash + free spin" : "Cash hit";
    if (s.mode === "dice") {
      next.mult = 1;
      if (item.kind === "cash") next.spins--;
      if (next.spins === 0) {
        next.phase = "complete";
        next.reason = "spins";
      }
    }
  }
  if (next.step >= 60 && next.phase === "active") {
    if (s.mode === "roulette") {
      next.total *= next.mult;
      entry.limitMultiplier = next.mult;
      entry.amount = next.total - s.total;
      entry.label += " - round limit settled";
    }
    next.phase = "complete";
    next.reason = "limit";
  }
  entry.after = next.total;
  entry.base = item.value;
  next.last = entry;
  next.ledger.push(entry);
  return next;
}
export {
  DEFAULTS,
  MODES,
  STREETS,
  SWEETS,
  activate,
  board,
  choose,
  createRound,
  land,
  validPrices
};
