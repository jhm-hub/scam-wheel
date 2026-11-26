import test from "node:test";
import assert from "node:assert/strict";
import { MODES, createRound, activateRound, wheelItems, chooseIndex, land } from "../src/model.mjs";
import { makeRenderer, THEME } from "../src/render.mjs";
import { nextRotation, sliceCenterDeg } from "../../arcade/checks/engine.mjs";

function multiply(a, b) {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}

function canvasHarness() {
  let currentLabel = "initial frame", rimCalls = [], textCalls = 0, operations = 0;
  const finite = (values, method) => values.forEach(value => assert.ok(typeof value === "number" && Number.isFinite(value), currentLabel + ": non-finite " + method + " argument " + value));
  function makeCanvas(isMain = false) {
    const canvas = { width: 0, height: 0 };
    let transform = [1, 0, 0, 1, 0, 0], values = { globalAlpha: 1, lineWidth: 1, font: "10px Nunito" };
    const stack = [];
    const methods = {
      save() { stack.push({ transform: [...transform], values: { ...values } }); },
      restore() { assert.ok(stack.length, currentLabel + ": unbalanced restore");const old = stack.pop();transform = old.transform;values = old.values; },
      setTransform(...args) { finite(args, "setTransform");assert.equal(args.length, 6);transform = [...args]; },
      resetTransform() { transform = [1, 0, 0, 1, 0, 0]; },
      transform(...args) { finite(args, "transform");assert.equal(args.length, 6);transform = multiply(transform, args); },
      translate(x, y) { finite([x, y], "translate");transform = multiply(transform, [1, 0, 0, 1, x, y]); },
      scale(x, y) { finite([x, y], "scale");transform = multiply(transform, [x, 0, 0, y, 0, 0]); },
      rotate(angle) { finite([angle], "rotate");transform = multiply(transform, [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]); },
      arc(x, y, radius, start, end, anticlockwise) {
        finite([x, y, radius, start, end], "arc");assert.ok(radius >= 0, currentLabel + ": negative radius");
        if (anticlockwise !== undefined) assert.equal(typeof anticlockwise, "boolean");
        if (isMain) rimCalls.push([transform[0] * x + transform[2] * y + transform[4], transform[1] * x + transform[3] * y + transform[5], Math.hypot(transform[0], transform[1]) * radius, Math.hypot(transform[2], transform[3]) * radius]);
      },
      ellipse(x, y, rx, ry, rotation, start, end) { finite([x, y, rx, ry, rotation, start, end], "ellipse");assert.ok(rx >= 0 && ry >= 0); },
      roundRect(x, y, w, h, radius) { finite([x, y, w, h, ...(Array.isArray(radius) ? radius : [radius])], "roundRect"); },
      drawImage(image, ...args) { assert.ok(image && image.width > 0 && image.height > 0, currentLabel + ": missing canvas image");finite(args, "drawImage"); },
      measureText(value) {
        const size = Number(/([\d.]+)px/.exec(values.font)?.[1] || 10);
        return { width: String(value).length * size * 0.55, actualBoundingBoxAscent: size * 0.8, actualBoundingBoxDescent: size * 0.2 };
      },
      fillText(value, x, y, maxWidth) { validateText(value, x, y, maxWidth); },
      strokeText(value, x, y, maxWidth) { validateText(value, x, y, maxWidth); },
      setLineDash(array) { assert.ok(Array.isArray(array));finite(array, "setLineDash");assert.ok(array.every(value => value >= 0)); },
      getLineDash() { return []; },
      createLinearGradient(...args) { return gradient(args); },
      createRadialGradient(...args) { return gradient(args); },
      createConicGradient(...args) { return gradient(args); },
    };
    function validateText(value, x, y, maxWidth) {
      assert.equal(typeof value, "string", currentLabel + ": missing text");
      assert.ok(!/undefined|NaN|Infinity/.test(value), currentLabel + ": invalid text " + value);
      finite([x, y, ...(maxWidth === undefined ? [] : [maxWidth])], "text");textCalls++;
    }
    function gradient(args) {
      finite(args, "gradient");
      return { addColorStop(offset, color) { finite([offset], "color stop");assert.ok(offset >= 0 && offset <= 1);assert.equal(typeof color, "string"); } };
    }
    for (const name of ["moveTo", "lineTo", "bezierCurveTo", "quadraticCurveTo", "fillRect", "strokeRect", "clearRect", "rect"]) methods[name] = (...args) => finite(args, name);
    for (const name of ["beginPath", "closePath", "fill", "stroke", "clip"]) methods[name] = () => {};
    const context = new Proxy({}, {
      get(_target, key) {
        if (key === "canvas") return canvas;
        if (key === "stackDepth") return stack.length;
        if (Object.hasOwn(methods, key)) return (...args) => { operations++;return methods[key](...args); };
        if (Object.hasOwn(values, key)) return values[key];
        return undefined;
      },
      set(_target, key, value) {
        if (["globalAlpha", "lineWidth", "shadowBlur", "shadowOffsetX", "shadowOffsetY", "miterLimit", "lineDashOffset"].includes(key)) finite([value], key);
        if (key === "globalAlpha") assert.ok(value >= -1e-9 && value <= 1 + 1e-9, currentLabel + ": invalid opacity " + value);
        if (key === "lineWidth") assert.ok(value >= 0);
        if (key === "font") assert.ok(typeof value === "string" && !/NaN|undefined|Infinity/.test(value), currentLabel + ": invalid font");
        values[key] = value;return true;
      },
    });
    canvas.getContext = type => { assert.equal(type, "2d");return context; };
    canvas.context = context;
    return canvas;
  }
  const main = makeCanvas(true);
  return {
    main,
    document: { createElement(tag) { assert.equal(tag, "canvas");return makeCanvas(); } },
    start(label) { currentLabel = label;rimCalls = []; },
    result() { return { rim: rimCalls.slice(0, 3), textCalls, operations, depth: main.context.stackDepth }; },
  };
}

test("actual wheel renderer keeps finite geometry and a fixed rim through every scripted reveal", () => {
  const originalWindow = globalThis.window, originalDocument = globalThis.document;
  const harness = canvasHarness();
  globalThis.window = { devicePixelRatio: 1.25 };
  globalThis.document = harness.document;
  let frames = 0, baseline;
  try {
    const renderer = makeRenderer(harness.main), at = 1806000000000;
    function draw(label, state, progress = 1) {
      harness.start(label);
      renderer.draw(state, at + progress * state.stageDuration);
      const result = harness.result();
      assert.equal(result.depth, 0, label + ": canvas state leaked");
      assert.equal(result.rim.length, 3, label + ": the wheel rim disappeared");
      baseline ??= result.rim;
      assert.deepEqual(result.rim, baseline, label + ": the wheel shrank or moved");
      frames++;
    }
    for (const mode of Object.keys(MODES)) {
      for (const scenario of ["story", "gentle", "big"]) {
        for (const quick of [false, true]) {
          for (const reduced of [false, true]) {
            let round = createRound(mode, undefined, { quick, scenario }), rotation = 0;
            let state = { round, previousRound: null, items: wheelItems(round), rotation, spinMotion: null, stage: "idle", stageAt: at, stageDuration: 1000, sceneActive: false, busy: false, theme: THEME, showBill: true, scriptedLabel: "SCRIPTED DEMO", reduced };
            const prefix = [mode, scenario, quick ? "quick" : "full", reduced ? "reduced" : "motion"].join("/");
            draw(prefix + "/initial", state);
            while (round.phase !== "complete") {
              if (round.phase === "ready") {
                draw(prefix + "/activation", { ...state, stage: "activation", stageAt: at, stageDuration: 2000, busy: true }, 0.5);
                round = activateRound(round);
              }
              const before = round, items = wheelItems(before), index = chooseIndex(before, () => 0.4);
              const target = nextRotation(rotation, sliceCenterDeg({ index, startTurn: index / items.length, sizeTurn: 1 / items.length }), 4);
              state = { ...state, round: before, previousRound: before, items, rotation, spinMotion: { from: rotation, to: target, at, duration: 5800 }, stage: "spin", stageAt: at, stageDuration: 5800, sceneActive: before.phase === "active", busy: true };
              draw(prefix + "/spin-" + before.step, state, 0.1);
              draw(prefix + "/spin-" + before.step, state, 0.9);
              round = land(before, index, () => 0.4);rotation = target % 360;
              state = { ...state, round, rotation, spinMotion: null, stage: "reveal", stageAt: at, stageDuration: 8000 };
              for (const progress of [0, 0.15, 0.35, 0.7, 1]) draw(prefix + "/reveal-" + round.step + "/" + progress, state, progress);
              state = { ...state, busy: false, stage: round.phase === "complete" ? "complete" : "idle", stageAt: at, stageDuration: 650 };
              draw(prefix + "/settled-" + round.step, state);
              if (round.phase === "complete") draw(prefix + "/hidden-final", { ...state, showBill: false });
            }
          }
        }
      }
    }
    assert.ok(frames > 3000);
    assert.ok(harness.result().textCalls > frames);
    assert.ok(harness.result().operations > frames * 100);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document;else globalThis.document = originalDocument;
  }
});
