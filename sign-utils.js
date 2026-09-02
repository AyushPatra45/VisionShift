import { distance2d } from "./interaction-utils.js";

export const SIGN_CHALLENGES = Object.freeze([
  { id: "B", label: "B", hint: "Four fingers up · thumb tucked" },
  { id: "I", label: "I", hint: "Pinky up · other fingers tucked" },
  { id: "L", label: "L", hint: "Thumb + index finger up" },
  { id: "Y", label: "Y", hint: "Thumb + pinky up" },
  { id: "ILY", label: "I L Y", hint: "Thumb + index + pinky up" },
]);

const PATTERNS = Object.freeze({
  B: [false, true, true, true, true],
  I: [false, false, false, false, true],
  L: [true, true, false, false, false],
  Y: [true, false, false, false, true],
  ILY: [true, true, false, false, true],
});

const FINGER_NAMES = Object.freeze(["thumb", "index finger", "middle finger", "ring finger", "pinky"]);

function longFingerExtended(landmarks, tip, pip) {
  const wrist = landmarks[0];
  return distance2d(landmarks[tip], wrist) > distance2d(landmarks[pip], wrist) * 1.13;
}

export function getFingerStates(landmarks) {
  if (!landmarks || landmarks.length < 21) return null;
  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const indexBase = landmarks[5];
  const thumbExtended = distance2d(thumbTip, indexBase) > distance2d(thumbIp, indexBase) * 1.12;
  return [
    thumbExtended,
    longFingerExtended(landmarks, 8, 6),
    longFingerExtended(landmarks, 12, 10),
    longFingerExtended(landmarks, 16, 14),
    longFingerExtended(landmarks, 20, 18),
  ];
}

export function classifyStaticSign(states) {
  if (!states || states.length !== 5) return null;
  for (const [sign, pattern] of Object.entries(PATTERNS)) {
    if (pattern.every((extended, index) => states[index] === extended)) return sign;
  }
  return null;
}

export function getSignGuidance(sign, states) {
  const pattern = PATTERNS[sign];
  if (!pattern) return "Choose a supported handshape";
  if (!states) return "Center one hand with the palm facing the camera";
  const mismatch = pattern.findIndex((extended, index) => states[index] !== extended);
  if (mismatch < 0) return "Shape matched — hold steady";
  return pattern[mismatch]
    ? `Extend your ${FINGER_NAMES[mismatch]}`
    : `Tuck your ${FINGER_NAMES[mismatch]}`;
}
