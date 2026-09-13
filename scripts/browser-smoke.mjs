// Optional integration check: PLAYWRIGHT_PATH=/path/to/playwright/index.mjs node scripts/browser-smoke.mjs
// Starts an isolated local server and a synthetic camera. Never records a user's webcam.
import { spawn } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || "playwright");
const port = 8186;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", process.env.VISION_TEST_ROOT || "."], {stdio:"ignore"});
let browser;
try {
  for (let attempt=0;attempt<40;attempt++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) break; } catch {}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream"]});
  const context = await browser.newContext({viewport:{width:1440,height:1000},permissions:["camera"],acceptDownloads:true});
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error=>errors.push(error.message));
  // Test-only instrumentation is intercepted in this browser, never shipped.
  await page.route("**/app.js", async route => {
    const source = await readFile(new URL("../app.js",import.meta.url),"utf8");
    await route.fulfill({contentType:"text/javascript",body:source + `\nwindow.__visionTest = { updateRecognition, renderAirCanvas, finishDrawingStroke, restoreDrawing, drawing, drawingCtx, drawState, studio, buildCloakFrame, fullSizeMask, fullSizeMaskCtx };`});
  });
  await page.route("**/camera-studio.js", async route => {
    const source = await readFile(new URL("../camera-studio.js",import.meta.url),"utf8");
    await route.fulfill({contentType:"text/javascript",body:source.replace("return { enter, render, get label()", `window.__studioTest = { setFace(result) { faceModel.detectForVideo = () => result; lastVideo = -1; }, get frame() { return frame; } };\n  return { enter, render, get label()`)});
  });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(()=>!document.querySelector("#startButton").disabled,{},{timeout:60000});
  await page.locator("#startButton").click();
  await page.waitForFunction(()=>document.querySelector("#stage").classList.contains("camera-on"),{},{timeout:20000});
  console.log("PASS: actual local hand model + synthetic camera startup");
  for (const mode of ["effects","draw","hud","game","sign","pong","reader","frame","face","focus"]) {
    await page.locator(`[data-experience="${mode}"].experience-button`).click();
    assert.equal(await page.locator("#stage").getAttribute("data-experience"),mode);
    assert.equal(await page.locator(`[data-experience-panel="${mode}"]`).isVisible(),true);
  }
  await page.waitForFunction(()=>/NO FACE|EYES OPEN|EYES CLOSED|TAKE A MOMENT/.test(document.querySelector("#focusReadout").textContent),{},{timeout:60000});
  assert.equal(await page.locator("#studioMessage").textContent(),"");
  console.log("PASS: all 10 routes and actual face-model inference (no face)");
  const faceChecks = await page.evaluate(()=>{
    const t=window.__visionTest, s=window.__studioTest;
    const points=Array.from({length:478},()=>({x:.5,y:.4,z:0}));
    const render=(shapes,now)=>{
      s.setFace({faceLandmarks:[points],faceBlendshapes:[{categories:Object.entries(shapes).map(([categoryName,score])=>({categoryName,score}))}]});
      t.studio.render(now,[]); return t.studio.label;
    };
    t.studio.enter("face");
    render({jawOpen:.9},20000);const mouth=render({jawOpen:.9},20300);
    render({mouthSmileLeft:.9,mouthSmileRight:.9},21000);const smile=render({mouthSmileLeft:.9,mouthSmileRight:.9},21300);
    render({eyeBlinkLeft:.9,eyeBlinkRight:.1},22000);const wink=render({eyeBlinkLeft:.9,eyeBlinkRight:.1},22300);
    t.studio.enter("focus");
    render({eyeBlinkLeft:.9,eyeBlinkRight:.9},23000);const reminder=render({eyeBlinkLeft:.9,eyeBlinkRight:.9},25000);
    return {mouth,smile,wink,reminder};
  });
  assert.deepEqual(faceChecks,{mouth:"WOW",smile:"CONFETTI",wink:"WINK",reminder:"TAKE A MOMENT"});
  console.log("PASS: expression effects and sustained-closure reminder with synthetic landmarks");
  const maskCheck = await page.evaluate(()=>{
    const t=window.__visionTest;
    const mask=(confidence,category)=>({categoryMask:{width:8,height:8,getAsUint8Array:()=>new Uint8Array(64).fill(category)},confidenceMasks:[{getAsFloat32Array:()=>new Float32Array(64).fill(confidence)}]});
    const alpha=()=>t.fullSizeMaskCtx.getImageData(t.fullSizeMask.width/2,t.fullSizeMask.height/2,1,1).data[3];
    t.buildCloakFrame(mask(.01,255),26000);const empty=alpha();
    t.buildCloakFrame(mask(.99,0),26100);return {empty,person:alpha()};
  });
  assert.deepEqual(maskCheck,{empty:0,person:255});
  console.log("PASS: empty cloak masks stay empty, person masks stay opaque");
  await page.locator('[data-experience="frame"].experience-button').click();
  await page.evaluate(()=>{
    const hand=(x,y)=>Array.from({length:21},()=>({x,y,z:0}));
    window.__visionTest.studio.render(27000,[hand(.2,.2),hand(.8,.8)]);
  });
  await page.locator("#frameStyle").selectOption("pop");
  await page.locator("#freezeFrame").click();
  assert.equal(await page.locator("#freezeFrame").getAttribute("aria-pressed"),"true");
  await page.locator("#freezeFrame").click();
  assert.equal(await page.locator("#freezeFrame").getAttribute("aria-pressed"),"false");
  await page.locator('[data-experience="draw"].experience-button').click();
  const ink = await page.evaluate(()=>{
    const t=window.__visionTest;
    const count=()=>t.drawingCtx.getImageData(0,0,t.drawing.width,t.drawing.height).data.reduce((n,v,i)=>n+(i%4===3&&v>0?1:0),0);
    for(let i=0;i<25;i++) {
      const x=.7-i*.012;
      const hand=Array.from({length:21},()=>({x:.5,y:.5,z:0}));
      hand[5]={x:.4,y:.5};hand[17]={x:.6,y:.5};hand[8]={x,y:.55};hand[4]={x:x+.02,y:.55};
      t.updateRecognition({landmarks:[hand],gestures:[[{categoryName:i%2?"Open_Palm":"Victory",score:.99}]]});
      t.renderAirCanvas(10000+i*32);
    }
    t.finishDrawingStroke();
    const drawn=count();
    t.restoreDrawing("undo"); const undone=count();
    t.restoreDrawing("redo"); const redone=count();
    const row=t.drawingCtx.getImageData(Math.round(t.drawing.width*.43),Math.round(t.drawing.height*.55),Math.round(t.drawing.width*.25),1).data;
    const gaps=Array.from(row).filter((v,i)=>i%4===3&&v===0).length;
    return {drawn,undone,redone,gaps};
  });
  assert.ok(ink.drawn>100);assert.equal(ink.undone,0);assert.equal(ink.redone,ink.drawn);assert.equal(ink.gaps,0);
  console.log("PASS: noisy gesture labels do not break handwriting; undo/redo restore exact ink",ink);
  const download=page.waitForEvent("download"); await page.locator("#saveDrawing").click();
  assert.equal((await download).suggestedFilename(),"visionshift-drawing.png");
  await page.locator("#cleanBoard").check(); await page.locator("#brushSize").selectOption("16");
  await mkdir("/tmp/visionshift-qa",{recursive:true});
  await page.screenshot({path:"/tmp/visionshift-qa/desktop.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});
  for (const mode of ["draw","frame","face","focus","sign","reader"]) {
    await page.locator(`[data-experience="${mode}"].experience-button`).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${mode} mobile overflow`);
  }
  await page.screenshot({path:"/tmp/visionshift-qa/mobile.png",fullPage:true});
  assert.deepEqual(errors,[]);
  console.log("PASS: PNG download, brush/board controls, mobile layout, no page errors");
  const recovery = await context.newPage();
  await recovery.route("**/models/face_landmarker.task",route=>route.fulfill({status:503,body:"Simulated model outage"}));
  await recovery.goto(`http://127.0.0.1:${port}/`);
  await recovery.waitForFunction(()=>!document.querySelector("#startButton").disabled,{},{timeout:60000});
  await recovery.locator("#startButton").click();
  await recovery.locator('[data-experience="face"].experience-button').click();
  await recovery.waitForFunction(()=>document.querySelector("#studioMessage").textContent.includes("unavailable"),{},{timeout:20000});
  await recovery.unroute("**/models/face_landmarker.task");
  await recovery.locator("#retryFace").click();
  await recovery.waitForFunction(()=>document.querySelector("#modeChip").textContent === "FACE THE CAMERA",{},{timeout:60000});
  await recovery.close();
  console.log("PASS: face-model outage shows an actionable error and Retry recovers");
} finally { await browser?.close(); server.kill(); }
