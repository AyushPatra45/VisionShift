import { FaceLandmarker, FilesetResolver } from "./node_modules/@mediapipe/tasks-vision/vision_bundle.mjs";
import { EyeClosureTimer } from "./studio-utils.js";
import { createReelRenderer } from "./reel-renderer.js";

export function createCameraStudio({ video, canvas, ctx }) {
  const reels = createReelRenderer(video,canvas,ctx);
  let faceModel, loading, faceError = "", faceResult, lastFaceAt = 0, lastVideo = -1;
  let mode = "", label = "", style = "normal", frozen = false;
  let sound, previousTime = 0, nextToneAt = 0, nextVoiceAt = 0, alarmActive = false;
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
    stopReminder();
    reels.hide();
    mode = next; eyeTimer.reset(); faceResult = null;
    label = "ENABLE CAMERA";
    lastVideo = -1; previousTime = 0;
    if (["face", "focus"].includes(mode)) loadFace();
  }

  async function unlockReminderAudio() {
    if (!document.querySelector("#reminderSound").checked) return false;
    try {
      sound ??= new (window.AudioContext || window.webkitAudioContext)();
      await sound.resume();
      return sound.state === "running";
    } catch {
      document.querySelector("#reminderSound").checked = false;
      focusReadout.textContent = "Audio unavailable in this browser. The visual alarm still works.";
      return false;
    }
  }

  function stopReminder() {
    if (alarmActive && "speechSynthesis" in window) window.speechSynthesis.cancel();
    alarmActive = false; nextToneAt = 0; nextVoiceAt = 0;
  }

  function playReminderAlarm(now, force = false) {
    if (!document.querySelector("#reminderSound").checked) return;
    alarmActive = true;
    if (sound && (force || now >= nextToneAt)) {
      const start = sound.currentTime;
      [880, 660, 880, 1040].forEach((frequency, index) => {
        const oscillator = sound.createOscillator(), gain = sound.createGain();
        oscillator.type = "square"; oscillator.frequency.value = frequency;
        oscillator.connect(gain); gain.connect(sound.destination);
        const at = start + index * .22;
        gain.gain.setValueAtTime(.0001, at);
        gain.gain.exponentialRampToValueAtTime(.14, at + .025);
        gain.gain.exponentialRampToValueAtTime(.0001, at + .17);
        oscillator.start(at); oscillator.stop(at + .19);
      });
      nextToneAt = now + 2300;
    }
    if ((force || now >= nextVoiceAt) && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window) {
      window.speechSynthesis.cancel();
      const warning = new SpeechSynthesisUtterance(force ? "Study reminder test. Please wake up." : "Wake up. Please open your eyes and take a break.");
      warning.rate = .9; warning.pitch = 1; warning.volume = 1;
      window.speechSynthesis.speak(warning);
      nextVoiceAt = now + 6200;
    }
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
      focusReadout.textContent = faceError || (!faceModel ? "Loading face tracking…" : result.progress === 1 ? "ALARM ACTIVE · open your eyes to stop it" : `${result.state} · ${Math.round(result.progress * 100)}% of reminder delay`);
      if (result.progress === 1) {
        label = "WAKE UP"; playReminderAlarm(now);
        const pulse = .42 + Math.sin(now / 130) * .1;
        ctx.fillStyle = `rgba(255,25,55,${pulse})`; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.save();ctx.translate(canvas.width,0);ctx.scale(-1,1);ctx.textAlign="center";ctx.fillStyle="#fff";ctx.shadowColor="#ff2344";ctx.shadowBlur=24;
        ctx.font=`700 ${Math.max(34,canvas.width*.075)}px DM Sans, sans-serif`;ctx.fillText("WAKE UP",canvas.width/2,canvas.height/2);
        ctx.shadowBlur=0;ctx.fillStyle="#ffe8ec";ctx.font=`600 ${Math.max(13,canvas.width*.022)}px Space Mono, monospace`;ctx.fillText("OPEN YOUR EYES TO STOP THE ALARM",canvas.width/2,canvas.height/2+38);ctx.restore();
      } else stopReminder();
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
    if (!event.target.checked) { stopReminder(); return; }
    await unlockReminderAudio();
  });
  document.querySelector("#startButton").addEventListener("click", unlockReminderAudio);
  document.querySelector("#testReminder").addEventListener("click", async () => {
    if (!document.querySelector("#reminderSound").checked) document.querySelector("#reminderSound").checked = true;
    if (await unlockReminderAudio()) playReminderAlarm(performance.now(), true);
  });
  return { enter, render, get label() { return label; } };
}
