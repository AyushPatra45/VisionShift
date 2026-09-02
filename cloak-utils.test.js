import test from "node:test";
import assert from "node:assert/strict";
import { estimateColorTransform, smoothstep } from "./cloak-utils.js";

test("smoothstep creates a soft bounded matte", () => {
  assert.equal(smoothstep(0.2, 0.8, 0.1), 0);
  assert.ok(Math.abs(smoothstep(0.2, 0.8, 0.5) - 0.5) < 1e-9);
  assert.equal(smoothstep(0.2, 0.8, 0.9), 1);
});

test("color matching leaves identical frames unchanged", () => {
  const plate = new Uint8ClampedArray(128 * 4);
  const live = new Uint8ClampedArray(128 * 4);
  const mask = new Uint8ClampedArray(128 * 4);
  for (let i = 0; i < plate.length; i += 4) {
    plate[i] = live[i] = i % 251;
    plate[i + 1] = live[i + 1] = (i * 2) % 251;
    plate[i + 2] = live[i + 2] = (i * 3) % 251;
  }
  const match = estimateColorTransform(live, plate, mask, 1);
  assert.deepEqual(match.gain.map((value) => Math.round(value * 1000) / 1000), [1, 1, 1]);
  assert.deepEqual(match.offset.map(Math.round), [0, 0, 0]);
});

test("color matching estimates exposure and brightness changes", () => {
  const plate = new Uint8ClampedArray(256 * 4);
  const live = new Uint8ClampedArray(256 * 4);
  const mask = new Uint8ClampedArray(256 * 4);
  for (let pixel = 0; pixel < 256; pixel += 1) {
    const index = pixel * 4;
    const value = 30 + (pixel % 120);
    plate[index] = plate[index + 1] = plate[index + 2] = value;
    live[index] = live[index + 1] = live[index + 2] = Math.round(value * 1.1 + 8);
  }
  const match = estimateColorTransform(live, plate, mask, 1);
  assert.ok(Math.abs(match.gain[0] - 1.1) < 0.02);
  assert.ok(Math.abs(match.offset[0] - 8) < 1);
});
