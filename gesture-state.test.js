import test from "node:test";
import assert from "node:assert/strict";
import { GestureStabilizer } from "./gesture-state.js";

test("requires several confident frames before changing mode", () => {
  const state = new GestureStabilizer({ framesRequired: 3 });
  assert.equal(state.update("Open_Palm", 0.9), "normal");
  assert.equal(state.update("Open_Palm", 0.9), "normal");
  assert.equal(state.update("Open_Palm", 0.9), "invisible");
});

test("resets the candidate when recognition becomes uncertain", () => {
  const state = new GestureStabilizer({ framesRequired: 2 });
  state.update("Victory", 0.8);
  state.update("Victory", 0.2);
  assert.equal(state.update("Victory", 0.8), "normal");
});

test("maps supported gestures to their effect", () => {
  const state = new GestureStabilizer({ framesRequired: 1 });
  assert.equal(state.update("Closed_Fist", 0.9), "glitch");
  assert.equal(state.update("Victory", 0.9), "echo");
  assert.equal(state.update("Pointing_Up", 0.9), "normal");
});
