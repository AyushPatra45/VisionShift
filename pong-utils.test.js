import test from "node:test";
import assert from "node:assert/strict";
import { advancePong, createPongBall } from "./pong-utils.js";

test("creates a ball inside the playfield", () => {
  const ball = createPongBall(800, 600, () => .5);
  assert.equal(ball.x, 448);
  assert.equal(ball.y, 300);
  assert.ok(ball.vx < 0);
});

test("bounces from the hand-controlled paddle", () => {
  const ball = { x: 72, y: 250, vx: -8, vy: 0, radius: 10 };
  const paddle = { x: 50, y: 200, width: 14, height: 100 };
  const result = advancePong(ball, paddle, 800, 600);
  assert.equal(result.event, "hit");
  assert.ok(result.ball.vx > 0);
});

test("reports a missed ball", () => {
  const ball = { x: -9, y: 50, vx: -8, vy: 0, radius: 5 };
  const paddle = { x: 50, y: 200, width: 14, height: 100 };
  assert.equal(advancePong(ball, paddle, 800, 600).event, "miss");
});
