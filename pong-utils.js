export function createPongBall(width, height, random = Math.random) {
  return {
    x: Math.round(width * .56 * 1000) / 1000,
    y: height * (.25 + random() * .5),
    vx: -4.1,
    vy: (random() - .5) * 4.2,
    radius: Math.max(8, Math.min(width, height) * .016),
  };
}

export function advancePong(ball, paddle, width, height, delta = 1) {
  const safeDelta = Math.max(0, Math.min(delta, 1.8));
  const next = { ...ball, x: ball.x + ball.vx * safeDelta, y: ball.y + ball.vy * safeDelta };
  let event = null;

  if (next.y - next.radius <= 0) {
    next.y = next.radius;
    next.vy = Math.abs(next.vy);
  } else if (next.y + next.radius >= height) {
    next.y = height - next.radius;
    next.vy = -Math.abs(next.vy);
  }

  if (next.x + next.radius >= width) {
    next.x = width - next.radius;
    next.vx = -Math.abs(next.vx);
  }

  const crossedPaddleFace = ball.vx < 0 &&
    ball.x - ball.radius >= paddle.x + paddle.width &&
    next.x - next.radius <= paddle.x + paddle.width;
  const overlapsPaddleX = next.vx < 0 &&
    next.x - next.radius <= paddle.x + paddle.width &&
    next.x + next.radius >= paddle.x;
  const insidePaddle = next.y + next.radius >= paddle.y && next.y - next.radius <= paddle.y + paddle.height;
  if ((crossedPaddleFace || overlapsPaddleX) && insidePaddle) {
    const offset = (next.y - (paddle.y + paddle.height / 2)) / (paddle.height / 2);
    next.x = paddle.x + paddle.width + next.radius;
    next.vx = Math.min(10.5, Math.abs(next.vx) * 1.035);
    next.vy = Math.max(-8, Math.min(8, next.vy + offset * 1.35));
    event = "hit";
  } else if (next.x + next.radius < 0) {
    event = "miss";
  }

  return { ball: next, event };
}
