// Small, deterministic interaction primitives shared by the camera studios.
export class PointingGate {
  constructor() { this.lostDelayMs = 150; this.reset(); }
  reset() { this.active = false; this.lastSeen = null; this.releaseAt = null; }
  update(states, now) {
    if (!states) {
      if (this.active && now - this.lastSeen <= this.lostDelayMs) return true;
      this.reset(); return false;
    }
    this.lastSeen = now;
    // Thumb position is deliberately unrestricted.
    const pointing = states[1] && !states[2] && !states[3] && !states[4];
    if (pointing) { this.active = true; this.releaseAt = null; }
    else if (this.active) {
      this.releaseAt ??= now;
      if (now - this.releaseAt >= 70) this.reset();
    }
    return this.active;
  }
}

export class HeldAction {
  constructor(delay = 250) { this.delay = delay; this.reset(); }
  reset() { this.value = null; this.since = null; }
  update(value, now) {
    if (value !== this.value) { this.value = value; this.since = now; }
    return value && now - this.since >= this.delay ? value : null;
  }
}

export class EditHistory {
  constructor(limit = 16) { this.limit = limit; this.undoStack = []; this.redoStack = []; }
  save(snapshot) {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }
  undo(current) {
    if (!this.undoStack.length) return null;
    this.redoStack.push(current);
    return this.undoStack.pop();
  }
  redo(current) {
    if (!this.redoStack.length) return null;
    this.undoStack.push(current);
    return this.redoStack.pop();
  }
}

export function frameBetweenHands(hands, width, height) {
  const a = hands?.[0]?.[8], b = hands?.[1]?.[8];
  if (!a || !b || ![a.x,a.y,b.x,b.y,width,height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  const w = Math.min(width, Math.max(60, Math.abs(a.x-b.x)*width));
  const h = Math.min(height, Math.max(45, Math.abs(a.y-b.y)*height));
  // A stable rectangular viewport with no rotation avoids flipping at crossings.
  return {
    x: Math.max(0, Math.min(width-w, Math.min(a.x, b.x) * width)),
    y: Math.max(0, Math.min(height-h, Math.min(a.y, b.y) * height)),
    width: w,
    height: h,
  };
}

export class EyeClosureTimer {
  constructor() { this.reset(); }
  reset() { this.since = null; this.alerted = false; }
  update(shapes, now, delayMs = 1800) {
    if (!shapes) { this.reset(); return { state: "NO FACE", progress: 0, alert: false }; }
    const closed = shapes.eyeBlinkLeft > 0.55 && shapes.eyeBlinkRight > 0.55;
    if (!closed) { this.reset(); return { state: "EYES OPEN", progress: 0, alert: false }; }
    this.since ??= now;
    const progress = Math.min(1, (now - this.since) / delayMs);
    const alert = progress === 1 && !this.alerted;
    if (alert) this.alerted = true;
    return { state: progress === 1 ? "TAKE A MOMENT" : "EYES CLOSED", progress, alert };
  }
}
