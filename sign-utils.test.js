import test from "node:test";
import assert from "node:assert/strict";
import { classifyStaticSign, getFingerStates, getSignGuidance } from "./sign-utils.js";

test("recognizes the supported static handshape patterns", () => {
  assert.equal(classifyStaticSign([false, true, true, true, true]), "B");
  assert.equal(classifyStaticSign([false, false, false, false, true]), "I");
  assert.equal(classifyStaticSign([true, true, false, false, false]), "L");
  assert.equal(classifyStaticSign([true, false, false, false, true]), "Y");
  assert.equal(classifyStaticSign([true, true, false, false, true]), "ILY");
  assert.equal(classifyStaticSign([true, true, true, true, true]), null);
});

test("returns no finger state for incomplete landmarks", () => {
  assert.equal(getFingerStates([]), null);
});

test("offers one actionable correction for the target handshape", () => {
  assert.equal(getSignGuidance("L", [true, false, false, false, false]), "Extend your index finger");
  assert.equal(getSignGuidance("Y", [true, false, false, false, true]), "Shape matched — hold steady");
});
