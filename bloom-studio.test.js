import test from "node:test";
import assert from "node:assert/strict";
import { handBloomAmount, isOpenHand, isPointingHand } from "./bloom-studio.js";

function hand() {
  const points = Array.from({ length: 21 }, () => ({ x: .5, y: .7 }));
  points[0] = { x: .5, y: .95 };
  points[5] = { x: .4, y: .72 }; points[17] = { x: .6, y: .72 };
  return points;
}

test("bloom controls distinguish pointing and open palms", () => {
  const pointing = hand();
  pointing[6] = { x: .45, y: .67 }; pointing[8] = { x: .45, y: .35 };
  pointing[10] = { x: .5, y: .61 }; pointing[12] = { x: .5, y: .72 };
  pointing[14] = { x: .55, y: .61 }; pointing[16] = { x: .55, y: .72 };
  pointing[18] = { x: .6, y: .62 }; pointing[20] = { x: .6, y: .72 };
  assert.equal(isPointingHand(pointing), true);

  const open = hand();
  for (const [pip, tip, x] of [[6,8,.42],[10,12,.48],[14,16,.54],[18,20,.6]]) {
    open[pip] = { x, y: .62 }; open[tip] = { x, y: .34 };
  }
  assert.equal(isOpenHand(open), true);
});

test("thumb-index spread becomes a normalized bloom amount", () => {
  const points = hand();
  points[4] = { x: .24, y: .5 }; points[8] = { x: .76, y: .5 };
  assert.ok(handBloomAmount(points) > .9);
  points[4] = { x: .49, y: .5 }; points[8] = { x: .51, y: .5 };
  assert.equal(handBloomAmount(points), 0);
});
