import { isPinching, normalizedPinchDistance, toCanvasPoint } from "./interaction-utils.js";
import { getFingerStates } from "./sign-utils.js";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const seeded = seed => (Math.sin(seed * 91.733) * 43758.5453) % 1;
const positiveSeed = seed => Math.abs(seeded(seed));

export function isPointingHand(hand) {
  const states = getFingerStates(hand);
  return Boolean(states?.[1] && !states[2] && !states[3] && !states[4]);
}

export function isOpenHand(hand) {
  const states = getFingerStates(hand);
  return Boolean(states?.slice(1).every(Boolean));
}

export function handBloomAmount(hand) {
  const distance = normalizedPinchDistance(hand);
  return distance === null ? 0 : clamp((distance - .16) / 1.08);
}

function drawStar(ctx, radius, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const angle = -Math.PI / 2 + i * Math.PI / points;
    const r = i % 2 ? radius * .43 : radius;
    const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function drawDaisy(ctx, radius, color, seed) {
  const petals = 7 + Math.floor(positiveSeed(seed) * 4);
  ctx.fillStyle = color;
  for (let i = 0; i < petals; i += 1) {
    ctx.save(); ctx.rotate(i * Math.PI * 2 / petals);
    ctx.beginPath(); ctx.ellipse(radius * .63, 0, radius * .58, radius * .25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "#ffd85a"; ctx.beginPath(); ctx.arc(0, 0, radius * .3, 0, Math.PI * 2); ctx.fill();
}

function drawTulip(ctx, radius, color) {
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(-radius * .72, radius * .35);
  ctx.bezierCurveTo(-radius, -radius * .52, -radius * .55, -radius, 0, -radius * .42);
  ctx.bezierCurveTo(radius * .55, -radius, radius, -radius * .52, radius * .72, radius * .35);
  ctx.quadraticCurveTo(0, radius * .82, -radius * .72, radius * .35); ctx.fill();
}

function drawRose(ctx, radius, color) {
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, radius * .18); ctx.lineCap = "round";
  for (let ring = 0; ring < 3; ring += 1) {
    ctx.beginPath();
    for (let i = 0; i <= 32; i += 1) {
      const angle = i / 32 * Math.PI * 2 + ring * .8;
      const wave = radius * (.32 + ring * .2 + .12 * Math.sin(angle * 3));
      const x = Math.cos(angle) * wave, y = Math.sin(angle) * wave * .72;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
}

function drawSpiderLily(ctx, radius, bloom = 1) {
  const open = .15 + bloom * .85;
  ctx.lineCap = "round";
  for (let i = 0; i < 9; i += 1) {
    const angle = i * Math.PI * 2 / 9;
    ctx.save(); ctx.rotate(angle);
    ctx.strokeStyle = i % 2 ? "#ff315d" : "#ff173e";
    ctx.lineWidth = Math.max(1.2, radius * .075);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(radius * .18, -radius * .55 * open, radius * .78 * open, -radius * .75, radius * open, 0);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,95,119,.9)"; ctx.lineWidth = Math.max(1, radius * .035);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(radius * .55, radius * .2, radius * 1.18 * open, -radius * .16); ctx.stroke();
    ctx.fillStyle = "#ffe5a5"; ctx.beginPath(); ctx.arc(radius * 1.18 * open, -radius * .16, Math.max(1.2, radius * .055), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawFlower(ctx, flower, now, forcedBloom = 1) {
  const born = clamp((now - flower.born) / 280);
  const pulse = 1 + Math.sin(now * .0027 + flower.seed) * .035;
  const radius = flower.radius * born * pulse;
  ctx.save(); ctx.translate(flower.x, flower.y); ctx.rotate(flower.rotation || 0);
  ctx.shadowColor = flower.color; ctx.shadowBlur = radius * .72;
  if (flower.kind === "tulip") drawTulip(ctx, radius, flower.color);
  else if (flower.kind === "rose") drawRose(ctx, radius, flower.color);
  else if (flower.kind === "lily") drawSpiderLily(ctx, radius, forcedBloom);
  else if (flower.kind === "star") { ctx.fillStyle = flower.color; drawStar(ctx, radius); ctx.fill(); }
  else drawDaisy(ctx, radius, flower.color, flower.seed);
  ctx.restore();
}

function drawStem(ctx, x, base, top, growth, branch = 0) {
  const tip = base + (top - base) * growth;
  ctx.save(); ctx.strokeStyle = "#3dc76b"; ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.shadowColor = "#1e8f52"; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.moveTo(x, base); ctx.bezierCurveTo(x - 20 * branch, base - 55 * growth, x + 18 * branch, tip + 35, x, tip); ctx.stroke();
  if (growth > .35) {
    ctx.fillStyle = "#3dc76b";
    ctx.save(); ctx.translate(x, base + (tip - base) * .56); ctx.rotate(-.65);
    ctx.beginPath(); ctx.ellipse(13, 0, 15, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.restore();
  return tip;
}

export function createBloomStudio({ canvas, ctx }) {
  let scene = "wand", flowers = [], particles = [], previousTips = new Map();
  let openLatched = false, lastPlantAt = 0, frameAt = 0, flowerId = 0;
  const sceneSelect = document.querySelector("#bloomScene");
  const help = document.querySelector("#bloomHelp");

  function reset() { flowers = []; particles = []; previousTips.clear(); openLatched = false; }
  function enter() { previousTips.clear(); openLatched = false; }
  sceneSelect?.addEventListener("change", event => { scene = event.target.value; reset(); syncHelp(); });
  document.querySelector("#clearBloom")?.addEventListener("click", reset);

  function syncHelp(status = "") {
    const instructions = {
      wand: "Point to plant flowers. Open your palm once to scatter the whole garden.",
      red: "Point and move slowly to paint luminous red blooms and stems.",
      garden: "Use the left-side hand spread to grow the stem and the right-side hand spread to open the bloom.",
      lilies: "Spread each thumb and index finger to open a spider lily; pinch to close it into a bud.",
      storm: "Move one palm to repel the field. Bring two hands close to pull the storm together.",
    };
    if (help) help.textContent = status || instructions[scene];
  }

  function spawn(x, y, now, red = false) {
    const kinds = red ? ["lily", "rose", "tulip"] : ["daisy", "tulip", "rose", "star"];
    const colors = red ? ["#ff173e", "#ff315d", "#ff6b7d"] : ["#ff4f9a", "#ffd85a", "#6fe7ff", "#b991ff", "#ff775f", "#fff4d6"];
    const id = flowerId++;
    flowers.push({ id, x, y, born: now, seed: id * 1.73, radius: 11 + positiveSeed(id + 3) * 13,
      kind: kinds[id % kinds.length], color: colors[id % colors.length], rotation: positiveSeed(id + 8) * Math.PI, vx: 0, vy: 0, scattered: false });
    if (flowers.length > 340) flowers.splice(0, flowers.length - 340);
  }

  function plantTrail(hands, now, red) {
    let planted = false;
    hands.forEach((hand, index) => {
      if (!isPointingHand(hand) || !hand[8]) { previousTips.delete(index); return; }
      const point = toCanvasPoint(hand[8], canvas.width, canvas.height);
      const previous = previousTips.get(index);
      const distance = previous ? Math.hypot(point.x - previous.x, point.y - previous.y) : Infinity;
      if ((distance > (red ? 17 : 24) || now - lastPlantAt > 150) && now - lastPlantAt > 45) {
        spawn(point.x, point.y, now, red); lastPlantAt = now; planted = true;
        if (red && previous) {
          ctx.save(); ctx.strokeStyle = "rgba(67,201,104,.75)"; ctx.lineWidth = 2; ctx.beginPath();
          ctx.moveTo(previous.x, previous.y); ctx.quadraticCurveTo((previous.x + point.x) / 2, Math.max(previous.y, point.y) + 18, point.x, point.y); ctx.stroke(); ctx.restore();
        }
      }
      previousTips.set(index, point);
    });
    return planted;
  }

  function scatterFlowers(hands) {
    const open = hands.some(isOpenHand);
    if (open && !openLatched) {
      const center = hands.find(isOpenHand)?.[9];
      const origin = center ? toCanvasPoint(center, canvas.width, canvas.height) : { x: canvas.width / 2, y: canvas.height / 2 };
      for (const flower of flowers) {
        const angle = Math.atan2(flower.y - origin.y, flower.x - origin.x) + (positiveSeed(flower.id) - .5) * 1.2;
        const speed = 2.2 + positiveSeed(flower.id + 2) * 5;
        flower.vx = Math.cos(angle) * speed; flower.vy = Math.sin(angle) * speed - 2.5; flower.scattered = true;
      }
    }
    openLatched = open;
  }

  function renderFlowers(now, hands, red = false) {
    plantTrail(hands, now, red); scatterFlowers(hands);
    for (const flower of flowers) {
      if (flower.scattered) { flower.vy += .08; flower.vx *= .995; flower.x += flower.vx; flower.y += flower.vy; flower.rotation += flower.vx * .025; }
      if (red && !flower.scattered) {
        ctx.strokeStyle = "rgba(51,167,84,.7)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(flower.x, canvas.height); ctx.quadraticCurveTo(flower.x + Math.sin(flower.seed) * 25, (flower.y + canvas.height) / 2, flower.x, flower.y); ctx.stroke();
      }
      drawFlower(ctx, flower, now);
    }
    flowers = flowers.filter(f => !f.scattered || (f.y < canvas.height + 80 && f.x > -80 && f.x < canvas.width + 80));
    return hands.some(isOpenHand) ? "OPEN PALM · SCATTER" : hands.some(isPointingHand) ? "PLANTING BLOOMS" : "POINT TO PLANT";
  }

  function renderGarden(now, hands) {
    const ordered = [...hands].sort((a, b) => a[9].x - b[9].x);
    const growth = ordered[0] ? handBloomAmount(ordered[0]) : .15;
    const bloom = ordered[1] ? handBloomAmount(ordered[1]) : ordered[0] ? growth : .12;
    const base = canvas.height * .92, x = canvas.width * .5;
    const top = drawStem(ctx, x, base, canvas.height * .23, growth, .5);
    if (growth > .42) {
      const left = drawStem(ctx, x - 2, base * .72, canvas.height * .42, clamp((growth - .32) / .68), -1);
      const right = drawStem(ctx, x + 2, base * .72, canvas.height * .46, clamp((growth - .38) / .62), 1);
      drawFlower(ctx, { x: x - 58 * growth, y: left, born: 0, seed: 2, radius: 26, kind: "tulip", color: "#ff4f78" }, now, bloom);
      drawFlower(ctx, { x: x + 58 * growth, y: right, born: 0, seed: 3, radius: 22, kind: "rose", color: "#ff315d" }, now, bloom);
    }
    ctx.save(); ctx.translate(x, top); ctx.scale(.25 + bloom * .9, .25 + bloom * .9);
    drawSpiderLily(ctx, 42, bloom); ctx.restore();
    return hands.length < 2 ? "SHOW TWO HANDS · SPREAD THUMB + INDEX" : `GROW ${Math.round(growth * 100)}% · BLOOM ${Math.round(bloom * 100)}%`;
  }

  function renderLilies(now, hands) {
    if (!hands.length) return "SHOW YOUR HANDS";
    hands.slice(0, 2).forEach((hand, index) => {
      const point = toCanvasPoint(hand[8], canvas.width, canvas.height), bloom = handBloomAmount(hand);
      ctx.strokeStyle = "rgba(60,210,110,.78)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(point.x, canvas.height); ctx.quadraticCurveTo(point.x + (index ? 44 : -44), canvas.height * .67, point.x, point.y); ctx.stroke();
      ctx.save(); ctx.translate(point.x, point.y); ctx.rotate((index ? 1 : -1) * .12); drawSpiderLily(ctx, 35, bloom); ctx.restore();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(point.x, point.y, 3, 0, Math.PI * 2); ctx.fill();
    });
    return "SPREAD TO BLOOM · PINCH TO BUD";
  }

  function ensureParticles() {
    if (particles.length) return;
    const count = 720;
    particles = Array.from({ length: count }, (_, i) => {
      const angle = i * 2.39996, radius = Math.sqrt(i / count) * Math.min(canvas.width, canvas.height) * .38;
      return { x: canvas.width / 2 + Math.cos(angle) * radius, y: canvas.height / 2 + Math.sin(angle) * radius,
        homeX: canvas.width / 2 + Math.cos(angle) * radius, homeY: canvas.height / 2 + Math.sin(angle) * radius,
        vx: 0, vy: 0, color: i % 3 === 0 ? "#ff4f9a" : i % 3 === 1 ? "#7fe8ff" : "#c8ff42", phase: i * .37 };
    });
  }

  function renderStorm(now, hands, dt) {
    ensureParticles();
    const centers = hands.map(hand => toCanvasPoint(hand[9], canvas.width, canvas.height));
    const pulling = centers.length > 1 && Math.hypot(centers[0].x - centers[1].x, centers[0].y - centers[1].y) < canvas.width * .34;
    for (const particle of particles) {
      particle.vx += (particle.homeX - particle.x) * .0018 * dt;
      particle.vy += (particle.homeY - particle.y) * .0018 * dt;
      for (const center of centers) {
        const dx = center.x - particle.x, dy = center.y - particle.y, d2 = Math.max(160, dx * dx + dy * dy);
        const force = (pulling ? 210 : -260) / d2 * dt;
        particle.vx += dx * force; particle.vy += dy * force;
        if (pulling) { particle.vx += -dy * .00025 * dt; particle.vy += dx * .00025 * dt; }
      }
      particle.vx *= .965; particle.vy *= .965;
      particle.x += particle.vx * dt; particle.y += particle.vy * dt;
    }
    ctx.save(); ctx.globalCompositeOperation = "screen";
    for (const p of particles) {
      const glow = 1.2 + Math.sin(now * .004 + p.phase) * .7;
      ctx.fillStyle = p.color; ctx.globalAlpha = .62; ctx.beginPath(); ctx.arc(p.x, p.y, glow, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    for (const center of centers) { ctx.strokeStyle = pulling ? "#ff4f9a" : "#7fe8ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(center.x, center.y, 22, 0, Math.PI * 2); ctx.stroke(); }
    return !centers.length ? "SHOW A PALM" : pulling ? "MAGNETIC STORM" : "PALM FORCE FIELD";
  }

  function render(now, hands) {
    const dt = clamp(frameAt ? (now - frameAt) / 16.667 : 1, .25, 2.2); frameAt = now;
    ctx.save(); ctx.fillStyle = scene === "storm" ? "rgba(1,3,9,.72)" : scene === "lilies" ? "rgba(5,5,7,.48)" : "rgba(5,8,10,.18)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    let label;
    if (scene === "storm") label = renderStorm(now, hands, dt);
    else if (scene === "garden") label = renderGarden(now, hands);
    else if (scene === "lilies") label = renderLilies(now, hands);
    else label = renderFlowers(now, hands, scene === "red");
    ctx.restore(); syncHelp(); return label;
  }

  syncHelp();
  return { enter, render, reset, get scene() { return scene; } };
}
