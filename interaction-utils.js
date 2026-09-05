export const HAND_CONNECTIONS = Object.freeze([
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
]);

export const FRIENDLY_GESTURES = Object.freeze({
  None: "UNSURE",
  Closed_Fist: "CLOSED FIST",
  Open_Palm: "OPEN PALM",
  Pointing_Up: "POINTING UP",
  Thumb_Down: "THUMB DOWN",
  Thumb_Up: "THUMB UP",
  Victory: "VICTORY",
  ILoveYou: "I LOVE YOU",
});

export function distance2d(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function normalizedPinchDistance(landmarks) {
  if (!landmarks?.[4] || !landmarks?.[8] || !landmarks?.[5] || !landmarks?.[17]) return null;
  const palmWidth = distance2d(landmarks[5], landmarks[17]);
  if (palmWidth <= Number.EPSILON) return null;
  return distance2d(landmarks[4], landmarks[8]) / palmWidth;
}

export function isPinching(landmarks, threshold = 0.34) {
  const ratio = normalizedPinchDistance(landmarks);
  return ratio !== null && ratio < threshold;
}

export class PinchGate {
  constructor({ engageThreshold = 0.34, releaseThreshold = 0.48, releaseDelayMs = 90, lostDelayMs = 150 } = {}) {
    this.engageThreshold = engageThreshold;
    this.releaseThreshold = releaseThreshold;
    this.releaseDelayMs = releaseDelayMs;
    this.lostDelayMs = lostDelayMs;
    this.reset();
  }

  reset() {
    this.active = false;
    this.releaseStartedAt = 0;
    this.lastMeasurementAt = 0;
  }

  update(landmarks, now) {
    const ratio = normalizedPinchDistance(landmarks);
    if (ratio === null) {
      if (this.active && now - this.lastMeasurementAt <= this.lostDelayMs) return true;
      this.reset();
      return false;
    }

    this.lastMeasurementAt = now;
    if (!this.active) {
      if (ratio <= this.engageThreshold) this.active = true;
      return this.active;
    }

    if (ratio >= this.releaseThreshold) {
      if (!this.releaseStartedAt) this.releaseStartedAt = now;
      if (now - this.releaseStartedAt >= this.releaseDelayMs) this.reset();
    } else {
      this.releaseStartedAt = 0;
    }
    return this.active;
  }
}

export function smoothCanvasPoint(previous, next, elapsedMs = 16) {
  if (!next) return null;
  if (!previous) return { x: next.x, y: next.y };
  const distance = distance2d(previous, next);
  const speed = distance / Math.max(8, Math.min(80, elapsedMs));
  const alpha = Math.max(0.24, Math.min(0.82, 0.24 + speed * 0.72));
  return {
    x: previous.x + (next.x - previous.x) * alpha,
    y: previous.y + (next.y - previous.y) * alpha,
  };
}

export function toCanvasPoint(landmark, width, height) {
  return { x: landmark.x * width, y: landmark.y * height };
}

export function hitTest(point, target) {
  return Math.hypot(point.x - target.x, point.y - target.y) <= target.radius;
}

export function createTarget(width, height, random = Math.random) {
  const margin = Math.min(width, height) * 0.14;
  return {
    x: margin + random() * Math.max(1, width - margin * 2),
    y: margin + random() * Math.max(1, height - margin * 2),
    radius: Math.max(24, Math.min(width, height) * 0.055),
  };
}
