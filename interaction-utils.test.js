import test from "node:test";
import assert from "node:assert/strict";
import {
  createTarget,
  distance2d,
  hitTest,
  isPinching,
  PinchGate,
  smoothCanvasPoint,
  toCanvasPoint,
} from "./interaction-utils.js";

test("computes landmark distance and pinch state", () => {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  landmarks[5] = { x: 0.4, y: 0.6 };
  landmarks[17] = { x: 0.6, y: 0.6 };
  landmarks[4] = { x: 0.5, y: 0.5 };
  landmarks[8] = { x: 0.53, y: 0.52 };
  assert.ok(Math.abs(distance2d(landmarks[4], landmarks[8]) - Math.hypot(.03, .02)) < 1e-9);
  assert.equal(isPinching(landmarks), true);
  landmarks[8] = { x: 0.7, y: 0.5 };
  assert.equal(isPinching(landmarks), false);
});

test("normalizes pinch distance to hand size", () => {
  const near = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  near[5] = { x: .35, y: .6 };
  near[17] = { x: .65, y: .6 };
  near[4] = { x: .48, y: .4 };
  near[8] = { x: .54, y: .4 };
  const far = near.map(({ x, y }) => ({ x: x * .5, y: y * .5 }));
  assert.equal(isPinching(near), true);
  assert.equal(isPinching(far), true);
});

test("keeps a drawing pinch through brief tracking noise and releases deliberately", () => {
  const pinched = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  pinched[5] = { x: 0.35, y: 0.6 };
  pinched[17] = { x: 0.65, y: 0.6 };
  pinched[4] = { x: 0.48, y: 0.4 };
  pinched[8] = { x: 0.54, y: 0.4 };
  const open = pinched.map((point) => ({ ...point }));
  open[8] = { x: 0.7, y: 0.4 };
  const gate = new PinchGate({ releaseDelayMs: 90, lostDelayMs: 150 });

  assert.equal(gate.update(pinched, 1000), true);
  assert.equal(gate.update(null, 1080), true);
  assert.equal(gate.update(pinched, 1110), true);
  assert.equal(gate.update(open, 1140), true);
  assert.equal(gate.update(open, 1200), true);
  assert.equal(gate.update(open, 1231), false);
});

test("adapts point smoothing to movement speed", () => {
  const previous = { x: 0, y: 0 };
  const slow = smoothCanvasPoint(previous, { x: 2, y: 0 }, 16);
  const fast = smoothCanvasPoint(previous, { x: 30, y: 0 }, 16);
  assert.ok(slow.x > 0 && slow.x < 2);
  assert.ok(fast.x > slow.x);
  assert.ok(fast.x <= 30);
});

test("maps normalized landmarks into canvas coordinates", () => {
  assert.deepEqual(toCanvasPoint({ x: .25, y: .75 }, 800, 400), { x: 200, y: 300 });
});

test("creates reachable game targets and detects hits", () => {
  const target = createTarget(800, 600, () => .5);
  assert.equal(target.x, 400);
  assert.equal(target.y, 300);
  assert.equal(hitTest({ x: 400, y: 300 }, target), true);
  assert.equal(hitTest({ x: 0, y: 0 }, target), false);
});
