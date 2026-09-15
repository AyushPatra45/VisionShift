import test from "node:test";
import assert from "node:assert/strict";
import {chooseReaction,easyFrameQuad,handQuad,projectQuad} from "./reel-utils.js";
test("reaction rules use face scale and neutral jaw baseline",()=>{
  const p=Array.from({length:478},()=>({x:.5,y:.5}));p[234]={x:.3,y:.5};p[454]={x:.7,y:.5};
  assert.equal(chooseReaction(p,[],{jawOpen:.5}),"open_mouth");
  assert.equal(chooseReaction(p,[],{jawOpen:.5},{jawOpen:.4}),null);
  assert.equal(chooseReaction(null,[],{}),"spin");
  assert.equal(chooseReaction(null,[[]],{}),null);
});
test("easy frame maps two palm centers to a stable rotated rectangle",()=>{
  const hand=(x,y)=>Array.from({length:21},()=>({x,y}));
  const q=easyFrameQuad([hand(.2,.45),hand(.8,.55)],720,540);
  assert.equal(q.length,4);
  assert.ok(Math.hypot(q[1].x-q[0].x,q[1].y-q[0].y)>400);
  assert.equal(easyFrameQuad([hand(.5,.5)],720,540),null);
});
test("four-fingertip panel rejects collapsed corners and projects all corners exactly",()=>{
  const hand=(x)=>Array.from({length:21},(_,i)=>({x,y:i===4?.7:.2}));
  const q=handQuad([hand(.2),hand(.8)],720,540);assert.ok(q);
  for(const [i,u,v] of [[0,0,0],[1,1,0],[2,1,1],[3,0,1]]) {
    const p=projectQuad(q,u,v);assert.ok(Math.hypot(p.x-q[i].x,p.y-q[i].y)<.001);
  }
  assert.equal(handQuad([hand(.5),hand(.5)],720,540),null);
});
