/**
 * Audio Export Utilities
 * Provides functions for rendering and exporting audio mixes as WAV files
 */

export interface TrackConfig {
  buffer: AudioBuffer;
  volume: number;
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  reverb: number;
  delay: number;
}

export interface ExportOptions {
  includeTracks: {
    instrumental: boolean;
    vocal: boolean;
    harmony: boolean;
  };
  applyFX: boolean;
}

/**
 * Converts an AudioBuffer to a WAV Blob
 */
export function bufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  const channels: Float32Array[] = [];
  let pos = 0;

  // Helper functions for writing data
  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };

  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  // WAV header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  // fmt sub-chunk
  setUint32(0x20746d66); // "fmt "
  setUint32(16); // sub-chunk size
  setUint16(1); // PCM format
  setUint16(numOfChan); // number of channels
  setUint32(buffer.sampleRate); // sample rate
  setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2); // block align
  setUint16(16); // bits per sample

  // data sub-chunk
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4); // sub-chunk size

  // Get channel data
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  // Write interleaved samples
  let frameIndex = 0;
  while (pos < length && frameIndex < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][frameIndex]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    frameIndex++;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Creates an impulse response buffer for reverb convolution
 */
export function createImpulseResponse(
  ctx: BaseAudioContext,
  duration: number,
  decay: number
): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = rate * duration;
  const impulse = ctx.createBuffer(2, length, rate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const n = length - i;
    const fade = Math.pow(n / length, decay);
    left[i] = (Math.random() * 2 - 1) * fade;
    right[i] = (Math.random() * 2 - 1) * fade;
  }

  return impulse;
}

/**
 * Fetches audio from a URL and decodes it to an AudioBuffer
 */
export async function fetchAudioBuffer(
  url: string,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return audioContext.decodeAudioData(arrayBuffer);
}

/**
 * Renders a mix of multiple tracks with effects using OfflineAudioContext
 */
export async function renderMixOffline(
  tracks: TrackConfig[],
  sampleRate: number = 44100,
  onProgress?: (progress: number) => void
): Promise<AudioBuffer> {
  if (tracks.length === 0) {
    throw new Error('No tracks to render');
  }

  // Find the longest track duration
  const maxDuration = Math.max(...tracks.map(t => t.buffer.duration));
  const frameCount = Math.ceil(maxDuration * sampleRate);

  // Create offline context
  const offlineCtx = new OfflineAudioContext(2, frameCount, sampleRate);

  // Create impulse response for reverb
  const reverbImpulse = createImpulseResponse(offlineCtx, 2.5, 2.0);

  // Process each track
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const source = offlineCtx.createBufferSource();
    source.buffer = track.buffer;

    // Create effect chain
    const gainNode = offlineCtx.createGain();
    gainNode.gain.value = track.volume;

    // EQ nodes
    const eqLow = offlineCtx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 320;
    eqLow.gain.value = track.eqLow;

    const eqMid = offlineCtx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 1;
    eqMid.gain.value = track.eqMid;

    const eqHigh = offlineCtx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 3200;
    eqHigh.gain.value = track.eqHigh;

    // Reverb
    const reverbNode = offlineCtx.createConvolver();
    reverbNode.buffer = reverbImpulse;
    const reverbGain = offlineCtx.createGain();
    reverbGain.gain.value = track.reverb * 0.8;

    // Delay
    const delayNode = offlineCtx.createDelay();
    delayNode.delayTime.value = 0.3;
    const delayFeedback = offlineCtx.createGain();
    delayFeedback.gain.value = 0.4;
    const delayGain = offlineCtx.createGain();
    delayGain.gain.value = track.delay * 0.6;

    // Main routing: Source -> EQ -> Gain -> Destination
    source.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(gainNode);
    gainNode.connect(offlineCtx.destination);

    // Reverb send
    source.connect(reverbNode);
    reverbNode.connect(reverbGain);
    reverbGain.connect(offlineCtx.destination);

    // Delay send with feedback
    source.connect(delayNode);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayGain);
    delayGain.connect(offlineCtx.destination);

    // Start the source
    source.start(0);

    // Report progress
    if (onProgress) {
      onProgress((i + 1) / tracks.length * 50);
    }
  }

  // Render
  if (onProgress) {
    onProgress(60);
  }

  const renderedBuffer = await offlineCtx.startRendering();

  if (onProgress) {
    onProgress(100);
  }

  return renderedBuffer;
}

/**
 * Renders a single stem (track) with optional effects
 */
export async function renderStemOffline(
  track: TrackConfig,
  applyFX: boolean,
  sampleRate: number = 44100
): Promise<AudioBuffer> {
  const frameCount = Math.ceil(track.buffer.duration * sampleRate);
  const offlineCtx = new OfflineAudioContext(2, frameCount, sampleRate);

  const source = offlineCtx.createBufferSource();
  source.buffer = track.buffer;

  if (applyFX) {
    // Create effect chain
    const gainNode = offlineCtx.createGain();
    gainNode.gain.value = track.volume;

    const eqLow = offlineCtx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 320;
    eqLow.gain.value = track.eqLow;

    const eqMid = offlineCtx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 1;
    eqMid.gain.value = track.eqMid;

    const eqHigh = offlineCtx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 3200;
    eqHigh.gain.value = track.eqHigh;

    // Reverb
    const reverbImpulse = createImpulseResponse(offlineCtx, 2.5, 2.0);
    const reverbNode = offlineCtx.createConvolver();
    reverbNode.buffer = reverbImpulse;
    const reverbGain = offlineCtx.createGain();
    reverbGain.gain.value = track.reverb * 0.8;

    // Delay
    const delayNode = offlineCtx.createDelay();
    delayNode.delayTime.value = 0.3;
    const delayFeedback = offlineCtx.createGain();
    delayFeedback.gain.value = 0.4;
    const delayGain = offlineCtx.createGain();
    delayGain.gain.value = track.delay * 0.6;

    // Main routing
    source.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(gainNode);
    gainNode.connect(offlineCtx.destination);

    // Reverb send
    source.connect(reverbNode);
    reverbNode.connect(reverbGain);
    reverbGain.connect(offlineCtx.destination);

    // Delay send
    source.connect(delayNode);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayGain);
    delayGain.connect(offlineCtx.destination);
  } else {
    // Dry signal only
    source.connect(offlineCtx.destination);
  }

  source.start(0);
  return offlineCtx.startRendering();
}

/**
 * Triggers a download of a Blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Main export function - renders mix and triggers download
 */
export async function exportMixAsWav(
  tracks: TrackConfig[],
  filename: string = 'mix.wav',
  sampleRate: number = 44100,
  onProgress?: (progress: number) => void
): Promise<void> {
  const renderedBuffer = await renderMixOffline(tracks, sampleRate, onProgress);
  const wavBlob = bufferToWavBlob(renderedBuffer);
  downloadBlob(wavBlob, filename);
}

/**
 * Export individual stems
 */
export async function exportStemsAsWav(
  stems: { name: string; track: TrackConfig }[],
  applyFX: boolean,
  sampleRate: number = 44100,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  for (let i = 0; i < stems.length; i++) {
    const { name, track } = stems[i];
    const renderedBuffer = await renderStemOffline(track, applyFX, sampleRate);
    const wavBlob = bufferToWavBlob(renderedBuffer);
    downloadBlob(wavBlob, `${name}.wav`);

    if (onProgress) {
      onProgress(i + 1, stems.length);
    }
  }
}
