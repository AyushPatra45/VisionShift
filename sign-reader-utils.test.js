import test from "node:test";
import assert from "node:assert/strict";
import {
  averageHandPoses,
  classifyLearnedPose,
  mirrorHandPose,
  normalizeHandPose,
  poseDistance,
  sanitizeReaderLibrary,
} from "./sign-reader-utils.js";

function sampleHand(offsetX = 0, scale = 1) {
  return Array.from({ length: 21 }, (_, index) => ({
    x: offsetX + (index % 5) * 0.03 * scale,
    y: 0.7 - Math.floor(index / 5) * 0.04 * scale,
    z: -index * 0.002 * scale,
  }));
}

function rotateHand(landmarks, angle) {
  const center = landmarks[0];
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return landmarks.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
      x: center.x + dx * cosine - dy * sine,
      y: center.y + dx * sine + dy * cosine,
      z: point.z,
    };
  });
}

test("normalizes translation and scale from a hand pose", () => {
  const first = normalizeHandPose(sampleHand(0, 1));
  const second = normalizeHandPose(sampleHand(0.4, 0.5));
  assert.ok(first);
  assert.ok(second);
  assert.ok(poseDistance(first, second) < 1e-9);
});

test("normalizes in-plane hand rotation", () => {
  const hand = sampleHand();
  const original = normalizeHandPose(hand);
  const rotated = normalizeHandPose(rotateHand(hand, Math.PI / 5));
  assert.ok(original);
  assert.ok(rotated);
  assert.ok(poseDistance(original, rotated) < 1e-9);
});

test("averages captured poses into a stable prototype", () => {
  const pose = normalizeHandPose(sampleHand());
  const shifted = pose.map((value, index) => value + (index % 3 === 0 ? 0.02 : 0));
  const average = averageHandPoses([pose, shifted]);
  assert.equal(average.length, 63);
  assert.ok(Math.abs(average[3] - (pose[3] + 0.01)) < 1e-9);
});

test("matches a learned pose across mirrored hands and rejects distant poses", () => {
  const pose = normalizeHandPose(sampleHand());
  const mirrored = mirrorHandPose(pose);
  const library = [{ label: "Water", pose }];
  assert.equal(classifyLearnedPose(mirrored, library)?.label, "Water");
  const distant = pose.map((value, index) => value + (index % 3 === 1 ? 1 : 0));
  assert.equal(classifyLearnedPose(distant, library), null);
});

test("sanitizes saved labels and malformed pose data", () => {
  const pose = Array.from({ length: 63 }, () => 0);
  assert.deepEqual(sanitizeReaderLibrary([
    { label: "  Need   water ", pose },
    { label: "need water", pose },
    { label: "Broken", pose: [1, 2] },
  ]), [{ label: "Need water", pose }]);
});
