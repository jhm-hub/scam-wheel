import test from "node:test";
import assert from "node:assert/strict";
import { MODES, SETTINGS_FIELDS, defaultSettings, normalizeSettings, createRound, activateRound, wheelItems, chooseIndex, land, money, roundStatus } from "../src/model.mjs";

const modes = Object.keys(MODES);
const storyTotals = { bin: 50, sticky: 40, cutting: 60, rent: 35, seats: 60, baggage: 50, refund: 40, fall: 90 };
const limits = { bin: [6, 50], sticky: [0, 40], cutting: [40, 60], rent: [0, 85], seats: [0, 150], baggage: [4, 100], refund: [20, 60], fall: [30, 180] };
const fixedRng = () => 0.37;
const cents = (amount) => Math.round(amount * 100);

function active(mode, settings, scenario = "random") {
  return activateRound(createRound(mode, settings, { quick: true, scenario }));
}

function finish(mode, scenario = "story", settings, quick = true) {
  let round = createRound(mode, settings, { quick, scenario });
  const states = [round];
  let presses = 0;
  while (round.phase !== "complete") {
    if (round.phase === "ready") round = activateRound(round);
    round = land(round, chooseIndex(round, fixedRng), fixedRng);
    states.push(round);
    presses++;
    assert.ok(presses <= MODES[mode].spins + (quick ? 0 : 2));
  }
  return { round, states, presses };
}

function routes(mode, visit) {
  function walk(round, choices) {
    if (round.phase === "complete") return visit(round, choices);
    for (let index = 0; index < wheelItems(round).length; index++) walk(land(round, index, fixedRng), [...choices, wheelItems(round)[index].id]);
  }
  walk(active(mode), []);
}

test("all eight approved story routes preserve the opening bank and stop on the specified press", () => {
  for (const mode of modes) {
    const { round, presses } = finish(mode, "story", undefined, false);
    assert.equal(round.scam, storyTotals[mode], mode);
    assert.equal(round.opening, 20, mode);
    assert.equal(round.total, 20 + storyTotals[mode], mode);
    assert.equal(presses, MODES[mode].spins + 2, mode);
    assert.equal(round.step, MODES[mode].spins);
    assert.equal(round.normalStep, 2);
    assert.equal(round.total, round.ledger.reduce((total, entry) => total + entry.amount, 0));
    assert.match(roundStatus(round), /Round complete/);
  }
});

test("activation is separate from settlement and the third press can perform the first scam landing", () => {
  let round = createRound("bin");
  round = land(round, 0);
  assert.equal(round.phase, "normal");
  round = land(round, 4);
  assert.equal(round.phase, "ready");
  assert.equal(round.step, 0);
  assert.equal(round.opening, 20);
  assert.strictEqual(land(round, 0), round);
  round = activateRound(round);
  assert.equal(round.phase, "active");
  assert.equal(round.step, 0);
  round = land(round, 0);
  assert.equal(round.step, 1);
  assert.equal(round.data.removed.length, 1);
  assert.equal(round.opening, 20);
});

test("completed rounds cannot charge twice and invalid landings cannot advance a round", () => {
  for (const mode of modes) {
    const start = active(mode);
    for (const invalid of [-1, 0.5, NaN, Infinity, "0", 999]) assert.strictEqual(land(start, invalid), start);
    assert.strictEqual(activateRound(start), start);
    const { round } = finish(mode);
    assert.strictEqual(land(round, 0), round);
    assert.strictEqual(activateRound(round), round);
  }
});

test("quotes settle only once, except actual rent charged each turn", () => {
  for (const mode of modes) {
    const { round, states } = finish(mode);
    const activeStates = states.filter((state) => state.phase === "active");
    if (mode !== "rent") {
      for (const state of activeStates) {
        assert.equal(state.scam, 0, mode);
        assert.equal(state.ledger.length, 0, mode);
      }
      assert.equal(round.ledger.length, 1, mode);
      assert.equal(round.scam, round.quote, mode);
    } else {
      assert.deepEqual(round.ledger.map((entry) => entry.amount), [0, 5, 10, 20]);
      assert.equal(round.ledger.length, 4);
    }
  }
});

test("round transitions do not mutate settings, previous state or effect snapshots", () => {
  for (const mode of modes) {
    const settings = defaultSettings(mode), settingsBefore = structuredClone(settings);
    let round = active(mode, settings, "story");
    const initial = structuredClone(round);
    const next = land(round, chooseIndex(round, fixedRng), fixedRng);
    assert.deepEqual(round, initial, mode);
    assert.deepEqual(settings, settingsBefore, mode);
    assert.deepEqual(next.last.beforeData, round.data, mode);
    assert.deepEqual(next.last.afterData, next.data, mode);
    const snapshot = structuredClone(next);
    round = land(next, chooseIndex(next, fixedRng), fixedRng);
    assert.deepEqual(next, snapshot, mode);
    assert.notStrictEqual(round.data, next.data);
  }
});

test("Bargain Bin exhaustively removes unique gifts and charges exactly the two left", () => {
  const totals = [], prices = defaultSettings("bin").prices;
  routes("bin", (round, picks) => {
    assert.equal(new Set(picks).size, 4);
    assert.equal(round.data.remaining.length, 2);
    assert.equal(round.scam, round.data.remaining.reduce((sum, id) => sum + prices[id], 0));
    assert.equal(round.data.removed.length, 4);
    assert.equal(round.data.revealed, true);
    totals.push(round.scam);
  });
  assert.equal(totals.length, 360);
  assert.deepEqual([Math.min(...totals), Math.max(...totals)], limits.bin);
});

test("Bargain Bin guided routes resolve gift identities after wheel shrink and edited pricing", () => {
  const settings = { prices: [60, 50, 40, 30, 20, 10] };
  const gentle = finish("bin", "gentle", settings).round;
  const big = finish("bin", "big", settings).round;
  assert.deepEqual(gentle.data.removed, [0, 1, 2, 3]);
  assert.equal(gentle.scam, 30);
  assert.deepEqual(big.data.removed, [5, 4, 3, 2]);
  assert.equal(big.scam, 110);
});

test("Sticky Fingers exhaustively charges connected members once and excludes the free anchor", () => {
  const totals = [];
  routes("sticky", (round, picks) => {
    const groups = picks.slice(0, 2).map((start) => new Set([start, (start + 1) % 6, (start + 2) % 6]));
    let group = new Set([picks[2]]);
    for (let pass = 0; pass < 2; pass++) {
      for (const linked of groups) if ([...linked].some((id) => group.has(id))) group = new Set([...group, ...linked]);
    }
    assert.equal(round.scam, (group.size - 1) * 10);
    assert.ok(!round.data.paid.includes(picks[2]));
    assert.equal(new Set(round.data.paid).size, round.data.paid.length);
    assert.deepEqual(round.data.connected, [...group].sort((a, b) => a - b));
    totals.push(round.scam);
  });
  assert.equal(totals.length, 216);
  assert.deepEqual([Math.min(...totals), Math.max(...totals)], limits.sticky);
});

test("ribbons wrap F to A, overlap transitively and identical ribbons never double bill", () => {
  let round = active("sticky");
  for (const pick of [5, 1, 0]) round = land(round, pick);
  assert.deepEqual(round.data.links, [[5, 0, 1], [1, 2, 3]]);
  assert.deepEqual(round.data.paid, [1, 2, 3, 5]);
  assert.equal(round.scam, 40);
  round = active("sticky");
  for (const pick of [0, 0, 1]) round = land(round, pick);
  assert.equal(round.scam, 20);
  round = active("sticky");
  for (const pick of [0, 3, 4]) round = land(round, pick);
  assert.equal(round.scam, 20);
});

test("Cutting Costs enumerates legal final bills and empty pots really stay safe", () => {
  const totals = [];
  routes("cutting", (round) => {
    assert.ok(round.data.pots.every((amount) => amount >= 0));
    assert.equal(round.scam, round.data.pots.reduce((sum, price) => sum + price, 0));
    totals.push(round.scam);
  });
  assert.equal(totals.length, 27);
  assert.deepEqual([Math.min(...totals), Math.max(...totals)], limits.cutting);
  const safe = finish("cutting", "gentle").round;
  assert.deepEqual(safe.data.pots, [0, 20, 20]);
  assert.equal(safe.last.cut, 0);
  assert.equal(safe.last.catch, false);
});

test("price cuts duplicate only the amount actually removed, including pennies", () => {
  let round = active("cutting", { price: 0.07, cut: 0.1 });
  round = land(round, 0);
  assert.equal(round.last.cut, 0.07);
  assert.deepEqual(round.data.pots, [0, 0.14, 0.14]);
  round = land(round, 0);
  assert.equal(round.last.cut, 0);
  assert.deepEqual(round.data.pots, [0, 0.14, 0.14]);
  round = land(round, 1);
  assert.deepEqual(round.data.pots, [0.1, 0.04, 0.24]);
  assert.equal(round.scam, 0.38);
});

test("Rent Free exhaustively exempts only the current property and keeps earlier rent charges", () => {
  const totals = [], rates = defaultSettings("rent").rents;
  routes("rent", (round, picks) => {
    const rents = Array(6).fill(0), charges = [];
    for (const pick of picks) {
      rents[pick] += rates[pick];
      charges.push(rents.reduce((sum, amount, id) => sum + (id === pick ? 0 : amount), 0));
    }
    assert.deepEqual(round.ledger.map((entry) => entry.amount), charges);
    assert.deepEqual(round.data.rents, rents);
    assert.equal(round.scam, charges.reduce((sum, amount) => sum + amount, 0));
    totals.push(round.scam);
  });
  assert.equal(totals.length, 1296);
  assert.deepEqual([Math.min(...totals), Math.max(...totals)], limits.rent);
});

test("Double Booked exhaustively preserves guest identity, free arrivals and bounded chairs", () => {
  const totals = [];
  routes("seats", (round, picks) => {
    const occupied = round.data.seats.filter((guest) => guest !== null);
    assert.equal(occupied.length, 4);
    assert.equal(new Set(occupied).size, 4);
    assert.equal(round.data.guests.length, 4);
    assert.equal(round.data.guests[3].moved, false);
    assert.equal(round.data.guests[3].price, 0);
    for (const guest of round.data.guests) {
      assert.equal(round.data.seats[guest.seat], guest.id);
      assert.equal(guest.price, guest.moved ? guest.seat * 10 : 0);
      assert.ok(guest.seat >= picks[guest.id] && guest.seat <= 6);
    }
    assert.equal(round.scam, round.data.guests.reduce((sum, guest) => sum + guest.price, 0));
    totals.push(round.scam);
  });
  assert.equal(totals.length, 256);
  assert.deepEqual([Math.min(...totals), Math.max(...totals)], limits.seats);
});

test("moving a guest replaces their quote and empty paid seats still welcome free arrivals", () => {
  const { round, states } = finish("seats");
  assert.deepEqual(states.slice(1).map((state) => state.quote), [0, 10, 30, 60]);
  assert.equal(round.ledger.length, 1);
  assert.equal(round.ledger[0].amount, 60);
  let empty = active("seats");
  empty = land(empty, 3);
  assert.equal(empty.data.guests[0].price, 0);
  assert.equal(empty.data.guests[0].seat, 3);
  assert.equal(empty.quote, 0);
  assert.equal(finish("seats", "gentle").round.scam, 0);
});

test("Heavy Baggage exhaustively uses total weight at the highest rate, not summed quotes", () => {
  const totals = [];
  routes("baggage", (round, picks) => {
    const weights = picks.map((id) => id + 1);
    assert.equal(round.scam, weights.reduce((sum, value) => sum + value, 0) * Math.max(...weights));
    assert.deepEqual(round.data.bags, weights);
    totals.push(round.scam);
  });
  assert.equal(totals.length, 625);
  assert.deepEqual([Math.min(...totals), Math.max(...totals)], limits.baggage);
  const { states } = finish("baggage");
  assert.deepEqual(states.slice(1).map((state) => state.quote), [4, 6, 40, 50]);
  assert.deepEqual(states.slice(1).map((state) => state.last.retagged), [false, false, true, false]);
});

test("Refund Pending exhaustively retains the original bill and uses credit before new cash", () => {
  const totals = [], prices = defaultSettings("refund").prices;
  routes("refund", (round, picks) => {
    assert.equal(round.scam, Math.max(prices[picks[0]], prices[picks[1]] + prices[picks[2]]));
    assert.equal(round.data.purchase, prices[picks[0]]);
    assert.equal(round.data.cash, round.scam);
    assert.equal(round.data.credit, 0);
    assert.ok(round.data.redemptions.every((redemption) => redemption.price === redemption.creditUsed + redemption.extra));
    totals.push(round.scam);
  });
  assert.equal(totals.length, 27);
  assert.deepEqual([Math.min(...totals), Math.max(...totals)], limits.refund);
});

test("unused store credit expires without a new charge and no cash refund is invented", () => {
  let round = active("refund");
  round = land(round, 2);
  assert.equal(round.data.purchase, 30);
  assert.equal(round.data.cash, 30);
  assert.equal(round.data.credit, 30);
  round = land(round, 0);
  round = land(round, 0);
  assert.equal(round.scam, 30);
  assert.equal(round.data.expiredCredit, 10);
  assert.equal(round.last.remainingCredit, 10);
  assert.equal(round.data.credit, 0);
  assert.equal(round.last.extra, 0);
});

test("Free Fall main wheel has four equal wedges and the landing directly determines the result", () => {
  const round = active("fall"), items = wheelItems(round);
  assert.deepEqual(items.map((entry) => [entry.id, entry.label, entry.weight]), [[0, "$10", 1], [1, "$20", 1], [2, "$30", 1], [3, "FREE", 1]]);
  for (let wedge = 0; wedge < 4; wedge++) {
    for (const offset of [0, 0.1, 0.5, 0.9999999]) assert.equal(chooseIndex(round, () => (wedge + offset) / 4), wedge);
  }
  for (const scenario of ["random", "story", "gentle", "big"]) {
    for (let wedge = 0; wedge < 3; wedge++) {
      const next = land(active("fall", undefined, scenario), wedge, () => { throw Error("A paid wedge must not reroll"); });
      assert.equal(next.last.itemId, wedge);
      assert.deepEqual(next.last.drop.primary, { lane: wedge, free: false, amount: [10, 20, 30][wedge] });
      assert.deepEqual(next.last.drop.minis, []);
      assert.equal(next.quote, [10, 20, 30][wedge]);
    }
  }
});

test("FREE resolves two independent paid pointers exactly once, including two hits on the same wedge", () => {
  for (let left = 0; left < 3; left++) {
    for (let right = 0; right < 3; right++) {
      const draws = [(left + 0.5) / 3, (right + 0.5) / 3];
      let used = 0;
      const next = land(active("fall"), 3, () => {
        assert.ok(used < 2, "No recursive pointer or extra roll");return draws[used++];
      });
      assert.equal(used, 2);
      const drop = next.last.drop;
      assert.deepEqual(drop.primary, { lane: 3, free: true, amount: 0 });
      assert.deepEqual(drop.minis, [{ lane: left, amount: [10, 20, 30][left] }, { lane: right, amount: [10, 20, 30][right] }]);
      assert.equal(drop.amount, [10, 20, 30][left] + [10, 20, 30][right]);
      assert.equal(next.quote, drop.amount);
      assert.equal(next.step, 1);
      assert.equal(next.scam, 0);
      assert.ok(drop.minis.every(pointer => pointer.lane < 3 && pointer.path === undefined && pointer.minis === undefined));
    }
  }
});

test("Free Fall exhaustively settles all 1728 three-spin pointer branches without another click", () => {
  const totals = [];
  function walk(round) {
    if (round.phase === "complete") {
      assert.equal(round.step, 3);assert.equal(round.data.drops.length, 3);
      assert.equal(round.scam, round.data.drops.reduce((total, drop) => total + drop.amount, 0));
      assert.equal(round.ledger.length, 1);totals.push(round.scam);return;
    }
    for (let wedge = 0; wedge < 3; wedge++) walk(land(round, wedge, () => { throw Error("Unexpected paid-wedge random draw"); }));
    for (let left = 0; left < 3; left++) for (let right = 0; right < 3; right++) {
      const draws = [(left + 0.5) / 3, (right + 0.5) / 3];let used = 0;
      walk(land(round, 3, () => draws[used++]));assert.equal(used, 2);
    }
  }
  walk(active("fall"));
  assert.equal(totals.length, 1728);
  assert.deepEqual([Math.min(...totals), Math.max(...totals)], limits.fall);
});

test("Free Fall guided pointer reveals keep the approved totals and never override a selected main wedge", () => {
  for (const scenario of ["story", "gentle", "big"]) {
    let round = active("fall", undefined, scenario), presses = 0;
    while (round.phase !== "complete") {
      const index = chooseIndex(round, () => { throw Error("Guided selection must be explicit"); });
      round = land(round, index, () => { throw Error("Guided paid pointers must be explicit"); });
      assert.equal(round.last.drop.primary.lane, index);presses++;
    }
    assert.equal(presses, 3);
    assert.equal(round.data.drops.length, 3);
  }
  const story = finish("fall").round;
  assert.deepEqual(story.data.drops.map((drop) => drop.primary.lane), [3, 0, 3]);
  assert.deepEqual(story.data.drops.map((drop) => drop.amount), [30, 10, 50]);
  assert.deepEqual(story.data.drops.map((drop) => drop.minis.map(pointer => pointer.lane)), [[0, 1], [], [1, 2]]);
  assert.equal(story.scam, 90);
});

test("guided gentle and big routes are real low/high outcomes under default rules", () => {
  for (const mode of modes) {
    assert.equal(finish(mode, "gentle").round.scam, limits[mode][0], mode);
    assert.equal(finish(mode, "big").round.scam, limits[mode][1], mode);
  }
});

test("partial or old settings fall back per field and reject unsafe numeric values", () => {
  assert.equal(createRound("removed-mode").mode, "bin");
  assert.deepEqual(normalizeSettings("bin", null), defaultSettings("bin"));
  const config = normalizeSettings("bin", { prices: [0, -1, "2.345", NaN, Infinity, 100001], openingValues: ["0.15"] });
  assert.deepEqual(config.prices, [0, 4, 2.35, 12, 20, 30]);
  assert.equal(config.openingValues[0], 0.15);
  assert.deepEqual(config.openingValues.slice(1), defaultSettings("bin").openingValues.slice(1));
  assert.equal(createRound("bin", {}, { scenario: "unknown" }).scenario, "random");
  for (const mode of modes) {
    assert.deepEqual(SETTINGS_FIELDS[mode].map((field) => field.key).sort(), Object.keys(defaultSettings(mode)).sort());
    assert.ok(SETTINGS_FIELDS[mode].every((field) => field.min === 0 && field.max === 100000));
  }
});

test("zero, fractional and maximum money configurations keep fixed endings and exact settlement", () => {
  for (const mode of modes) {
    for (const value of [0, 0.01, 100000]) {
      const settings = Object.fromEntries(Object.entries(defaultSettings(mode)).map(([key, defaultValue]) => [key, Array.isArray(defaultValue) ? defaultValue.map(() => value) : value]));
      for (const scenario of ["story", "gentle", "big"]) {
        const { round, presses } = finish(mode, scenario, settings, false);
        assert.equal(presses, MODES[mode].spins + 2);
        assert.equal(cents(round.total), cents(round.opening) + cents(round.scam));
        assert.equal(cents(round.total), round.ledger.reduce((total, entry) => total + cents(entry.amount), 0));
        assert.ok(Number.isFinite(round.total) && round.total >= 0);
        assert.ok(Number.isFinite(round.quote) && round.quote >= 0);
      }
    }
  }
});

test("money formatting and random chooser handle boundary values without invalid slices", () => {
  assert.equal(money(1234), "$1,234");
  assert.equal(money(12.5), "$12.50");
  assert.equal(money(NaN), "$0");
  for (const mode of modes) {
    const round = active(mode);
    for (const value of [-1, 0, 0.9999999999, 1, Infinity, NaN]) {
      const index = chooseIndex(round, () => value);
      assert.ok(Number.isInteger(index) && index >= 0 && index < wheelItems(round).length);
    }
  }
});
