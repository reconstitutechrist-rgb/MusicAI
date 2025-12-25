/**
 * Advanced Audio Processing Utilities
 * Provides multiband compression, limiting, and gain reduction metering
 */

import { CompressorBandSettings, MultibandCompressorSettings } from "../types";

/**
 * Multiband Compressor Node Structure
 */
export interface MultibandCompressorNodes {
  inputGain: GainNode;
  outputGain: GainNode;
  // Crossover filters (3 crossover points create 4 bands)
  crossovers: {
    lowMid: { lowpass: BiquadFilterNode; highpass: BiquadFilterNode };
    midHigh: { lowpass: BiquadFilterNode; highpass: BiquadFilterNode };
    highTop: { lowpass: BiquadFilterNode; highpass: BiquadFilterNode };
  };
  // Per-band processing
  bands: {
    compressor: DynamicsCompressorNode;
    gain: GainNode; // Pre-compressor gain for threshold adjustment
    makeupGain: GainNode; // Post-compressor makeup gain
  }[];
  // Bypass routing
  bypassGain: GainNode;
  wetGain: GainNode;
}

/**
 * Creates a complete multiband compressor processing chain
 */
export function createMultibandCompressor(
  ctx: AudioContext,
  settings: MultibandCompressorSettings,
): MultibandCompressorNodes {
  // Input/Output gain stages
  const inputGain = ctx.createGain();
  inputGain.gain.value = Math.pow(10, settings.inputGain / 20);

  const outputGain = ctx.createGain();
  outputGain.gain.value = Math.pow(10, settings.outputGain / 20);

  // Bypass routing
  const bypassGain = ctx.createGain();
  bypassGain.gain.value = settings.bypass ? 1 : 0;

  const wetGain = ctx.createGain();
  wetGain.gain.value = settings.bypass ? 0 : 1;

  // Crossover frequencies from band settings
  const crossFreq1 = settings.bands[0].highFreq; // ~150 Hz
  const crossFreq2 = settings.bands[1].highFreq; // ~600 Hz
  const crossFreq3 = settings.bands[2].highFreq; // ~3000 Hz

  // Create Linkwitz-Riley style crossover (2nd order for simplicity)
  const createCrossover = (freq: number) => {
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = freq;
    lowpass.Q.value = 0.707; // Butterworth

    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = freq;
    highpass.Q.value = 0.707;

    return { lowpass, highpass };
  };

  const crossovers = {
    lowMid: createCrossover(crossFreq1),
    midHigh: createCrossover(crossFreq2),
    highTop: createCrossover(crossFreq3),
  };

  // Create per-band compressors
  const bands = settings.bands.map((band) => {
    // Pre-gain (for fine-tuning input to compressor)
    const gain = ctx.createGain();
    gain.gain.value = 1;

    // Compressor
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = band.threshold;
    compressor.ratio.value = band.ratio;
    compressor.attack.value = band.attack;
    compressor.release.value = band.release;
    compressor.knee.value = band.knee ?? 6;

    // Makeup gain
    const makeupGain = ctx.createGain();
    makeupGain.gain.value = band.enabled
      ? Math.pow(10, band.makeupGain / 20)
      : 0; // Mute if band disabled

    return { compressor, gain, makeupGain };
  });

  // Wire up the crossover network
  // Input -> Low band (everything below crossFreq1)
  inputGain.connect(crossovers.lowMid.lowpass);
  crossovers.lowMid.lowpass.connect(bands[0].gain);

  // Input -> Split at crossFreq1, then split again at crossFreq2
  inputGain.connect(crossovers.lowMid.highpass);
  crossovers.lowMid.highpass.connect(crossovers.midHigh.lowpass);
  crossovers.midHigh.lowpass.connect(bands[1].gain);

  // Mid-high split
  crossovers.lowMid.highpass.connect(crossovers.midHigh.highpass);
  crossovers.midHigh.highpass.connect(crossovers.highTop.lowpass);
  crossovers.highTop.lowpass.connect(bands[2].gain);

  // High band
  crossovers.midHigh.highpass.connect(crossovers.highTop.highpass);
  crossovers.highTop.highpass.connect(bands[3].gain);

  // Connect each band through its compressor and makeup gain
  bands.forEach((band) => {
    band.gain.connect(band.compressor);
    band.compressor.connect(band.makeupGain);
    band.makeupGain.connect(wetGain);
  });

  // Output mixing
  wetGain.connect(outputGain);

  // Bypass path: Input directly to bypass gain
  inputGain.connect(bypassGain);
  bypassGain.connect(outputGain);

  return {
    inputGain,
    outputGain,
    crossovers,
    bands,
    bypassGain,
    wetGain,
  };
}

/**
 * Updates multiband compressor parameters without recreating nodes
 */
export function updateMultibandCompressor(
  nodes: MultibandCompressorNodes,
  settings: MultibandCompressorSettings,
  currentTime: number,
): void {
  const rampTime = 0.02; // 20ms ramp to avoid clicks

  // Update input/output gains
  nodes.inputGain.gain.setTargetAtTime(
    Math.pow(10, settings.inputGain / 20),
    currentTime,
    rampTime,
  );
  nodes.outputGain.gain.setTargetAtTime(
    Math.pow(10, settings.outputGain / 20),
    currentTime,
    rampTime,
  );

  // Update bypass
  nodes.bypassGain.gain.setTargetAtTime(
    settings.bypass ? 1 : 0,
    currentTime,
    rampTime,
  );
  nodes.wetGain.gain.setTargetAtTime(
    settings.bypass ? 0 : 1,
    currentTime,
    rampTime,
  );

  // Update crossover frequencies
  const crossFreq1 = settings.bands[0].highFreq;
  const crossFreq2 = settings.bands[1].highFreq;
  const crossFreq3 = settings.bands[2].highFreq;

  nodes.crossovers.lowMid.lowpass.frequency.setTargetAtTime(
    crossFreq1,
    currentTime,
    rampTime,
  );
  nodes.crossovers.lowMid.highpass.frequency.setTargetAtTime(
    crossFreq1,
    currentTime,
    rampTime,
  );
  nodes.crossovers.midHigh.lowpass.frequency.setTargetAtTime(
    crossFreq2,
    currentTime,
    rampTime,
  );
  nodes.crossovers.midHigh.highpass.frequency.setTargetAtTime(
    crossFreq2,
    currentTime,
    rampTime,
  );
  nodes.crossovers.highTop.lowpass.frequency.setTargetAtTime(
    crossFreq3,
    currentTime,
    rampTime,
  );
  nodes.crossovers.highTop.highpass.frequency.setTargetAtTime(
    crossFreq3,
    currentTime,
    rampTime,
  );

  // Update per-band settings
  settings.bands.forEach((band, i) => {
    const bandNodes = nodes.bands[i];

    // Update compressor params
    bandNodes.compressor.threshold.setTargetAtTime(
      band.threshold,
      currentTime,
      rampTime,
    );
    bandNodes.compressor.ratio.setTargetAtTime(
      band.ratio,
      currentTime,
      rampTime,
    );
    bandNodes.compressor.attack.setTargetAtTime(
      band.attack,
      currentTime,
      rampTime,
    );
    bandNodes.compressor.release.setTargetAtTime(
      band.release,
      currentTime,
      rampTime,
    );

    // Update makeup gain (or mute if band disabled)
    const makeupValue = band.enabled ? Math.pow(10, band.makeupGain / 20) : 0;
    bandNodes.makeupGain.gain.setTargetAtTime(
      makeupValue,
      currentTime,
      rampTime,
    );
  });
}

/**
 * Gets current gain reduction values from all bands
 * Returns array of dB values (negative = reduction)
 */
export function getGainReductions(nodes: MultibandCompressorNodes): number[] {
  return nodes.bands.map((band) => band.compressor.reduction);
}

/**
 * Master Limiter Node Structure
 */
export interface LimiterNodes {
  inputGain: GainNode;
  compressor: DynamicsCompressorNode;
  outputGain: GainNode;
}

/**
 * Creates a transparent brickwall limiter
 *
 * This limiter prevents audio from exceeding the specified ceiling.
 * Unlike a loudness maximizer, it does NOT boost the output - it only limits peaks.
 */
export function createLimiter(
  ctx: AudioContext,
  ceiling: number = -0.3, // dBFS ceiling (negative value, e.g., -0.3 dB)
  inputBoost: number = 0, // dB input gain (optional pre-gain)
): LimiterNodes {
  const inputGain = ctx.createGain();
  inputGain.gain.value = Math.pow(10, inputBoost / 20);

  // Use DynamicsCompressorNode as limiter (high ratio, fast attack)
  const compressor = ctx.createDynamicsCompressor();
  // Threshold at the ceiling - limiting starts exactly at ceiling
  compressor.threshold.value = ceiling;
  compressor.ratio.value = 20; // High ratio for limiting behavior
  compressor.attack.value = 0.001; // 1ms attack (fast to catch transients)
  compressor.release.value = 0.1; // 100ms release
  compressor.knee.value = 0; // Hard knee for brickwall behavior

  // Output gain is unity - we're limiting, not maximizing
  const outputGain = ctx.createGain();
  outputGain.gain.value = 1;

  inputGain.connect(compressor);
  compressor.connect(outputGain);

  return { inputGain, compressor, outputGain };
}

/**
 * Tempo-synced delay time calculator
 */
export function calculateDelayTime(
  bpm: number,
  noteValue: "1/4" | "1/8" | "1/8d" | "1/16" | "1/4t" | "1/8t",
): number {
  const beatDuration = 60 / bpm; // Duration of one quarter note in seconds

  const multipliers: Record<string, number> = {
    "1/4": 1,
    "1/8": 0.5,
    "1/8d": 0.75, // Dotted eighth
    "1/16": 0.25,
    "1/4t": 2 / 3, // Quarter note triplet
    "1/8t": 1 / 3, // Eighth note triplet
  };

  return beatDuration * multipliers[noteValue];
}

/**
 * dB to linear gain conversion
 */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Linear gain to dB conversion
 */
export function gainToDb(gain: number): number {
  return 20 * Math.log10(Math.max(gain, 0.00001));
}

/**
 * Sidechain Compressor Settings
 */
export interface SidechainSettings {
  threshold: number; // -60 to 0 dB
  ratio: number; // 1 to 20
  attack: number; // 0.001 to 1 seconds
  release: number; // 0.01 to 2 seconds
  makeupGain: number; // 0 to 24 dB
}

/**
 * Sidechain Compressor Node Structure
 */
export interface SidechainCompressorNodes {
  analyser: AnalyserNode; // Monitors sidechain source level
  gainNode: GainNode; // Applies gain reduction to target
  makeupGain: GainNode; // Makeup gain after compression
}

export const DEFAULT_SIDECHAIN_SETTINGS: SidechainSettings = {
  threshold: -24,
  ratio: 4,
  attack: 0.003,
  release: 0.25,
  makeupGain: 0,
};

/**
 * Creates sidechain compressor nodes
 * Note: Web Audio API doesn't have native sidechain input, so we implement
 * it using an analyser to detect the source level and modulate the target's gain.
 */
export function createSidechainCompressor(
  ctx: AudioContext,
  settings: SidechainSettings = DEFAULT_SIDECHAIN_SETTINGS,
): SidechainCompressorNodes {
  // Analyser for detecting sidechain source level
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.3; // Faster response for sidechain

  // Gain node to apply reduction to target
  const gainNode = ctx.createGain();
  gainNode.gain.value = 1;

  // Makeup gain after compression
  const makeupGain = ctx.createGain();
  makeupGain.gain.value = dbToGain(settings.makeupGain);

  return { analyser, gainNode, makeupGain };
}

/**
 * Calculates the gain reduction based on sidechain source level
 * Returns the gain multiplier (0-1) and gain reduction in dB
 */
export function calculateSidechainGainReduction(
  analyser: AnalyserNode,
  settings: SidechainSettings,
): { gainMultiplier: number; reductionDb: number } {
  // Get time domain data for RMS calculation
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Float32Array(bufferLength);
  analyser.getFloatTimeDomainData(dataArray);

  // Calculate RMS level
  let sum = 0;
  for (let i = 0; i < bufferLength; i++) {
    sum += dataArray[i] * dataArray[i];
  }
  const rms = Math.sqrt(sum / bufferLength);

  // Convert to dB
  const levelDb = rms > 0 ? 20 * Math.log10(rms) : -100;

  // Calculate gain reduction using compression formula
  let reductionDb = 0;
  if (levelDb > settings.threshold) {
    const excess = levelDb - settings.threshold;
    reductionDb = -excess * (1 - 1 / settings.ratio);
  }

  // Convert reduction to linear gain
  const gainMultiplier = dbToGain(reductionDb);

  return { gainMultiplier, reductionDb };
}
