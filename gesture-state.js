export const GESTURE_TO_MODE = Object.freeze({
  Open_Palm: "invisible",
  Closed_Fist: "glitch",
  Victory: "echo",
  Pointing_Up: "normal",
});

export class GestureStabilizer {
  constructor({ framesRequired = 5, minScore = 0.62 } = {}) {
    this.framesRequired = framesRequired;
    this.minScore = minScore;
    this.candidate = null;
    this.frames = 0;
    this.mode = "normal";
  }

  update(gesture, score = 0) {
    const next = score >= this.minScore ? GESTURE_TO_MODE[gesture] : undefined;
    if (!next) {
      this.candidate = null;
      this.frames = 0;
      return this.mode;
    }

    if (next !== this.candidate) {
      this.candidate = next;
      this.frames = 1;
    } else {
      this.frames += 1;
    }

    if (this.frames >= this.framesRequired) this.mode = next;
    return this.mode;
  }
}
