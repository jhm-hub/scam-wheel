import test from "node:test";
import assert from "node:assert/strict";
import { createRound, activate, board, choose, land, validPrices } from "../src/model.mjs";
import { nextRotation, resolveLanding, sliceAtAngle, sliceCenterDeg } from "./engine.mjs";
function opening(mode) {
  let s = createRound(mode);
  s = land(s, 0);
  s = land(s, 1);
  return s;
}
function showcase(mode, quick = false) {
  let s = createRound(mode, void 0, quick, true);
  let limit = 0;
  while (s.phase !== "complete" && limit++ < 100) {
    if (s.phase === "activate") s = activate(s, 2);
    else s = land(s, choose(s));
  }
  return s;
}
test("Two normal spins precede the scam", () => {
  let s = createRound("dice");
  assert.equal(s.phase, "normal");
  s = land(s, 0);
  assert.equal(s.phase, "normal");
  s = land(s, 1);
  assert.equal(s.phase, "activate");
  assert.equal(s.total, 22);
  assert.throws(() => land(s, 0));
});
test("Dice adds its actual roll to configured spins", () => {
  for (let d = 1; d <= 6; d++) {
    const s = activate(opening("dice"), d);
    assert.equal(s.spins, 3 + d);
  }
  assert.throws(() => activate(opening("dice"), 0));
});
test("Dice boosts chain without using spins; cash consumes the boost once", () => {
  let s = activate(opening("dice"), 2);
  for (const i of [2, 5, 8]) s = land(s, i);
  assert.equal(s.mult, 8);
  assert.equal(s.spins, 5);
  s = land(s, 0);
  assert.equal(s.total, 102);
  assert.equal(s.mult, 1);
  assert.equal(s.spins, 4);
  s = land(s, 1);
  assert.equal(s.total, 112);
});
test("Bonus cash consumes the boost and replaces its spin", () => {
  let s = activate(opening("dice"), 2);
  s = land(s, 2);
  s = land(s, 4);
  assert.equal(s.total, 26);
  assert.equal(s.spins, 5);
  assert.equal(s.mult, 1);
});
test("Roulette stays active until EXIT and applies multiplier to entire bill", () => {
  let s = activate(opening("roulette"));
  for (const i of [0, 4, 1, 4]) s = land(s, i);
  assert.equal(s.total, 42);
  assert.equal(s.mult, 4);
  assert.equal(s.phase, "active");
  s = land(s, 5);
  assert.equal(s.total, 168);
  assert.equal(s.phase, "complete");
  assert.equal(s.last.before, 42);
  assert.throws(() => land(s, 5));
});
test("Both showcases reach the expected reproducible finales", () => {
  assert.equal(showcase("dice").total, 154);
  assert.equal(showcase("roulette").total, 248);
  assert.equal(showcase("dice", true).total, 132);
  assert.equal(showcase("roulette", true).total, 160);
});
test("Configurable prices apply to all results and independent snapshots", () => {
  const prices = { cash: 25, bonus: 3, spins: 4 };
  let s = createRound("dice", prices, true);
  prices.cash = 1;
  s = activate(s, 6);
  assert.equal(board(s)[0].value, 25);
  assert.equal(board(s)[4].value, 3);
  assert.equal(s.spins, 10);
  assert.equal(validPrices({ cash: NaN, bonus: 2, spins: 3 }), false);
  assert.equal(validPrices({ cash: 10.2, bonus: 2, spins: 3 }), false);
});
test("\xD764 ceiling is explicit and finite", () => {
  let s = activate(opening("roulette"));
  for (let i = 0; i < 20; i++) s = land(s, 4);
  assert.equal(s.mult, 64);
  s = land(s, 5);
  assert.equal(s.total, 22 * 64);
});
test("Landaire landing agrees with the top pointer and drawn slice for every 4, 6, 8, 9 and 12 slot wheel", () => {
  for (const n of [4, 6, 8, 9, 12]) {
    const layout = Array.from({ length: n }, (_, index) => ({ index, startTurn: index / n, sizeTurn: 1 / n }));
    for (let i = 0; i < n; i++) for (const from of [0, 87, 1920, 5640]) for (const offset of [-0.17, 0, 0.17]) {
      const rest = sliceCenterDeg(layout[i]) + offset * 360 / n;
      const result = resolveLanding(layout, rest, { magnetism: false, seamBandDeg: 0 });
      assert.equal(result.kind, "winner");
      assert.equal(result.slice, i);
      const end = nextRotation(from, result.restAngle, 5);
      assert.ok(end > from + 4 * 360);
      assert.equal(sliceAtAngle(layout, ((90 - end) % 360 + 360) % 360), i);
      const screen = ((rest + end - 180) % 360 + 360) % 360;
      assert.ok(Math.abs(screen - 270) < 1e-8);
    }
  }
});
test("Random rounds preserve accounting and terminate within the stated limit", () => {
  let seed = 811;
  const rng = () => {
    seed = 1664525 * seed + 1013904223 >>> 0;
    return seed / 4294967296;
  };
  for (const mode of ["dice", "roulette"]) for (let j = 0; j < 500; j++) {
    let s = createRound(mode, void 0, true);
    s = activate(s, 1 + Math.floor(rng() * 6));
    let count = 0;
    while (s.phase !== "complete") {
      s = land(s, choose(s, rng));
      assert.ok(Number.isSafeInteger(s.total) && s.total >= 0);
      assert.ok(++count <= 60);
    }
    assert.ok(s.ledger.length > 0);
  }
});
test("Rent Free upgrades one property and charges all built properties every turn", () => {
  let s = activate(createRound("rent", void 0, true));
  assert.equal(s.spins, 4);
  const original = s;
  s = land(s, 0);
  assert.equal(s.total, 5);
  assert.deepEqual(original.rents, [0, 0, 0, 0, 0, 0]);
  s = land(s, 1);
  assert.equal(s.last.amount, 15);
  s = land(s, 0);
  assert.equal(s.last.newRent, 10);
  assert.equal(s.last.amount, 20);
  assert.equal(s.total, 40);
  s = land(s, 2);
  assert.equal(s.last.amount, 35);
  assert.equal(s.total, 75);
  assert.equal(s.phase, "complete");
  assert.equal(s.levels[0], 2);
});
test("A candy trio charges once, clears only its colour, and can form another set", () => {
  let s = activate(createRound("gumball", void 0, true));
  const initial = s;
  s = land(s, 1);
  s = land(s, 0);
  s = land(s, 3);
  s = land(s, 6);
  assert.equal(s.last.amount, 90);
  assert.equal(s.last.setBonus, 80);
  assert.deepEqual(s.candies, [0, 1, 0]);
  assert.deepEqual(initial.candies, [0, 0, 0]);
  assert.equal(s.sets, 1);
  assert.equal(s.total, 120);
  s = land(s, 4);
  s = land(s, 7);
  assert.equal(s.last.setBonus, 100);
  assert.equal(s.sets, 2);
  assert.equal(s.total, 240);
  assert.equal(s.phase, "complete");
});
test("New showcases reach audited totals with and without normal opening spins", () => {
  assert.equal(showcase("rent").total, 97);
  assert.equal(showcase("rent", true).total, 75);
  assert.equal(showcase("gumball").total, 162);
  assert.equal(showcase("gumball", true).total, 140);
});
test("New modes honour settings, finite rounds, and ledger accounting", () => {
  let seed = 444;
  const rng = () => {
    seed = 1664525 * seed + 1013904223 >>> 0;
    return seed / 4294967296;
  };
  for (const mode of ["rent", "gumball"]) for (let j = 0; j < 500; j++) {
    const prices = { cash: 1 + j % 1e3, bonus: 2, spins: 1 + j % 10 };
    let s = createRound(mode, prices, false);
    s = land(s, choose(s, rng));
    s = land(s, choose(s, rng));
    s = activate(s);
    const turns = prices.spins + (mode === "rent" ? 1 : 3);
    for (let i = 0; i < turns; i++) {
      const before = s;
      s = land(s, choose(s, rng));
      assert.equal(s.total, before.total + s.last.amount);
      assert.equal(s.phase, i === turns - 1 ? "complete" : "active");
      assert.equal(s.spins, turns - i - 1);
      assert.ok(s.candies.every((n) => n >= 0 && n < 3));
      assert.ok(s.rents.every((n) => n >= 0));
    }
    assert.equal(s.ledger.reduce((n, e) => n + e.amount, 0), s.total);
    assert.ok(Number.isSafeInteger(s.total));
  }
});
import { MODES } from "../src/model.mjs";
import { EXTRA_MODES } from "../src/extended.mjs";
import { freshConfig, validateConfig, readConfig, saveConfig, makeDiscoveryDeck } from "../src/config.mjs";
const expected = { baggage: 550, auction: 120, race: 110, stamps: 120, bubble: 300, seats: 82, blocks: 220, charms: 200, toll: 110, credit: 110, map: 120, plinko: 170, encore: 220, bowling: 210, tower: 244, boss: 194 };
test("All 20 scams fully settle their showcase", () => {
  assert.equal(Object.keys(MODES).length, 20);
  for (const [mode, total] of Object.entries(expected)) {
    const s = showcase(mode, true);
    assert.equal(s.total, total, mode);
    assert.equal(s.phase, "complete");
    assert.ok(s.step < 60, mode);
    assert.equal(showcase(mode).total, total + 22, mode + " opening spins");
  }
});
test("All modes preserve exact ledger accounting over random rounds and extreme settings", () => {
  let seed = 237456;
  const rng = () => {
    seed = 1664525 * seed + 1013904223 >>> 0;
    return seed / 4294967296;
  };
  for (const mode of Object.keys(MODES)) for (let j = 0; j < 150; j++) {
    const prices = j % 3 === 0 ? { cash: 1, bonus: 1, spins: 1 } : j % 3 === 1 ? { cash: 1e3, bonus: 1e3, spins: 10 } : { cash: 50, bonus: 10, spins: 3 };
    let s = createRound(mode, prices, false);
    s = land(s, choose(s, rng), rng);
    s = land(s, choose(s, rng), rng);
    s = activate(s, 1 + Math.floor(rng() * 6));
    let steps = 0;
    while (s.phase === "active") {
      const old = s;
      s = land(s, choose(s, rng), rng);
      assert.equal(s.total - old.total, s.last.amount, mode + " amount");
      assert.equal(s.last.before, old.total);
      assert.equal(s.last.after, s.total);
      assert.ok(Number.isSafeInteger(s.total) && s.total >= 0);
      assert.ok(++steps <= 60, mode + " termination");
    }
    assert.equal(s.ledger.reduce((n, e) => n + e.amount, 0), s.total, mode + " ledger");
  }
});
test("Heavy Baggage applies the highest rate to every parcel, only at settlement", () => {
  let s = activate(createRound("baggage", void 0, true));
  s = land(s, 0);
  s = land(s, 1);
  s = land(s, 4);
  assert.equal(s.total, 0);
  s = land(s, 2);
  assert.equal(s.total, (1 + 2 + 5 + 3) * 5 * 10);
});
test("Going Twice charges the top two bids, including tied bids, not every bid", () => {
  let s = activate(createRound("auction", void 0, true));
  for (const i of [5, 0, 5, 1]) s = land(s, i);
  assert.equal(s.total, 160);
});
test("Stamp duty charges each completed line once even on repeated marks", () => {
  let s = activate(createRound("stamps", void 0, true));
  for (const i of [0, 1, 2]) s = land(s, i);
  assert.equal(s.total, 60);
  assert.equal(s.data.lines.length, 1);
  s = land(s, 0);
  assert.equal(s.last.amount, 10);
  assert.equal(s.data.lines.length, 1);
});
test("Double booking handles a completely full house without a loop", () => {
  let s = activate(createRound("seats", { cash: 10, bonus: 2, spins: 10 }, true));
  for (let i = 0; i < 6; i++) s = land(s, i);
  s = land(s, 0);
  assert.equal(s.last.amount, 22);
  assert.equal(s.last.moved.length, 6);
  assert.equal(s.data.standing, 1);
});
test("Stack Attack clears full rows and preserves overhanging column blocks", () => {
  let s = activate(createRound("blocks", void 0, true));
  for (const i of [0, 1, 2, 3]) s = land(s, i);
  assert.equal(s.data.lines, 2);
  assert.deepEqual(s.data.heights, [0, 0, 0, 0]);
  assert.equal(s.last.amount, 120);
});
test("Charm repricing charges only the change to the collection value", () => {
  let s = activate(createRound("charms", void 0, true));
  s = land(s, 0);
  s = land(s, 0);
  s = land(s, 0);
  assert.equal(s.total, 90);
  assert.deepEqual(s.ledger.map((e) => e.amount), [10, 30, 50]);
});
test("Tolls include intermediate gates and the wraparound gate", () => {
  let s = activate(createRound("toll", void 0, true));
  s = land(s, 3);
  assert.equal(s.last.amount, 10);
  s = land(s, 3);
  assert.equal(s.last.amount, 20);
  s = land(s, 3);
  assert.equal(s.last.amount, 70);
  assert.equal(s.data.position, 0);
});
test("Credit at the exact limit remains playable; only excess is charged again", () => {
  let s = activate(createRound("credit", void 0, true));
  for (let i = 0; i < 3; i++) s = land(s, 2);
  assert.equal(s.total, 90);
  assert.equal(s.phase, "active");
  s = land(s, 0);
  assert.equal(s.total, 110);
  assert.equal(s.phase, "complete");
});
test("Compass wraps once and records the destination charge and detour separately", () => {
  let s = activate(createRound("map", void 0, true));
  s = land(s, 0);
  s = land(s, 0);
  assert.equal(s.data.y, 2);
  assert.equal(s.data.x, 1);
  assert.equal(s.last.lines.length, 2);
  assert.equal(s.last.amount, 50);
});
test("Plinko uses the displayed final lane and keeps every bounce in bounds", () => {
  for (const dir of [0, 0.99]) {
    let s = activate(createRound("plinko", void 0, true));
    s = land(s, 2, () => dir);
    const lane = s.data.path.at(-1);
    assert.ok(s.data.path.every((i) => i >= 0 && i <= 4));
    assert.equal(s.last.amount, [1, 3, 8, 3, 1][lane] * 10);
  }
});
test("Wrong notes cannot skip melody steps; each completed melody charges once", () => {
  let s = activate(createRound("encore", void 0, true));
  for (const i of [2, 0, 2, 1, 2]) s = land(s, i);
  assert.equal(s.data.songs, 1);
  assert.equal(s.data.note, 0);
  assert.equal(s.total, 130);
});
test("Bowling never charges a fallen pin again until a rack has been cleared", () => {
  let s = activate(createRound("bowling", void 0, true));
  s = land(s, 0);
  assert.equal(s.last.amount, 40);
  s = land(s, 0);
  assert.equal(s.last.amount, 0);
  s = land(s, 4);
  assert.equal(s.last.amount, 110);
  assert.equal(s.data.racks, 1);
});
test("Tower collapse charges remaining offcuts once and ends the round", () => {
  let s = activate(createRound("tower", void 0, true));
  for (const i of [5, 5, 5]) s = land(s, i);
  assert.equal(s.data.width, 0);
  assert.equal(s.data.waste, 8);
  assert.equal(s.last.amount, 4);
  assert.equal(s.phase, "complete");
});
test("Boss heals are capped and the bounty is awarded exactly once", () => {
  let s = activate(createRound("boss", void 0, true));
  s = land(s, 6);
  assert.equal(s.data.hp, 12);
  for (let i = 0; i < 4; i++) s = land(s, 2);
  assert.equal(s.total, 174);
  assert.equal(s.phase, "complete");
  assert.throws(() => land(s, 2));
});
test("Separate stakes profiles and custom colours round-trip without changing rules", () => {
  const cfg = freshConfig();
  cfg.profiles.low.cash = 17;
  cfg.profiles.high.spins = 7;
  cfg.theme.pink = "#123abc";
  cfg.mode = "boss";
  let saved;
  const storage = { setItem: (_, value) => saved = value, getItem: () => saved };
  assert.equal(saveConfig(storage, cfg), true);
  assert.deepEqual(readConfig(storage), cfg);
  assert.equal(readConfig({ getItem: () => "{bad" }).profiles.low.cash, 10);
  assert.throws(() => validateConfig({ theme: { pink: "red" } }));
  assert.throws(() => validateConfig({ profiles: { high: { cash: 0, bonus: 1, spins: 3 } } }));
  assert.equal(validateConfig({ profiles: { low: { cash: 17, bonus: 2, spins: 4 } } }).profiles.high.cash, 50);
});
test("Race movement stops at the finish line and charges only visible distance", () => {
  let s = activate(createRound("race", { cash: 10, bonus: 2, spins: 2 }, true));
  for (const i of [0, 0, 0]) s = land(s, i);
  assert.equal(s.data.distance[0], 5);
  assert.equal(s.total, 50);
});
test("Mystery discovery visits every scam before repeating and avoids a repeat at the cycle boundary", () => {
  let seed = 47;
  const rng = () => {
    seed = 1664525 * seed + 1013904223 >>> 0;
    return seed / 4294967296;
  }, ids = Object.keys(MODES), next = makeDiscoveryDeck(ids, rng);
  let last;
  for (let cycle = 0; cycle < 100; cycle++) {
    const batch = Array.from({ length: 20 }, next);
    assert.equal(new Set(batch).size, 20);
    assert.ok(batch.every((id) => ids.includes(id)));
    assert.notEqual(batch[0], last);
    last = batch.at(-1);
  }
  assert.throws(() => makeDiscoveryDeck([]));
});

test('Spin motion joins its wind-up smoothly and settles exactly without overshoot', async()=>{
  const {wheelRotation}=await import('../src/motion.mjs');
  const s={rotation:725,motion:{from:725,to:2865,at:1000,duration:5600},reduced:false};
  assert.equal(wheelRotation(s,0),725);
  assert.equal(wheelRotation(s,6600),2865);
  assert.equal(wheelRotation(s,9000),2865);
  const join=1000+5600*0.085;
  const left=(wheelRotation(s,join)-wheelRotation(s,join-0.1))/0.1;
  const right=(wheelRotation(s,join+0.1)-wheelRotation(s,join))/0.1;
  assert.ok(Math.abs(left-right)<0.001,'wind-up has no velocity jump');
  let last=wheelRotation(s,join);
  for(let t=join+1;t<=6600;t+=1){const x=wheelRotation(s,t);assert.ok(x>=last-1e-8&&x<=2865+1e-8);last=x;}
  assert.ok(2865-wheelRotation(s,6599)<0.00001,'landing has no final snap');
  assert.equal(wheelRotation({...s,reduced:true},1050),2865);
});
test('Every scene gets action time followed by a readable bill and a bounded fade',async()=>{
  const {sceneTiming,overlayOpacity}=await import('../src/motion.mjs');
  for(const mode of Object.keys(EXTRA_MODES)){const timing=sceneTiming(mode,{lines:[1,2,3]});assert.ok(timing.reveal>=1100);assert.ok(timing.duration-timing.reveal>=1550);}
  const overlay={at:1000,exitAt:3000};
  assert.equal(overlayOpacity(overlay,1000),0);assert.equal(overlayOpacity(overlay,1220),1);assert.equal(overlayOpacity(overlay,3240),0);
});
