import { FaceLandmarker, FilesetResolver } from "./node_modules/@mediapipe/tasks-vision/vision_bundle.mjs";
import { EyeClosureTimer } from "./studio-utils.js";
import { createReelRenderer } from "./reel-renderer.js";

export function createCameraStudio({ video, canvas, ctx }) {
  const reels = createReelRenderer(video,canvas,ctx);
  let faceModel, loading, faceError = "", faceResult, lastFaceAt = 0, lastVideo = -1;
  let mode = "", label = "", style = "neon", frozen = false;
  let sound, previousTime = 0;
  const eyeTimer = new EyeClosureTimer();
  const message = document.querySelector("#studioMessage");
  const focusReadout = document.querySelector("#focusReadout");

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
    reels.hide();
    mode = next; eyeTimer.reset(); faceResult = null;
    label = "ENABLE CAMERA";
    lastVideo = -1; previousTime = 0;
    if (["face", "focus"].includes(mode)) loadFace();
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

  function renderFace(now, dt, hands) {
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
    label = reels.reactions(points,hands,shapes || {},now,Boolean(faceModel)&&!faceError) || label;
    return;
  }

  function render(now, hands) {
    const dt = previousTime ? Math.min(.05,(now-previousTime)/1000) : .016;
    previousTime = now;
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    if (mode === "frame") label = reels.frame(hands,style,frozen,now); else renderFace(now,dt,hands);
    message.textContent = ["face","focus"].includes(mode) ? faceError : "";
  }

  document.querySelector("#frameStyle").addEventListener("change", event => { style = event.target.value; });
  document.querySelector("#freezeFrame").addEventListener("click", event => {
    if (!video.srcObject) return;
    frozen = !frozen;
    document.querySelector("#liveFrame").checked = !frozen;
    event.target.textContent = frozen ? "Use live frame" : "Freeze photo";
    event.target.setAttribute("aria-pressed",String(frozen));
  });
  document.querySelector("#retryFace").addEventListener("click", () => { if (!faceModel) loadFace(); });
  document.querySelector("#reminderSound").addEventListener("change", async event => {
    if (!event.target.checked) return;
    try {
      sound ??= new (window.AudioContext || window.webkitAudioContext)();
      await sound.resume();
    } catch { event.target.checked = false; focusReadout.textContent = "Audio unavailable. Visual reminders still work."; }
  });
  return { enter, render, get label() { return label; } };
}
