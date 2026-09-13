import test from "node:test";
import assert from "node:assert/strict";
import { HeldAction, EditHistory, frameBetweenHands, EyeClosureTimer } from "./studio-utils.js";

test("single-frame command glitches cannot interrupt a stroke", () => {
  const hold = new HeldAction(250);
  assert.equal(hold.update("erase", 0), null);
  assert.equal(hold.update(null, 32), null);
  assert.equal(hold.update("erase", 100), null);
  assert.equal(hold.update("erase", 350), "erase");
  assert.equal(hold.update(null, 351), null);
});
test("drawing history supports undo, redo, branching and bounded memory", () => {
  const history = new EditHistory(2);
  history.save("a"); history.save("b"); history.save("c");
  assert.deepEqual(history.undoStack, ["b", "c"]);
  assert.equal(history.undo("d"), "c");
  assert.equal(history.redo("c"), "d");
  history.undo("d"); history.save("new");
  assert.equal(history.redo("current"), null);
});
test("frame bounds are stable when hands cross and absent hands return null", () => {
  const hand = (x,y) => Array.from({length:21}, () => ({x,y}));
  assert.deepEqual(frameBetweenHands([hand(.8,.7), hand(.2,.3)], 100,100), {x:20,y:30,width:60.00000000000001,height:45});
  assert.equal(frameBetweenHands([hand(.5,.5)],100,100), null);
});
test("eye reminder ignores blinks, alerts once and resets when face disappears", () => {
  const timer = new EyeClosureTimer();
  const closed = {eyeBlinkLeft:.9,eyeBlinkRight:.9};
  assert.equal(timer.update(closed,0).alert, false);
  assert.equal(timer.update({},100).state, "EYES OPEN");
  timer.update(closed,200);
  assert.equal(timer.update(closed,2000).alert,true);
  assert.equal(timer.update(closed,3000).alert,false);
  assert.equal(timer.update(null,3100).state,"NO FACE");
  assert.equal(timer.update(closed,3200).progress,0);
});
