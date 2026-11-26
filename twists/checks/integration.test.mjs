import test from "node:test";
import assert from "node:assert/strict";
import { MODES, createRound, activateRound, wheelItems, chooseIndex, land, defaultSettings } from "../src/model.mjs";
import { restoreCheckpoint } from "../src/checkpoint.mjs";
import { spinProgress, rotationAt } from "../src/render.mjs";
import { nextRotation, sliceAtAngle, sliceCenterDeg, resolveLanding, spinTurns } from "../../arcade/checks/engine.mjs";

const modes = Object.keys(MODES);
const norm = (value) => (value % 360 + 360) % 360;
const layoutFor = (items) => items.map((_, index) => ({ index, startTurn: index / items.length, sizeTurn: 1 / items.length }));

function recordedRound(mode, scenario = "story", quick = false) {
  let round = createRound(mode, undefined, { scenario, quick });
  const saved = { version: 1, mode, settings: round.settings, scenario, quick, actions: [] };
  const snapshots = [];
  let count = 0;
  const rng = () => { count++; return (count * 13 % 29 + 0.5) / 29; };
  while (round.phase !== "complete") {
    if (round.phase === "ready") round = activateRound(round);
    const items = wheelItems(round), index = chooseIndex(round, rng), draws = [];
    const before = round;
    round = land(round, index, () => { const value = rng(); draws.push(value); return value; });
    saved.actions.push({ index, draws });
    snapshots.push({ saved: structuredClone(saved), round, before, items, index });
  }
  return { saved, round, snapshots };
}

test("all wheels land at the visual pointer using Landaire geometry, including every Bin wheel size", () => {
  const wheels = [];
  for (const mode of modes) {
    const { snapshots } = recordedRound(mode);
    wheels.push(...snapshots.map((snapshot) => snapshot.items));
  }
  assert.ok([3, 4, 5, 6, 12].every((length) => wheels.some((items) => items.length === length)));
  for (const items of wheels) {
    const layout = layoutFor(items);
    for (const slot of layout) {
      const rest = sliceCenterDeg(slot), result = resolveLanding(layout, rest, { magnetism: true, seamBandDeg: 0 });
      assert.equal(result.kind, "winner");
      assert.equal(result.slice, slot.index);
      for (const current of [-720.25, 0, 19.4, 359.99, 9999]) {
        const target = nextRotation(current, result.restAngle, spinTurns(0));
        assert.equal(sliceAtAngle(layout, norm(90 - target)), slot.index);
        const renderedCenter = norm((slot.index + 0.5) * 360 / items.length - 180 + target);
        assert.ok(Math.abs(renderedCenter - 270) < 0.000001);
        assert.ok(target >= current + 4 * 360);
      }
    }
  }
});

test("spin interpolation is monotonic with exact starts, gentle endpoint and no overshoot", () => {
  assert.equal(spinProgress(-1), 0);
  assert.equal(spinProgress(0), 0);
  assert.equal(spinProgress(1), 1);
  assert.equal(spinProgress(2), 1);
  let previous = 0;
  for (let i = 0; i <= 1000; i++) {
    const progress = spinProgress(i / 1000);
    assert.ok(progress >= previous - 1e-12 && progress <= 1 + 1e-12);
    previous = progress;
  }
  assert.ok(spinProgress(0.001) < 0.0001);
  assert.ok(1 - spinProgress(0.999) < 0.0001);
  const state = { rotation: 12, spinMotion: { from: 12, to: 1500, at: 1000, duration: 5800 } };
  assert.equal(rotationAt(state, 0), 12);
  assert.equal(rotationAt(state, 6800), 1500);
  assert.equal(rotationAt(state, 10000), 1500);
  assert.equal(rotationAt({ rotation: 72, spinMotion: null }, 0), 72);
});

test("each completed landing restores its exact model state, wheel and resting pointer", () => {
  for (const mode of modes) {
    for (const scenario of ["story", "gentle", "big", "random"]) {
      for (const quick of [false, true]) {
        const { snapshots } = recordedRound(mode, scenario, quick);
        for (const snapshot of snapshots) {
          const restored = restoreCheckpoint(snapshot.saved, mode);
          assert.ok(restored, mode + "/" + scenario);
          assert.deepEqual(restored.round, snapshot.round);
          assert.deepEqual(restored.previousRound, snapshot.before);
          assert.deepEqual(restored.items, snapshot.items);
          assert.equal(sliceAtAngle(layoutFor(restored.items), norm(90 - restored.rotation)), snapshot.index);
          assert.deepEqual(restored.actions, snapshot.saved.actions);
        }
      }
    }
  }
});

test("Bin refresh retains the pre-removal landed wheel rather than the smaller next wheel", () => {
  const { snapshots } = recordedRound("bin", "story", true);
  for (let i = 0; i < snapshots.length; i++) {
    const restored = restoreCheckpoint(snapshots[i].saved);
    assert.equal(restored.items.length, 6 - i);
    assert.equal(wheelItems(restored.round).length, 5 - i);
    assert.equal(restored.items[restored.round.last.index].id, restored.round.last.removedId);
  }
  const final = restoreCheckpoint(snapshots.at(-1).saved);
  assert.equal(final.round.phase, "complete");
  assert.equal(final.items.length, 3);
  assert.equal(final.round.data.remaining.length, 2);
  assert.equal(final.round.scam, 50);
});

test("restoring before activation leaves two ordinary results banked without counting a scam turn", () => {
  const { snapshots } = recordedRound("seats", "story", false);
  const restored = restoreCheckpoint(snapshots[1].saved);
  assert.equal(restored.round.phase, "ready");
  assert.equal(restored.round.normalStep, 2);
  assert.equal(restored.round.step, 0);
  assert.equal(restored.round.opening, 20);
  assert.equal(restored.items.length, 12);
  assert.equal(restored.previousRound.phase, "normal");
});

test("completed checkpoints settle once and do not consume an additional spin on restore", () => {
  for (const mode of modes) {
    const { saved, round } = recordedRound(mode);
    const restored = restoreCheckpoint(saved);
    assert.equal(restored.round.phase, "complete");
    assert.equal(restored.round.total, round.total);
    assert.deepEqual(restored.round.ledger, round.ledger);
    assert.strictEqual(land(restored.round, 0), restored.round);
  }
});

test("truncated or surplus random draws are rejected instead of changing a restored bill", () => {
  const { saved } = recordedRound("fall", "random", true);
  assert.ok(restoreCheckpoint(saved));
  const splitIndex = saved.actions.findIndex(action => action.draws.length === 2);
  assert.ok(splitIndex >= 0);
  const missing = structuredClone(saved);
  missing.actions[splitIndex].draws.pop();
  assert.equal(restoreCheckpoint(missing), null);
  const extra = structuredClone(saved);
  extra.actions[splitIndex].draws.push(0.5);
  assert.equal(restoreCheckpoint(extra), null);
  const unexpected = structuredClone(recordedRound("bin", "story", true).saved);
  unexpected.actions[0].draws.push(0.5);
  assert.equal(restoreCheckpoint(unexpected), null);
});

test("invalid indexes, mode changes and malformed checkpoints fail closed", () => {
  const source = recordedRound("bin", "story", true).saved;
  const variations = [null, {}, [], { ...source, version: 9 }, { ...source, mode: "removed" }, { ...source, scenario: "anything" }, { ...source, quick: "true" }, { ...source, actions: [] }];
  for (const input of variations) assert.equal(restoreCheckpoint(input), null);
  assert.equal(restoreCheckpoint(source, "sticky"), null);
  for (const index of [-1, 6, 0.5, Infinity, "0"]) {
    const invalid = structuredClone(source);invalid.actions[0].index = index;
    assert.equal(restoreCheckpoint(invalid), null);
  }
  const removedIndex = structuredClone(source);removedIndex.actions[3].index = 3;
  assert.equal(restoreCheckpoint(removedIndex), null);
  const tooLong = structuredClone(source);tooLong.actions.push({ index: 0, draws: [] });
  assert.equal(restoreCheckpoint(tooLong), null);
});

test("non-finite or out-of-range stored draws cannot enter model replay", () => {
  const source = recordedRound("fall", "random", true).saved;
  const splitIndex = source.actions.findIndex(action => action.draws.length === 2);
  assert.ok(splitIndex >= 0);
  for (const value of [NaN, Infinity, -0.01, 1, "0.5", null]) {
    const saved = structuredClone(source);saved.actions[splitIndex].draws[0] = value;
    assert.equal(restoreCheckpoint(saved), null);
  }
});

test("old Plinko random records are rejected rather than reinterpreted as new wheel results", () => {
  for (const scenario of ["random", "story"]) {
    for (const oldDrawCount of [1, 3, 4, 10]) {
      const saved = { version: 1, mode: "fall", settings: defaultSettings("fall"), quick: true, scenario, actions: [{ index: 3, draws: Array(oldDrawCount).fill(0.5) }] };
      assert.equal(restoreCheckpoint(saved), null);
    }
  }
  const current = recordedRound("fall", "random", true).saved;
  assert.ok(restoreCheckpoint(current));
  const guided = recordedRound("fall", "story", true).saved;
  assert.ok(guided.actions.every(action => action.draws.length === 0));
  assert.equal(restoreCheckpoint(guided).round.scam, 90);
});

test("corrupt money settings cannot silently reprice a financial checkpoint", () => {
  const source = recordedRound("bin", "story", true).saved;
  for (const input of [undefined, {}, { ...source.settings, prices: [1] }, { ...source.settings, prices: [2, 4, 8, 12, 20, -1] }, { ...source.settings, prices: [2, 4, 8, 12, 20, 0.001] }]) {
    assert.equal(restoreCheckpoint({ ...source, settings: input }), null);
  }
  assert.ok(restoreCheckpoint({ ...source, settings: defaultSettings("bin") }));
});

test("checkpoint replay does not mutate the stored actions and supports cent amounts", () => {
  let round = createRound("refund", { prices: [0.1, 0.2, 0.3] }, { quick: true, scenario: "story" });
  const saved = { version: 1, mode: "refund", settings: round.settings, quick: true, scenario: "story", actions: [] };
  while (round.phase !== "complete") {
    round = activateRound(round);const index = chooseIndex(round);saved.actions.push({ index, draws: [] });round = land(round, index);
  }
  const before = structuredClone(saved), restored = restoreCheckpoint(saved);
  assert.deepEqual(saved, before);
  assert.equal(restored.round.scam, 0.4);
  restored.actions[0].index = 2;
  assert.deepEqual(saved, before);
});
