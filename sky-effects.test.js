import test from "node:test";
import assert from "node:assert/strict";
import { createSkySimulation } from "./sky-effects.js";

test("constellation requires charging and a deliberate palm release",()=>{
  const sim=createSkySimulation(()=>.5);
  sim.update({mode:"stars",now:0,point:{x:100,y:100}});
  sim.update({mode:"stars",now:20,point:{x:180,y:120}});
  for(let now=40;now<=300;now+=20)sim.update({mode:"stars",now,palm:true});
  assert.equal(sim.stats.stars,2,"an uncharged open palm preserves the stars");
  for(let now=320;now<=1400;now+=20)sim.update({mode:"stars",now,fist:true});
  assert.equal(sim.stats.charge,1);
  sim.update({mode:"stars",now:1420,palm:true});
  assert.equal(sim.stats.stars,2,"single-frame palm noise cannot release stars");
  const burst=sim.update({mode:"stars",now:1560,palm:true});
  assert.equal(burst.label,"MAKE A WISH");assert.equal(sim.stats.stars,0);assert.ok(sim.stats.sparks>0);
  sim.reset();assert.deepEqual(sim.stats,{stars:0,sparks:0,charge:0});
});

test("sparkler particles expire after lifting the finger and stay bounded",()=>{
  const sim=createSkySimulation(()=>.5);
  for(let now=0;now<10000;now+=16)sim.update({mode:"sparkler",now,point:{x:300,y:100}});
  assert.ok(sim.stats.sparks>0&&sim.stats.sparks<=1000);
  for(let now=10000;now<14000;now+=16)sim.update({mode:"sparkler",now});
  assert.equal(sim.stats.sparks,0);
});
