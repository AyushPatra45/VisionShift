import {
  GestureRecognizer,
  FilesetResolver,
  ImageSegmenter,
} from "./node_modules/@mediapipe/tasks-vision/vision_bundle.mjs";
import { GestureStabilizer } from "./gesture-state.js";
import { smoothstep } from "./cloak-utils.js";
import {
  createTarget,
  FRIENDLY_GESTURES,
  HAND_CONNECTIONS,
  hitTest,
  isPinching,
  toCanvasPoint,
} from "./interaction-utils.js";
import {
  SIGN_CHALLENGES,
  classifyStaticSign,
  getFingerStates,
  getSignGuidance,
} from "./sign-utils.js";
import { advancePong, createPongBall } from "./pong-utils.js";

const MODEL_URL = "./models/gesture_recognizer.task";
const SEGMENTER_MODEL_URL = "./models/selfie_segmenter.tflite";
const WASM_URL = "./node_modules/@mediapipe/tasks-vision/wasm";
const GESTURE_CONFIDENCE = 0.68;
const SIGN_HOLD_MS = 900;
const RECOGNITION_INTERVAL_MS = 32;
const SEGMENTATION_INTERVAL_MS = 72;

const EXPERIENCE_META = Object.freeze({
  effects: {
    eyebrow: "EXPERIENCE 01 / REALITY FX",
    stage: "REALITY FX / LIVE",
    description: "Become invisible, fracture the live feed, or leave ghost echoes using only recognizable hand signs.",
  },
  draw: {
    eyebrow: "EXPERIENCE 02 / AIR CANVAS",
    stage: "AIR CANVAS / LIVE",
    description: "Pinch your fingers to sketch in mid-air, switch ink with a victory sign, and erase without touching a screen.",
  },
  hud: {
    eyebrow: "EXPERIENCE 03 / HAND HUD",
    stage: "HAND HUD / DIAGNOSTIC",
    description: "Inspect the 21 landmarks, joint connections, handedness, gesture label, and confidence seen by the vision model.",
  },
  game: {
    eyebrow: "EXPERIENCE 04 / ORB GAME",
    stage: "ORB GAME / LIVE",
    description: "Aim with your index finger and pinch glowing targets. Build a streak without using a mouse or keyboard.",
  },
  sign: {
    eyebrow: "EXPERIENCE 05 / SIGN LAB",
    stage: "SIGN LAB / PRACTICE",
    description: "Practice five simplified static ASL handshapes with live landmarks, targeted hints, and a steady-hold challenge.",
  },
  pong: {
    eyebrow: "EXPERIENCE 06 / NEON PONG",
    stage: "NEON PONG / LIVE",
    description: "Move your palm to defend the neon wall. Every return gets faster; three misses end the run.",
  },
});

const video = document.querySelector("#webcam");
const canvas = document.querySelector("#output");
const ctx = canvas.getContext("2d");
const background = document.createElement("canvas");
const backgroundCtx = background.getContext("2d");
const personMask = document.createElement("canvas");
const personMaskCtx = personMask.getContext("2d");
const fullSizeMask = document.createElement("canvas");
const fullSizeMaskCtx = fullSizeMask.getContext("2d");
const cloakLayer = document.createElement("canvas");
const cloakCtx = cloakLayer.getContext("2d");
const drawing = document.createElement("canvas");
const drawingCtx = drawing.getContext("2d");
const brightnessSample = document.createElement("canvas");
const brightnessSampleCtx = brightnessSample.getContext("2d", { willReadFrequently: true });
brightnessSample.width = 80;
brightnessSample.height = 60;

const stage = document.querySelector("#stage");
const panel = document.querySelector("#permissionPanel");
const startButton = document.querySelector("#startButton");
const captureButton = document.querySelector("#captureButton");
const captureRow = document.querySelector("#captureRow");
const loadNote = document.querySelector("#loadNote");
const status = document.querySelector(".status");
const statusText = document.querySelector("#statusText");
const modeChip = document.querySelector("#modeChip");
const fpsLabel = document.querySelector("#fps");
const gestureReadout = document.querySelector("#gestureReadout");
const gestureDetail = document.querySelector("#gestureDetail");
const experienceEyebrow = document.querySelector("#experienceEyebrow");
const experienceDescription = document.querySelector("#experienceDescription");
const stageExperience = document.querySelector("#stageExperience");
const primaryScoreLabel = document.querySelector("#primaryScoreLabel");
const secondaryScoreLabel = document.querySelector("#secondaryScoreLabel");
const scoreValue = document.querySelector("#scoreValue");
const streakValue = document.querySelector("#streakValue");
const signTarget = document.querySelector("#signTarget");
const signHint = document.querySelector("#signHint");
const signProgress = document.querySelector("#signProgress");
const signScore = document.querySelector("#signScore");
const signAnnouncement = document.querySelector("#signAnnouncement");

let recognizer;
let segmenter;
let segmenterUnavailable = false;
let backgroundReady = false;
let lastVideoTime = -1;
let lastRecognitionAt = 0;
let lastSegmentationAt = 0;
let segmentationBusy = false;
let cloakFrameReady = false;
let activeExperience = "effects";
let currentMode = "normal";
let lastMode = "normal";
let effectNotice = "";
let latestLandmarks;
let latestGesture = "None";
let latestGestureScore = 0;
let latestHandedness = "";
let echoFrames = [];
let echoCursor = 0;
let echoFrameCount = 0;
let matteImageData;
let sceneBrightness = 1;
let lastBrightnessAt = 0;
let previousFrameTime = performance.now();
let fpsSmoothed = 0;
const stabilizer = new GestureStabilizer();

const drawState = {
  color: "#c8ff42",
  colorIndex: 0,
  colors: ["#c8ff42", "#55ddff", "#ff4f9a", "#fff4d6"],
  previousPoint: null,
  smoothedPoint: null,
  victoryLatched: false,
  fistStartedAt: 0,
  clearLatched: false,
};

const game = {
  target: null,
  score: 0,
  streak: 0,
  pinchLatched: false,
  fistStartedAt: 0,
  resetLatched: false,
  particles: [],
};

const signState = {
  targetIndex: 0,
  matched: 0,
  detected: null,
  holdStartedAt: 0,
  completeUntil: 0,
};

const pong = {
  ball: null,
  paddleCenter: 0,
  score: 0,
  lives: 3,
  gameOver: false,
  fistStartedAt: 0,
  resetLatched: false,
  lastFrameAt: 0,
  keyboardDirection: 0,
};

async function createWithDelegateFallback(createTask, taskName) {
  let firstError;
  for (const delegate of ["GPU", "CPU"]) {
    try {
      return await createTask(delegate);
    } catch (error) {
      firstError ??= error;
      console.warn(`${taskName} ${delegate} initialization failed`, error);
    }
  }
  throw firstError;
}

async function loadModels() {
  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    recognizer = await createWithDelegateFallback(
      (delegate) => GestureRecognizer.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      }),
      "Gesture recognizer",
    );

    startButton.disabled = false;
    loadNote.textContent = "Hand tracking ready · loading cloak engine…";
    status.classList.add("ready");
    statusText.textContent = "HAND TRACKING READY";

    try {
      segmenter = await createWithDelegateFallback(
        (delegate) => ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: SEGMENTER_MODEL_URL, delegate },
          runningMode: "VIDEO",
          outputCategoryMask: true,
          outputConfidenceMasks: true,
        }),
        "Person segmenter",
      );
      loadNote.textContent = "Vision engine ready";
      statusText.textContent = "SYSTEM READY";
      if (video.srcObject) captureButton.disabled = false;
    } catch (error) {
      console.error(error);
      segmenterUnavailable = true;
      loadNote.textContent = "Hand tracking ready · cloak unavailable on this device";
      statusText.textContent = "HAND TRACKING READY";
    }
  } catch (error) {
    console.error(error);
    startButton.disabled = true;
    loadNote.textContent = "Could not load the local hand-tracking engine.";
    status.classList.add("error");
    statusText.textContent = "MODEL ERROR";
  }
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    loadNote.textContent = "Camera access needs HTTPS or localhost in a supported browser.";
    status.classList.add("error");
    statusText.textContent = "CAMERA UNSUPPORTED";
    return;
  }

  startButton.disabled = true;
  loadNote.textContent = "Requesting camera access…";
  const permissionReminder = setTimeout(() => {
    loadNote.textContent = "Still waiting — click the camera icon in the address bar and choose Allow.";
  }, 3500);
  try {
    video.srcObject = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: "user" },
      audio: false,
    });
    clearTimeout(permissionReminder);
    await video.play();
    resizeCanvases();
    panel.classList.add("hidden");
    stage.classList.add("camera-on");
    captureButton.disabled = !segmenter;
    requestAnimationFrame(render);
  } catch (error) {
    clearTimeout(permissionReminder);
    console.error(error);
    startButton.disabled = false;
    loadNote.textContent = "Camera blocked. Allow access in your browser settings.";
    status.classList.add("error");
    statusText.textContent = "CAMERA BLOCKED";
  }
}

function resizeCanvases() {
  const sourceWidth = video.videoWidth || 1280;
  const sourceHeight = video.videoHeight || 960;
  const width = Math.min(sourceWidth, 720);
  const height = Math.round(width * sourceHeight / sourceWidth);
  stage.style.aspectRatio = `${sourceWidth} / ${sourceHeight}`;
  if (canvas.width === width && canvas.height === height) return;
  for (const target of [canvas, background, fullSizeMask, cloakLayer, drawing]) {
    target.width = width;
    target.height = height;
  }
  backgroundReady = false;
  cloakFrameReady = false;
  game.target = createTarget(width, height);
  resetPong();
}

async function captureBackground() {
  if (!segmenter) return;
  captureButton.disabled = true;
  captureButton.innerHTML = '<span class="capture-icon"></span>Matching camera…';
  await lockCameraAppearance();
  backgroundCtx.drawImage(video, 0, 0, background.width, background.height);
  backgroundReady = true;
  cloakFrameReady = false;
  effectNotice = "";
  captureButton.disabled = false;
  captureButton.innerHTML = '<span class="capture-icon"></span>Background captured ✓';
  setTimeout(() => {
    captureButton.innerHTML = '<span class="capture-icon"></span>Recapture background';
  }, 1700);
}

async function lockCameraAppearance() {
  const track = video.srcObject?.getVideoTracks?.()[0];
  if (!track?.getCapabilities || !track?.applyConstraints) return;
  const capabilities = track.getCapabilities();
  const settings = track.getSettings();
  const manual = {};
  if (capabilities.exposureMode?.includes("manual")) {
    manual.exposureMode = "manual";
    if (Number.isFinite(settings.exposureTime)) manual.exposureTime = settings.exposureTime;
  }
  if (capabilities.whiteBalanceMode?.includes("manual")) {
    manual.whiteBalanceMode = "manual";
    if (Number.isFinite(settings.colorTemperature)) manual.colorTemperature = settings.colorTemperature;
  }
  if (Object.keys(manual).length) await track.applyConstraints({ advanced: [manual] }).catch(() => {});
}

function setExperience(nextExperience) {
  if (!EXPERIENCE_META[nextExperience]) return;
  const previousExperience = activeExperience;
  activeExperience = nextExperience;
  const meta = EXPERIENCE_META[nextExperience];
  stage.dataset.experience = nextExperience;
  experienceEyebrow.textContent = meta.eyebrow;
  experienceDescription.textContent = meta.description;
  stageExperience.textContent = meta.stage;
  captureRow.classList.toggle("hidden", nextExperience !== "effects");
  drawState.previousPoint = null;
  drawState.smoothedPoint = null;
  resetEchoHistory();
  if (previousExperience !== nextExperience) {
    signState.holdStartedAt = 0;
    signState.detected = null;
  }
  document.querySelectorAll(".experience-button").forEach((button) => {
    const selected = button.dataset.experience === nextExperience;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  document.querySelectorAll(".control-panel").forEach((item) => {
    item.classList.toggle("active", item.dataset.experiencePanel === nextExperience);
  });
  syncScoreboard();
  updateSignChallenge(0);
  paintModeChip();
}

function hasConfidentGesture(name, minScore = GESTURE_CONFIDENCE) {
  return latestGesture === name && latestGestureScore >= minScore;
}

function updateRecognition(result) {
  latestLandmarks = result?.landmarks?.[0];
  const top = result?.gestures?.[0]?.[0];
  latestGesture = top?.categoryName ?? "None";
  latestGestureScore = top?.score ?? 0;
  latestHandedness = result?.handedness?.[0]?.[0]?.categoryName ?? "";
  setTextIfChanged(gestureReadout, latestLandmarks
    ? (FRIENDLY_GESTURES[latestGesture] ?? latestGesture.toUpperCase())
    : "NO HAND");
  setTextIfChanged(gestureDetail, latestLandmarks
    ? `${latestHandedness || "HAND"} · ${Math.round(latestGestureScore * 100)}% CONFIDENCE`
    : "Show one hand to the camera");

  if (activeExperience !== "effects") return;
  currentMode = stabilizer.update(latestGesture, latestGestureScore);
  effectNotice = "";
  if (currentMode === "invisible" && segmenterUnavailable) effectNotice = "CLOAK UNAVAILABLE";
  else if (currentMode === "invisible" && !segmenter) effectNotice = "CLOAK ENGINE LOADING";
  else if (currentMode === "invisible" && !backgroundReady) effectNotice = "CAPTURE BACKGROUND FIRST";
  if (currentMode !== lastMode) {
    resetEchoHistory();
    cloakFrameReady = false;
    lastMode = currentMode;
  }
}

function drawNormal() {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
}

function updateSceneBrightness(now) {
  if (now - lastBrightnessAt < 700 || !backgroundReady) return;
  lastBrightnessAt = now;
  const width = brightnessSample.width;
  const height = brightnessSample.height;
  brightnessSampleCtx.drawImage(video, 0, 0, width, height);
  const live = brightnessSampleCtx.getImageData(0, 0, width, height).data;
  brightnessSampleCtx.drawImage(background, 0, 0, width, height);
  const plate = brightnessSampleCtx.getImageData(0, 0, width, height).data;
  let liveLight = 0;
  let plateLight = 0;
  let samples = 0;
  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const onBorder = x < width * .2 || x > width * .8 || y < height * .18;
      if (!onBorder) continue;
      const index = (y * width + x) * 4;
      liveLight += live[index] * .2126 + live[index + 1] * .7152 + live[index + 2] * .0722;
      plateLight += plate[index] * .2126 + plate[index + 1] * .7152 + plate[index + 2] * .0722;
      samples += 1;
    }
  }
  const ratio = liveLight / Math.max(1, plateLight);
  if (samples && Number.isFinite(ratio)) sceneBrightness = Math.max(.78, Math.min(1.22, ratio));
}

function buildCloakFrame(result, now) {
  const categoryMask = result.categoryMask;
  const confidenceMask = result.confidenceMasks?.[0];
  if (!categoryMask) return;
  if (personMask.width !== categoryMask.width || personMask.height !== categoryMask.height) {
    personMask.width = categoryMask.width;
    personMask.height = categoryMask.height;
    matteImageData = personMaskCtx.createImageData(categoryMask.width, categoryMask.height);
  }

  const categories = categoryMask.getAsUint8Array();
  const confidences = confidenceMask?.getAsFloat32Array();
  let classZeroConfidence = 0;
  let classOneConfidence = 0;
  let classZeroSamples = 0;
  let classOneSamples = 0;
  if (confidences) {
    for (let index = 0; index < categories.length; index += 64) {
      if (categories[index] === 0) {
        classZeroConfidence += confidences[index];
        classZeroSamples += 1;
      } else {
        classOneConfidence += confidences[index];
        classOneSamples += 1;
      }
    }
  }
  const confidenceIsPerson = !confidences ||
    classZeroConfidence / Math.max(1, classZeroSamples) >= classOneConfidence / Math.max(1, classOneSamples);
  const pixels = matteImageData.data;
  for (let index = 0, pixel = 0; index < categories.length; index += 1, pixel += 4) {
    const probability = confidences
      ? (confidenceIsPerson ? confidences[index] : 1 - confidences[index])
      : (categories[index] === 0 ? 1 : 0);
    const feathered = smoothstep(.14, .72, probability);
    pixels[pixel] = 255;
    pixels[pixel + 1] = 255;
    pixels[pixel + 2] = 255;
    pixels[pixel + 3] = Math.round(feathered * 255);
  }
  personMaskCtx.putImageData(matteImageData, 0, 0);

  fullSizeMaskCtx.clearRect(0, 0, fullSizeMask.width, fullSizeMask.height);
  fullSizeMaskCtx.imageSmoothingEnabled = true;
  fullSizeMaskCtx.imageSmoothingQuality = "high";
  fullSizeMaskCtx.filter = "blur(2.4px)";
  fullSizeMaskCtx.drawImage(personMask, -2, -2, fullSizeMask.width + 4, fullSizeMask.height + 4);
  fullSizeMaskCtx.filter = "none";

  updateSceneBrightness(now);
  cloakCtx.clearRect(0, 0, cloakLayer.width, cloakLayer.height);
  cloakCtx.save();
  cloakCtx.filter = `brightness(${sceneBrightness})`;
  cloakCtx.drawImage(background, 0, 0, cloakLayer.width, cloakLayer.height);
  cloakCtx.filter = "none";
  cloakCtx.globalCompositeOperation = "destination-in";
  cloakCtx.drawImage(fullSizeMask, 0, 0);
  cloakCtx.restore();
  cloakFrameReady = true;

  categoryMask.close?.();
  confidenceMask?.close?.();
}

function requestCloakFrame(now) {
  if (!segmenter || segmentationBusy || now - lastSegmentationAt < SEGMENTATION_INTERVAL_MS) return;
  segmentationBusy = true;
  lastSegmentationAt = now;
  try {
    segmenter.segmentForVideo(video, now, (result) => {
      try {
        buildCloakFrame(result, now);
      } finally {
        segmentationBusy = false;
      }
    });
  } catch (error) {
    segmentationBusy = false;
    console.warn("Cloak frame failed", error);
  }
}

function drawInvisible(now) {
  drawNormal();
  requestCloakFrame(now);
  if (cloakFrameReady) ctx.drawImage(cloakLayer, 0, 0);
}

function drawGlitch(now) {
  drawNormal();
  const width = canvas.width;
  const height = canvas.height;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let index = 0; index < 9; index += 1) {
    const y = Math.floor((index * 97 + now * .13) % height);
    const sliceHeight = 8 + Math.floor(Math.random() * 42);
    const offset = (Math.random() - .5) * 70;
    ctx.globalAlpha = .7;
    ctx.drawImage(video, 0, y, width, sliceHeight, offset + 10, y, width, sliceHeight);
    ctx.fillStyle = index % 2 ? "rgba(200,255,66,.16)" : "rgba(255,45,120,.12)";
    ctx.fillRect(0, y, width, sliceHeight);
  }
  ctx.restore();
}

function drawEcho() {
  ensureEchoFrames();
  const newestFrame = echoFrames[echoCursor];
  newestFrame.getContext("2d").drawImage(video, 0, 0, newestFrame.width, newestFrame.height);
  echoCursor = (echoCursor + 1) % echoFrames.length;
  echoFrameCount = Math.min(echoFrameCount + 1, echoFrames.length);
  ctx.fillStyle = "#07090d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let order = 0; order < echoFrameCount; order += 1) {
    const frameIndex = (echoCursor - echoFrameCount + order + echoFrames.length) % echoFrames.length;
    const frame = echoFrames[frameIndex];
    ctx.save();
    ctx.globalAlpha = .1 + order * .12;
    ctx.globalCompositeOperation = order % 2 ? "screen" : "source-over";
    const scale = 1 + (echoFrameCount - order - 1) * .012;
    const width = canvas.width * scale;
    const height = canvas.height * scale;
    ctx.drawImage(frame, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    ctx.restore();
  }
}

function ensureEchoFrames() {
  const wrongSize = echoFrames.some((frame) => frame.width !== canvas.width || frame.height !== canvas.height);
  if (echoFrames.length === 6 && !wrongSize) return;
  echoFrames = Array.from({ length: 6 }, () => {
    const frame = document.createElement("canvas");
    frame.width = canvas.width;
    frame.height = canvas.height;
    return frame;
  });
  resetEchoHistory();
}

function resetEchoHistory() {
  echoCursor = 0;
  echoFrameCount = 0;
}

function renderEffects(now) {
  if (currentMode === "invisible" && backgroundReady && segmenter) drawInvisible(now);
  else if (currentMode === "glitch") drawGlitch(now);
  else if (currentMode === "echo") drawEcho();
  else drawNormal();
}

function renderAirCanvas(now) {
  drawNormal();
  ctx.fillStyle = "rgba(4,7,10,.12)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const point = latestLandmarks?.[8] ? toCanvasPoint(latestLandmarks[8], canvas.width, canvas.height) : null;
  const pinching = isPinching(latestLandmarks);

  if (point) {
    drawState.smoothedPoint = drawState.smoothedPoint
      ? { x: drawState.smoothedPoint.x * .58 + point.x * .42, y: drawState.smoothedPoint.y * .58 + point.y * .42 }
      : point;
  } else {
    drawState.smoothedPoint = null;
    drawState.previousPoint = null;
  }

  if (hasConfidentGesture("Victory")) {
    if (!drawState.victoryLatched) {
      drawState.colorIndex = (drawState.colorIndex + 1) % drawState.colors.length;
      drawState.color = drawState.colors[drawState.colorIndex];
      drawState.victoryLatched = true;
      syncColorSwatches();
    }
  } else {
    drawState.victoryLatched = false;
  }

  if (hasConfidentGesture("Closed_Fist")) {
    if (!drawState.fistStartedAt) drawState.fistStartedAt = now;
    if (now - drawState.fistStartedAt > 850 && !drawState.clearLatched) {
      drawingCtx.clearRect(0, 0, drawing.width, drawing.height);
      drawState.clearLatched = true;
    }
  } else {
    drawState.fistStartedAt = 0;
    drawState.clearLatched = false;
  }

  if (drawState.smoothedPoint && pinching) {
    drawingCtx.globalCompositeOperation = "source-over";
    drawingCtx.strokeStyle = drawState.color;
    drawingCtx.fillStyle = drawState.color;
    drawingCtx.lineWidth = 8;
    drawingCtx.lineCap = "round";
    drawingCtx.lineJoin = "round";
    if (drawState.previousPoint) {
      drawingCtx.beginPath();
      drawingCtx.moveTo(drawState.previousPoint.x, drawState.previousPoint.y);
      drawingCtx.lineTo(drawState.smoothedPoint.x, drawState.smoothedPoint.y);
      drawingCtx.stroke();
    } else {
      drawingCtx.beginPath();
      drawingCtx.arc(drawState.smoothedPoint.x, drawState.smoothedPoint.y, 4, 0, Math.PI * 2);
      drawingCtx.fill();
    }
    drawState.previousPoint = { ...drawState.smoothedPoint };
  } else if (drawState.smoothedPoint && hasConfidentGesture("Open_Palm")) {
    drawingCtx.save();
    drawingCtx.globalCompositeOperation = "destination-out";
    drawingCtx.beginPath();
    drawingCtx.arc(drawState.smoothedPoint.x, drawState.smoothedPoint.y, 30, 0, Math.PI * 2);
    drawingCtx.fill();
    drawingCtx.restore();
    drawState.previousPoint = null;
  } else {
    drawState.previousPoint = null;
  }

  ctx.drawImage(drawing, 0, 0);
  if (drawState.smoothedPoint) drawPointer(drawState.smoothedPoint, pinching ? drawState.color : "#ffffff", pinching ? 10 : 16);
}

function drawLandmarkHud(now, accent = "#c8ff42") {
  if (!latestLandmarks) return;
  const points = latestLandmarks.map((landmark) => toCanvasPoint(landmark, canvas.width, canvas.height));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs) - 18;
  const top = Math.min(...ys) - 18;
  const width = Math.max(...xs) - Math.min(...xs) + 36;
  const height = Math.max(...ys) - Math.min(...ys) + 36;

  ctx.save();
  ctx.strokeStyle = `${accent}66`;
  ctx.lineWidth = 1;
  ctx.setLineDash([7, 7]);
  ctx.strokeRect(left, top, width, height);
  ctx.setLineDash([]);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  for (const [start, end] of HAND_CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(points[start].x, points[start].y);
    ctx.lineTo(points[end].x, points[end].y);
    ctx.stroke();
  }
  points.forEach((point, index) => {
    const isTip = [4, 8, 12, 16, 20].includes(index);
    ctx.beginPath();
    ctx.fillStyle = isTip ? accent : "#0a0e10";
    ctx.strokeStyle = isTip ? "#ffffff" : accent;
    ctx.lineWidth = 2;
    ctx.arc(point.x, point.y, isTip ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  const pulse = 11 + Math.sin(now / 170) * 3;
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,.7)";
  ctx.lineWidth = 1;
  ctx.arc(points[8].x, points[8].y, pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function renderHandHud(now) {
  drawNormal();
  ctx.fillStyle = "rgba(3,7,10,.48)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawLandmarkHud(now);
}

function renderGame(now) {
  drawNormal();
  ctx.fillStyle = "rgba(2,6,9,.38)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!game.target) game.target = createTarget(canvas.width, canvas.height);

  const pulse = 1 + Math.sin(now / 180) * .08;
  const radius = game.target.radius * pulse;
  const glow = ctx.createRadialGradient(game.target.x, game.target.y, 0, game.target.x, game.target.y, radius * 1.9);
  glow.addColorStop(0, "rgba(255,255,255,.95)");
  glow.addColorStop(.28, "rgba(200,255,66,.95)");
  glow.addColorStop(1, "rgba(200,255,66,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(game.target.x, game.target.y, radius * 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(200,255,66,.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(game.target.x, game.target.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  const point = latestLandmarks?.[8] ? toCanvasPoint(latestLandmarks[8], canvas.width, canvas.height) : null;
  const pinching = isPinching(latestLandmarks);
  if (point) {
    drawPointer(point, pinching ? "#c8ff42" : "#ffffff", pinching ? 10 : 17);
    if (pinching && !game.pinchLatched) {
      if (hitTest(point, game.target)) hitOrb();
      else {
        game.streak = 0;
        syncScoreboard();
      }
    }
  }
  game.pinchLatched = pinching;

  if (hasConfidentGesture("Closed_Fist")) {
    if (!game.fistStartedAt) game.fistStartedAt = now;
    if (now - game.fistStartedAt > 850 && !game.resetLatched) {
      resetGame();
      game.resetLatched = true;
    }
  } else {
    game.fistStartedAt = 0;
    game.resetLatched = false;
  }
  renderParticles();
}

function hitOrb() {
  const origin = { ...game.target };
  game.score += 10 + Math.min(game.streak, 10) * 2;
  game.streak += 1;
  game.target = createTarget(canvas.width, canvas.height);
  for (let index = 0; index < 18; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4;
    game.particles.push({ x: origin.x, y: origin.y, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, life: 1 });
  }
  syncScoreboard();
}

function renderParticles() {
  game.particles = game.particles.filter((particle) => particle.life > .03);
  for (const particle of game.particles) {
    particle.x += particle.dx;
    particle.y += particle.dy;
    particle.life *= .94;
    ctx.globalAlpha = particle.life;
    ctx.fillStyle = "#c8ff42";
    ctx.fillRect(particle.x, particle.y, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function resetGame() {
  game.score = 0;
  game.streak = 0;
  game.particles = [];
  game.target = createTarget(canvas.width, canvas.height);
  syncScoreboard();
}

function updateSignChallenge(progress = 0) {
  const target = SIGN_CHALLENGES[signState.targetIndex];
  setTextIfChanged(signTarget, target.label);
  const states = getFingerStates(latestLandmarks);
  const guidance = signState.detected === target.id ? "Matched — keep holding steadily" : getSignGuidance(target.id, states);
  setTextIfChanged(signHint, latestLandmarks ? guidance : target.hint);
  signProgress.style.width = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`;
  setTextIfChanged(signScore, `${signState.matched} / ${SIGN_CHALLENGES.length} MATCHED`);
}

function renderSignLab(now) {
  drawNormal();
  ctx.fillStyle = "rgba(3,7,10,.42)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (signState.completeUntil) {
    if (now < signState.completeUntil) {
      drawLandmarkHud(now, "#55ddff");
      signProgress.style.width = "100%";
      setTextIfChanged(signHint, "Lesson complete — restarting…");
      setTextIfChanged(gestureReadout, "LESSON COMPLETE");
      return;
    }
    signState.completeUntil = 0;
    signState.matched = 0;
    signState.targetIndex = 0;
  }

  const target = SIGN_CHALLENGES[signState.targetIndex];
  const states = getFingerStates(latestLandmarks);
  signState.detected = classifyStaticSign(states);
  const matched = signState.detected === target.id;
  let progress = 0;
  if (matched) {
    if (!signState.holdStartedAt) signState.holdStartedAt = now;
    progress = (now - signState.holdStartedAt) / SIGN_HOLD_MS;
    if (progress >= 1) {
      signState.matched += 1;
      signState.targetIndex += 1;
      signState.holdStartedAt = 0;
      progress = 0;
      if (signState.targetIndex >= SIGN_CHALLENGES.length) {
        signState.targetIndex = 0;
        signState.completeUntil = now + 1700;
        setTextIfChanged(signAnnouncement, "Sign Lab lesson complete.");
      } else {
        setTextIfChanged(signAnnouncement, `${target.label} matched. Next handshape: ${SIGN_CHALLENGES[signState.targetIndex].label}.`);
      }
    }
  } else {
    signState.holdStartedAt = 0;
  }

  if (signState.detected) setTextIfChanged(gestureReadout, `HANDSHAPE ${signState.detected}`);
  drawLandmarkHud(now, matched ? "#55ddff" : "#c8ff42");
  updateSignChallenge(progress);
}

function resetPong() {
  pong.ball = canvas.width && canvas.height ? createPongBall(canvas.width, canvas.height) : null;
  pong.paddleCenter = canvas.height / 2;
  pong.score = 0;
  pong.lives = 3;
  pong.gameOver = false;
  pong.fistStartedAt = 0;
  pong.resetLatched = false;
  pong.lastFrameAt = 0;
  syncScoreboard();
}

function renderPong(now) {
  drawNormal();
  ctx.fillStyle = "rgba(2,5,11,.64)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const paddleHeight = Math.max(74, canvas.height * .2);
  const paddleWidth = Math.max(12, canvas.width * .018);
  const palmY = latestLandmarks?.[9]?.y * canvas.height;
  if (Number.isFinite(palmY)) pong.paddleCenter += (palmY - pong.paddleCenter) * .34;
  if (pong.keyboardDirection) pong.paddleCenter += pong.keyboardDirection * canvas.height * .018;
  pong.paddleCenter = Math.max(paddleHeight / 2, Math.min(canvas.height - paddleHeight / 2, pong.paddleCenter));
  const paddle = {
    x: Math.max(34, canvas.width * .065),
    y: pong.paddleCenter - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
  };

  const delta = pong.lastFrameAt ? Math.max(.25, Math.min(1.8, (now - pong.lastFrameAt) / 16.667)) : 1;
  pong.lastFrameAt = now;
  if (!pong.ball) pong.ball = createPongBall(canvas.width, canvas.height);
  if (!pong.gameOver) {
    const result = advancePong(pong.ball, paddle, canvas.width, canvas.height, delta);
    pong.ball = result.ball;
    if (result.event === "hit") {
      pong.score += 1;
      syncScoreboard();
    } else if (result.event === "miss") {
      pong.lives -= 1;
      if (pong.lives <= 0) pong.gameOver = true;
      else pong.ball = createPongBall(canvas.width, canvas.height);
      syncScoreboard();
    }
  }

  ctx.save();
  ctx.setLineDash([8, 14]);
  ctx.strokeStyle = "rgba(85,221,255,.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowColor = "#55ddff";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "#55ddff";
  ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
  if (pong.ball) {
    ctx.shadowColor = "#ff4f9a";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(pong.ball.x, pong.ball.y, pong.ball.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (latestLandmarks?.[9]) drawPointer(toCanvasPoint(latestLandmarks[9], canvas.width, canvas.height), "#55ddff", 13);
  if (pong.gameOver) {
    ctx.fillStyle = "rgba(3,6,10,.72)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${Math.max(26, canvas.width * .048)}px DM Sans, sans-serif`;
    ctx.fillText("RUN OVER", canvas.width / 2, canvas.height / 2 - 8);
    ctx.fillStyle = "#c8ff42";
    ctx.font = `700 ${Math.max(11, canvas.width * .018)}px Space Mono, monospace`;
    ctx.fillText("HOLD A FIST OR PRESS R TO RESTART", canvas.width / 2, canvas.height / 2 + 28);
  }

  if (hasConfidentGesture("Closed_Fist")) {
    if (!pong.fistStartedAt) pong.fistStartedAt = now;
    if (now - pong.fistStartedAt > 850 && !pong.resetLatched) {
      resetPong();
      pong.resetLatched = true;
    }
  } else {
    pong.fistStartedAt = 0;
    pong.resetLatched = false;
  }
}

function syncScoreboard() {
  if (activeExperience === "pong") {
    setTextIfChanged(primaryScoreLabel, "SCORE");
    setTextIfChanged(secondaryScoreLabel, "LIVES");
    setTextIfChanged(scoreValue, String(pong.score));
    setTextIfChanged(streakValue, String(pong.lives));
  } else {
    setTextIfChanged(primaryScoreLabel, "SCORE");
    setTextIfChanged(secondaryScoreLabel, "STREAK");
    setTextIfChanged(scoreValue, String(game.score));
    setTextIfChanged(streakValue, String(game.streak));
  }
}

function setTextIfChanged(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function drawPointer(point, color, radius) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = `${color}33`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function cycleToColor(color) {
  const index = drawState.colors.indexOf(color);
  if (index < 0) return;
  drawState.color = color;
  drawState.colorIndex = index;
  syncColorSwatches();
}

function syncColorSwatches() {
  document.querySelectorAll(".color-swatch").forEach((swatch) => {
    const selected = swatch.dataset.color === drawState.color;
    swatch.classList.toggle("active", selected);
    swatch.setAttribute("aria-pressed", String(selected));
  });
}

function paintModeChip() {
  const effectLabels = { normal: "NORMAL", invisible: "INVISIBLE", glitch: "GLITCH", echo: "GHOST ECHO" };
  let label;
  if (activeExperience === "effects") label = effectNotice || effectLabels[currentMode];
  else if (activeExperience === "draw") {
    if (hasConfidentGesture("Open_Palm")) label = "ERASER";
    else if (isPinching(latestLandmarks)) label = "DRAWING";
    else label = "PINCH TO DRAW";
  } else if (activeExperience === "hud") label = latestLandmarks ? "21 POINTS LOCKED" : "SHOW YOUR HAND";
  else if (activeExperience === "game") label = latestLandmarks ? "PINCH THE ORB" : "SHOW YOUR HAND";
  else if (activeExperience === "sign") {
    if (signState.completeUntil) label = "LESSON COMPLETE";
    else label = signState.detected ? `DETECTED ${signState.detected}` : "MATCH THE TARGET";
  } else if (activeExperience === "pong") {
    if (pong.gameOver) label = "RUN OVER";
    else label = latestLandmarks ? "PALM = PADDLE" : "SHOW YOUR HAND";
  }
  setTextIfChanged(modeChip, label);
  modeChip.classList.add("visible");
  document.querySelectorAll(".gesture-card[data-mode]").forEach((card) => {
    card.classList.toggle("active", activeExperience === "effects" && card.dataset.mode === currentMode);
  });
}

function render(now) {
  if (video.currentTime !== lastVideoTime && now - lastRecognitionAt >= RECOGNITION_INTERVAL_MS) {
    lastVideoTime = video.currentTime;
    lastRecognitionAt = now;
    updateRecognition(recognizer.recognizeForVideo(video, now));
  }

  if (activeExperience === "effects") renderEffects(now);
  else if (activeExperience === "draw") renderAirCanvas(now);
  else if (activeExperience === "hud") renderHandHud(now);
  else if (activeExperience === "game") renderGame(now);
  else if (activeExperience === "sign") renderSignLab(now);
  else if (activeExperience === "pong") renderPong(now);

  paintModeChip();
  const instantFps = 1000 / Math.max(1, now - previousFrameTime);
  fpsSmoothed = fpsSmoothed ? fpsSmoothed * .9 + instantFps * .1 : instantFps;
  fpsLabel.textContent = `${Math.round(fpsSmoothed)} FPS`;
  previousFrameTime = now;
  requestAnimationFrame(render);
}

startButton.disabled = true;
startButton.addEventListener("click", startCamera);
captureButton.addEventListener("click", captureBackground);
document.querySelectorAll(".experience-button").forEach((button) => {
  button.addEventListener("click", () => setExperience(button.dataset.experience));
});
document.querySelectorAll(".color-swatch").forEach((swatch) => {
  swatch.addEventListener("click", () => cycleToColor(swatch.dataset.color));
});
window.addEventListener("keydown", (event) => {
  if (activeExperience === "pong" && ["ArrowUp", "ArrowDown"].includes(event.key)) event.preventDefault();
  if (event.key === "ArrowUp") pong.keyboardDirection = -1;
  if (event.key === "ArrowDown") pong.keyboardDirection = 1;
  if (activeExperience === "pong" && event.key.toLowerCase() === "r") resetPong();
});
window.addEventListener("keyup", (event) => {
  if (["ArrowUp", "ArrowDown"].includes(event.key)) pong.keyboardDirection = 0;
});
window.addEventListener("resize", () => {
  if (video.srcObject) resizeCanvases();
});

syncColorSwatches();
setExperience("effects");
loadModels();
