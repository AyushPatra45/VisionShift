const DEFAULT_MATCH_THRESHOLD = 0.3;

function finiteLandmark(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z ?? 0);
}

export function normalizeHandPose(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 21 || !landmarks.every(finiteLandmark)) return null;
  const wrist = landmarks[0];
  const indexBase = landmarks[5];
  const middleBase = landmarks[9];
  const pinkyBase = landmarks[17];
  const palmWidth = Math.hypot(indexBase.x - pinkyBase.x, indexBase.y - pinkyBase.y);
  const palmDirectionX = middleBase.x - wrist.x;
  const palmDirectionY = middleBase.y - wrist.y;
  const palmLength = Math.hypot(palmDirectionX, palmDirectionY);
  if (palmWidth <= Number.EPSILON || palmLength <= Number.EPSILON) return null;

  const axisY = { x: palmDirectionX / palmLength, y: palmDirectionY / palmLength };
  const axisX = { x: axisY.y, y: -axisY.x };

  return landmarks.flatMap((point) => {
    const dx = point.x - wrist.x;
    const dy = point.y - wrist.y;
    return [
      (dx * axisX.x + dy * axisX.y) / palmWidth,
      (dx * axisY.x + dy * axisY.y) / palmWidth,
      ((point.z ?? 0) - (wrist.z ?? 0)) / palmWidth,
    ];
  });
}

export function mirrorHandPose(pose) {
  if (!Array.isArray(pose) || pose.length % 3 !== 0) return null;
  return pose.map((value, index) => index % 3 === 0 ? -value : value);
}

export function poseDistance(first, second) {
  if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length || !first.length) return Infinity;
  const squared = first.reduce((sum, value, index) => sum + (value - second[index]) ** 2, 0);
  return Math.sqrt(squared / first.length);
}

export function averageHandPoses(samples) {
  if (!Array.isArray(samples) || !samples.length) return null;
  const length = samples[0]?.length;
  if (!length || samples.some((sample) => !Array.isArray(sample) || sample.length !== length)) return null;
  return Array.from({ length }, (_, index) => (
    samples.reduce((sum, sample) => sum + sample[index], 0) / samples.length
  ));
}

export function classifyLearnedPose(pose, library, threshold = DEFAULT_MATCH_THRESHOLD) {
  if (!Array.isArray(pose) || !Array.isArray(library) || !library.length) return null;
  const mirrored = mirrorHandPose(pose);
  let best = null;
  for (const item of library) {
    if (!item?.label || !Array.isArray(item.pose)) continue;
    const distance = Math.min(poseDistance(pose, item.pose), poseDistance(mirrored, item.pose));
    if (!best || distance < best.distance) best = { label: item.label, distance };
  }
  if (!best || best.distance > threshold) return null;
  return {
    ...best,
    confidence: Math.max(0, Math.min(1, 1 - best.distance / threshold)),
  };
}

export function sanitizeReaderLibrary(value, maximumEntries = 12) {
  if (!Array.isArray(value)) return [];
  const labels = new Set();
  const clean = [];
  for (const item of value) {
    const label = typeof item?.label === "string" ? item.label.trim().replace(/\s+/g, " ").slice(0, 40) : "";
    const pose = Array.isArray(item?.pose) && item.pose.length === 63 && item.pose.every(Number.isFinite) ? item.pose : null;
    const key = label.toLocaleLowerCase();
    if (!label || !pose || labels.has(key)) continue;
    labels.add(key);
    clean.push({ label, pose });
    if (clean.length >= maximumEntries) break;
  }
  return clean;
}
