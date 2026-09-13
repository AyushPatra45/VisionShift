import { FaceLandmarker, FilesetResolver } from "./node_modules/@mediapipe/tasks-vision/vision_bundle.mjs";
import { EyeClosureTimer, frameBetweenHands, HeldAction } from "./studio-utils.js";

export function createCameraStudio({ video, canvas, ctx }) {
  let faceModel, loading, faceError = "", faceResult, lastFaceAt = 0, lastVideo = -1;
  let mode = "", label = "", frame = null, style = "neon", frozen = false;
  let sound, lastBurst = -3000, particles = [], previousTime = 0;
  const eyeTimer = new EyeClosureTimer(), expression = new HeldAction(180);
  const still = document.createElement("canvas");
  const stillCtx = still.getContext("2d");
  const message = document.querySelector("#studioMessage");
  const focusReadout = document.querySelector("#focusReadout");
  const filters = { neon: "saturate(1.8) contrast(1.2)", mono: "grayscale(1) contrast(1.3)", pop: "saturate(4) contrast(1.8) hue-rotate(20deg)", normal: "none" };

  async function loadFace() {
    if (faceModel || loading) return loading;
    faceError = "";
    loading = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch("./models/face_landmarker.task", { signal: controller.signal });
        if (!response.ok) throw new Error(`Face model download: ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const vision = await FilesetResolver.forVisionTasks("./node_modules/@mediapipe/tasks-vision/wasm");
        for (const delegate of ["GPU", "CPU"]) {
          try {
            faceModel = await FaceLandmarker.createFromOptions(vision, {
              baseOptions: { modelAssetBuffer: bytes, delegate }, runningMode: "VIDEO",
              numFaces: 1, outputFaceBlendshapes: true,
            });
            break;
          } catch (error) { if (delegate === "CPU") throw error; }
        }
      } catch (error) {
        console.warn("Face tracking unavailable", error);
        faceError = "Face tracking unavailable. Use Retry face tracking below.";
      } finally { clearTimeout(timeout); loading = null; }
    })();
    return loading;
  }

  function enter(next) {
    mode = next; eyeTimer.reset(); expression.reset(); faceResult = null;
    label = "ENABLE CAMERA";
    lastVideo = -1; particles = []; previousTime = 0;
    if (["face", "focus"].includes(mode)) loadFace();
  }

  function burst(x = canvas.width / 2, y = canvas.height / 2) {
    particles = Array.from({ length: 70 }, (_, i) => ({
      x, y, vx: (Math.random() - .5) * 330, vy: -80 - Math.random() * 230,
      life: 1.8, color: ["#c8ff42", "#55ddff", "#ff4f9a", "#fff4d6"][i % 4],
    }));
  }

  function updateFace(now) {
    if (!faceModel || video.currentTime === lastVideo || now - lastFaceAt < 65) return;
    lastVideo = video.currentTime; lastFaceAt = now;
    try { faceResult = faceModel.detectForVideo(video, now); }
    catch (error) {
      faceResult = null; faceError = "Face tracking stopped. Use Retry face tracking below.";
      faceModel.close(); faceModel = null;
      console.warn("Face inference failed", error);
    }
  }

  function renderFace(now, dt) {
    updateFace(now);
    const categories = faceResult?.faceBlendshapes?.[0]?.categories;
    const shapes = categories ? Object.fromEntries(categories.map(s => [s.categoryName, s.score])) : null;
    const points = faceResult?.faceLandmarks?.[0];
    label = faceError ? "FACE MODEL ERROR" : !faceModel ? "LOADING FACE TRACKING" : !points ? "FACE THE CAMERA" : "TRY AN EXPRESSION";
    if (mode === "focus") {
      const result = eyeTimer.update(shapes, now, Number(document.querySelector("#eyeDelay").value) * 1000);
      if (faceModel && !faceError) label = result.state;
      focusReadout.textContent = faceError || (!faceModel ? "Loading face tracking…" : `${result.state} · ${Math.round(result.progress * 100)}% of reminder delay`);
      if (result.alert && sound && document.querySelector("#reminderSound").checked) {
        const oscillator = sound.createOscillator(), gain = sound.createGain();
        oscillator.connect(gain); gain.connect(sound.destination);
        oscillator.frequency.value = 660; gain.gain.setValueAtTime(.08, sound.currentTime);
        gain.gain.exponentialRampToValueAtTime(.001, sound.currentTime + .4);
        oscillator.start(); oscillator.stop(sound.currentTime + .4);
      }
      if (result.progress === 1) {
        ctx.fillStyle = "rgba(255,90,100,.18)"; ctx.fillRect(0,0,canvas.width,canvas.height);
      }
      return;
    }
    const triggered = expression.update(shapes ? shapes.jawOpen > .55 ? "WOW" :
      (shapes.mouthSmileLeft + shapes.mouthSmileRight) / 2 > .55 ? "CONFETTI" :
      Math.max(shapes.eyeBlinkLeft, shapes.eyeBlinkRight) > .6 && Math.min(shapes.eyeBlinkLeft, shapes.eyeBlinkRight) < .3 ? "WINK" : null : null, now);
    if (triggered && points) {
      label = triggered;
      const nose = points[1], x = nose.x * canvas.width, y = nose.y * canvas.height;
      if (triggered === "CONFETTI" && now - lastBurst > 2200) { burst(x,y); lastBurst = now; }
      if (triggered === "WOW") {
        ctx.strokeStyle = "#55ddff"; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.arc(x,y, 40 + ((now / 8 + i * 55) % 170),0,Math.PI * 2); ctx.stroke();
        }
      }
      if (triggered === "WINK") {
        ctx.save(); ctx.translate(x,y - 35); ctx.rotate(now/300);
        ctx.strokeStyle = "#ff4f9a"; ctx.lineWidth = 5;
        for (let i=0; i<8; i++) { ctx.rotate(Math.PI/4); ctx.beginPath();ctx.moveTo(30,0);ctx.lineTo(65,0);ctx.stroke(); }
        ctx.restore();
      }
    }
    for (const particle of particles) {
      particle.x += particle.vx * dt; particle.y += particle.vy * dt;
      particle.vy += 160 * dt; particle.life -= dt;
      ctx.globalAlpha = Math.max(0, Math.min(1, particle.life)); ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x,particle.y,6,10);
    }
    ctx.globalAlpha = 1; particles = particles.filter(p => p.life > 0);
  }

  function renderFrame(hands) {
    const target = frameBetweenHands(hands, canvas.width, canvas.height);
    frame ??= {x:canvas.width*.25,y:canvas.height*.25,width:canvas.width*.5,height:canvas.height*.5};
    if (target) for (const key of Object.keys(frame)) frame[key] += (target[key] - frame[key]) * .28;
    label = target ? "TWO-HAND FRAME" : "SHOW TWO INDEX FINGERS";
    const {x,y,width,height} = frame;
    ctx.save(); ctx.shadowColor = "#55ddff"; ctx.shadowBlur = 22;
    ctx.strokeStyle = "#55ddff"; ctx.lineWidth = 3; ctx.strokeRect(x-3,y-3,width+6,height+6);
    ctx.shadowBlur = 0; ctx.filter = filters[style];
    const source = frozen ? still : video;
    const sourceWidth = frozen ? still.width : video.videoWidth, sourceHeight = frozen ? still.height : video.videoHeight;
    const ratio = width / height;
    const sw = Math.min(sourceWidth,sourceHeight * ratio), sh = sw / ratio;
    ctx.drawImage(source,(sourceWidth-sw)/2,(sourceHeight-sh)/2,sw,sh,x,y,width,height);
    ctx.restore();
    ctx.fillStyle = "#c8ff42";
    for (const [px,py] of [[x,y],[x+width,y+height]]) {ctx.beginPath();ctx.arc(px,py,6,0,Math.PI*2);ctx.fill();}
  }

  function render(now, hands) {
    const dt = previousTime ? Math.min(.05,(now-previousTime)/1000) : .016;
    previousTime = now;
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    if (mode === "frame") renderFrame(hands); else renderFace(now,dt);
    message.textContent = ["face","focus"].includes(mode) ? faceError : "";
  }

  document.querySelector("#frameStyle").addEventListener("change", event => { style = event.target.value; });
  document.querySelector("#freezeFrame").addEventListener("click", event => {
    if (!video.srcObject) return;
    frozen = !frozen;
    if (frozen) { still.width=video.videoWidth;still.height=video.videoHeight;stillCtx.drawImage(video,0,0); }
    event.target.textContent = frozen ? "Use live frame" : "Freeze photo";
    event.target.setAttribute("aria-pressed",String(frozen));
  });
  document.querySelector("#retryFace").addEventListener("click", () => { if (!faceModel) loadFace(); });
  document.querySelector("#testConfetti").addEventListener("click", () => burst());
  document.querySelector("#reminderSound").addEventListener("change", async event => {
    if (!event.target.checked) return;
    try {
      sound ??= new (window.AudioContext || window.webkitAudioContext)();
      await sound.resume();
    } catch { event.target.checked = false; focusReadout.textContent = "Audio unavailable. Visual reminders still work."; }
  });
  return { enter, render, get label() { return label; } };
}
