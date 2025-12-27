import { CrossfadeCurveType } from "../types/timeline";

/**
 * Apply a crossfade between two gain nodes
 * Uses Web Audio API automation for smooth transitions
 */
export function applyCrossfade(
  gainA: GainNode,
  gainB: GainNode,
  startTime: number,
  duration: number,
  curveType: CrossfadeCurveType,
  audioContext: AudioContext,
): void {
  const endTime = startTime + duration;

  switch (curveType) {
    case "linear":
      applyLinearCrossfade(gainA, gainB, startTime, endTime);
      break;
    case "equalPower":
      applyEqualPowerCrossfade(gainA, gainB, startTime, endTime);
      break;
    case "sCurve":
      applySCurveCrossfade(gainA, gainB, startTime, duration, audioContext);
      break;
    case "exponential":
      applyExponentialCrossfade(gainA, gainB, startTime, endTime);
      break;
    default:
      applyEqualPowerCrossfade(gainA, gainB, startTime, endTime);
  }
}

/**
 * Linear crossfade - simple straight-line fade
 * May cause slight dip in perceived loudness at the midpoint
 */
function applyLinearCrossfade(
  gainA: GainNode,
  gainB: GainNode,
  startTime: number,
  endTime: number,
): void {
  // Fade out clip A
  gainA.gain.setValueAtTime(1, startTime);
  gainA.gain.linearRampToValueAtTime(0, endTime);

  // Fade in clip B
  gainB.gain.setValueAtTime(0, startTime);
  gainB.gain.linearRampToValueAtTime(1, endTime);
}

/**
 * Equal power crossfade - maintains perceived loudness
 * Industry standard for audio crossfades
 * Uses the property: sin²(x) + cos²(x) = 1
 */
function applyEqualPowerCrossfade(
  gainA: GainNode,
  gainB: GainNode,
  startTime: number,
  endTime: number,
): void {
  // Use exponential ramps which approximate equal power curves
  // We use a small value instead of 0 because exponentialRamp can't go to 0
  const minValue = 0.0001;

  // Fade out clip A
  gainA.gain.setValueAtTime(1, startTime);
  gainA.gain.exponentialRampToValueAtTime(minValue, endTime);

  // Fade in clip B
  gainB.gain.setValueAtTime(minValue, startTime);
  gainB.gain.exponentialRampToValueAtTime(1, endTime);
}

/**
 * S-Curve crossfade - smooth acceleration/deceleration
 * Creates a natural-feeling transition
 */
function applySCurveCrossfade(
  gainA: GainNode,
  gainB: GainNode,
  startTime: number,
  duration: number,
  _audioContext: AudioContext, // Unused but kept for consistent API signature
): void {
  // Generate S-curve using sine function
  const numPoints = 64;
  const curveA = new Float32Array(numPoints);
  const curveB = new Float32Array(numPoints);

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    // S-curve using smoothstep function: 3t² - 2t³
    const s = t * t * (3 - 2 * t);
    curveA[i] = 1 - s;
    curveB[i] = s;
  }

  gainA.gain.setValueAtTime(1, startTime);
  gainA.gain.setValueCurveAtTime(curveA, startTime, duration);

  gainB.gain.setValueAtTime(0, startTime);
  gainB.gain.setValueCurveAtTime(curveB, startTime, duration);
}

/**
 * Exponential crossfade - fast initial change, slow finish
 * Good for dramatic transitions
 */
function applyExponentialCrossfade(
  gainA: GainNode,
  gainB: GainNode,
  startTime: number,
  endTime: number,
): void {
  const minValue = 0.0001;
  const duration = endTime - startTime;
  const midTime = startTime + duration * 0.3; // Faster initial decay

  // Fast decay for clip A
  gainA.gain.setValueAtTime(1, startTime);
  gainA.gain.exponentialRampToValueAtTime(0.1, midTime);
  gainA.gain.exponentialRampToValueAtTime(minValue, endTime);

  // Slower rise for clip B
  gainB.gain.setValueAtTime(minValue, startTime);
  gainB.gain.exponentialRampToValueAtTime(0.5, midTime);
  gainB.gain.exponentialRampToValueAtTime(1, endTime);
}

/**
 * Calculate gain values at a specific point in a crossfade
 * Useful for visualization
 */
export function getCrossfadeGainAtTime(
  t: number, // 0-1 normalized position in crossfade
  curveType: CrossfadeCurveType,
): { gainA: number; gainB: number } {
  switch (curveType) {
    case "linear":
      return { gainA: 1 - t, gainB: t };

    case "equalPower":
      // Equal power: uses cos and sin
      const angle = t * Math.PI * 0.5;
      return {
        gainA: Math.cos(angle),
        gainB: Math.sin(angle),
      };

    case "sCurve":
      // Smoothstep: 3t² - 2t³
      const s = t * t * (3 - 2 * t);
      return { gainA: 1 - s, gainB: s };

    case "exponential":
      // Approximation of exponential behavior
      return {
        gainA: Math.pow(1 - t, 2),
        gainB: Math.pow(t, 0.5),
      };

    default:
      return { gainA: 1 - t, gainB: t };
  }
}

/**
 * Generate a preview curve for visualization
 * Returns arrays of gain values for both clips
 */
export function generateCrossfadeCurve(
  curveType: CrossfadeCurveType,
  numPoints: number = 100,
): { curveA: number[]; curveB: number[] } {
  const curveA: number[] = [];
  const curveB: number[] = [];

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const { gainA, gainB } = getCrossfadeGainAtTime(t, curveType);
    curveA.push(gainA);
    curveB.push(gainB);
  }

  return { curveA, curveB };
}

/**
 * Render crossfade to an offline audio context
 * Used for final export
 */
export async function renderCrossfadeOffline(
  bufferA: AudioBuffer,
  bufferB: AudioBuffer,
  overlapDuration: number,
  curveType: CrossfadeCurveType,
  sampleRate: number = 44100,
): Promise<AudioBuffer> {
  const durationA = bufferA.duration;
  const durationB = bufferB.duration;
  const totalDuration = durationA + durationB - overlapDuration;

  const offlineContext = new OfflineAudioContext(
    2, // stereo
    Math.ceil(totalDuration * sampleRate),
    sampleRate,
  );

  // Create source nodes
  const sourceA = offlineContext.createBufferSource();
  const sourceB = offlineContext.createBufferSource();
  sourceA.buffer = bufferA;
  sourceB.buffer = bufferB;

  // Create gain nodes
  const gainA = offlineContext.createGain();
  const gainB = offlineContext.createGain();

  // Connect
  sourceA.connect(gainA);
  sourceB.connect(gainB);
  gainA.connect(offlineContext.destination);
  gainB.connect(offlineContext.destination);

  // Set up initial gain values (must be done before crossfade automation)
  // Before crossfade, A is full volume, B is silent
  gainA.gain.setValueAtTime(1, 0);
  gainB.gain.setValueAtTime(0, 0);

  // Apply crossfade at the overlap point
  const crossfadeStart = durationA - overlapDuration;
  applyCrossfade(
    gainA,
    gainB,
    crossfadeStart,
    overlapDuration,
    curveType,
    offlineContext as unknown as AudioContext,
  );

  // Start playback
  sourceA.start(0);
  sourceB.start(crossfadeStart);

  // Render
  return await offlineContext.startRendering();
}
