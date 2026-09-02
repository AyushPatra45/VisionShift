export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function smoothstep(edge0, edge1, value) {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

// Finds a small per-channel linear correction that makes the captured plate
// match the current live background. Person pixels are excluded by the mask.
export function estimateColorTransform(live, plate, mask, sampleStride = 32) {
  const sumLive = [0, 0, 0];
  const sumPlate = [0, 0, 0];
  const sumPlateSquared = [0, 0, 0];
  const sumCross = [0, 0, 0];
  let count = 0;

  for (let pixel = 0; pixel < mask.length / 4; pixel += sampleStride) {
    const index = pixel * 4;
    if (mask[index + 3] > 16) continue;
    for (let channel = 0; channel < 3; channel += 1) {
      const liveValue = live[index + channel];
      const plateValue = plate[index + channel];
      sumLive[channel] += liveValue;
      sumPlate[channel] += plateValue;
      sumPlateSquared[channel] += plateValue * plateValue;
      sumCross[channel] += plateValue * liveValue;
    }
    count += 1;
  }

  if (count < 64) return { gain: [1, 1, 1], offset: [0, 0, 0] };

  const gain = [1, 1, 1];
  const offset = [0, 0, 0];
  for (let channel = 0; channel < 3; channel += 1) {
    const meanLive = sumLive[channel] / count;
    const meanPlate = sumPlate[channel] / count;
    const variance = sumPlateSquared[channel] - (sumPlate[channel] ** 2) / count;
    const covariance = sumCross[channel] - (sumPlate[channel] * sumLive[channel]) / count;
    gain[channel] = variance > count * 4 ? clamp(covariance / variance, 0.72, 1.35) : 1;
    offset[channel] = clamp(meanLive - gain[channel] * meanPlate, -38, 38);
  }

  return { gain, offset };
}
