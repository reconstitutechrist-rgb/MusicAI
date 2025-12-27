/**
 * Audio Export Utilities
 * Provides functions for rendering and exporting audio mixes in various formats
 */

export interface EQBandConfig {
  frequency: number;
  gain: number;
  q: number;
  type: BiquadFilterType;
  enabled: boolean;
}

export interface TrackConfig {
  buffer: AudioBuffer;
  volume: number;
  // Legacy 3-band EQ
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  // 5-band parametric EQ (optional, takes precedence when provided)
  parametricEQ?: EQBandConfig[];
  reverb: number;
  delay: number;
  // Tempo-synced delay options
  delayTime?: number;
  delayFeedback?: number;
}

// Export format types
export type AudioFormat =
  | "wav-16"
  | "wav-24"
  | "wav-32"
  | "mp3-128"
  | "mp3-192"
  | "mp3-256"
  | "mp3-320";

export interface AudioFormatConfig {
  id: AudioFormat;
  name: string;
  extension: string;
  mimeType: string;
  description: string;
  bitDepth?: number;
  bitrate?: number;
}

export const AUDIO_FORMATS: Record<AudioFormat, AudioFormatConfig> = {
  "wav-16": {
    id: "wav-16",
    name: "WAV 16-bit",
    extension: "wav",
    mimeType: "audio/wav",
    description: "CD quality, smaller files",
    bitDepth: 16,
  },
  "wav-24": {
    id: "wav-24",
    name: "WAV 24-bit",
    extension: "wav",
    mimeType: "audio/wav",
    description: "Studio quality, larger files",
    bitDepth: 24,
  },
  "wav-32": {
    id: "wav-32",
    name: "WAV 32-bit Float",
    extension: "wav",
    mimeType: "audio/wav",
    description: "Maximum quality, largest files",
    bitDepth: 32,
  },
  "mp3-128": {
    id: "mp3-128",
    name: "MP3 128 kbps",
    extension: "mp3",
    mimeType: "audio/mpeg",
    description: "Good for streaming",
    bitrate: 128,
  },
  "mp3-192": {
    id: "mp3-192",
    name: "MP3 192 kbps",
    extension: "mp3",
    mimeType: "audio/mpeg",
    description: "Better quality streaming",
    bitrate: 192,
  },
  "mp3-256": {
    id: "mp3-256",
    name: "MP3 256 kbps",
    extension: "mp3",
    mimeType: "audio/mpeg",
    description: "High quality",
    bitrate: 256,
  },
  "mp3-320": {
    id: "mp3-320",
    name: "MP3 320 kbps",
    extension: "mp3",
    mimeType: "audio/mpeg",
    description: "Maximum MP3 quality",
    bitrate: 320,
  },
};

export interface ExportOptions {
  includeTracks: {
    instrumental: boolean;
    vocal: boolean;
    harmony: boolean;
  };
  applyFX: boolean;
  format: AudioFormat;
}

/**
 * Converts an AudioBuffer to a WAV Blob with configurable bit depth
 * @param buffer - The AudioBuffer to convert
 * @param bitDepth - 16, 24, or 32 (float)
 */
export function bufferToWavBlob(
  buffer: AudioBuffer,
  bitDepth: 16 | 24 | 32 = 16,
): Blob {
  const numOfChan = buffer.numberOfChannels;
  const bytesPerSample = bitDepth / 8;
  const dataLength = buffer.length * numOfChan * bytesPerSample;
  const length = dataLength + 44;
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
  setUint16(bitDepth === 32 ? 3 : 1); // 1 = PCM, 3 = IEEE float
  setUint16(numOfChan); // number of channels
  setUint32(buffer.sampleRate); // sample rate
  setUint32(buffer.sampleRate * bytesPerSample * numOfChan); // byte rate
  setUint16(numOfChan * bytesPerSample); // block align
  setUint16(bitDepth); // bits per sample

  // data sub-chunk
  setUint32(0x61746164); // "data"
  setUint32(dataLength); // sub-chunk size

  // Get channel data
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  // Write interleaved samples based on bit depth
  for (let frameIndex = 0; frameIndex < buffer.length; frameIndex++) {
    for (let i = 0; i < numOfChan; i++) {
      const sample = Math.max(-1, Math.min(1, channels[i][frameIndex]));

      if (bitDepth === 16) {
        // 16-bit signed integer
        const intSample = sample < 0 ? sample * 32768 : sample * 32767;
        view.setInt16(pos, intSample | 0, true);
        pos += 2;
      } else if (bitDepth === 24) {
        // 24-bit signed integer (stored in 3 bytes)
        const intSample = sample < 0 ? sample * 8388608 : sample * 8388607;
        const val = intSample | 0;
        view.setUint8(pos, val & 0xff);
        view.setUint8(pos + 1, (val >> 8) & 0xff);
        view.setUint8(pos + 2, (val >> 16) & 0xff);
        pos += 3;
      } else {
        // 32-bit float
        view.setFloat32(pos, sample, true);
        pos += 4;
      }
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/**
 * Converts an AudioBuffer to MP3 using MediaRecorder API
 * Falls back to WAV if MP3 encoding is not supported
 */
export async function bufferToMp3Blob(
  buffer: AudioBuffer,
  bitrate: number = 192,
): Promise<Blob> {
  // Check if MediaRecorder supports MP3
  const mimeType = "audio/webm;codecs=opus"; // Most browsers support this

  if (!MediaRecorder.isTypeSupported(mimeType)) {
    console.warn("MP3/WebM encoding not supported, falling back to WAV");
    return bufferToWavBlob(buffer, 16);
  }

  return new Promise((resolve, reject) => {
    try {
      // Create an offline audio context to play the buffer
      const audioContext = new AudioContext({ sampleRate: buffer.sampleRate });
      const destination = audioContext.createMediaStreamDestination();

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(destination);

      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType,
        audioBitsPerSecond: bitrate * 1000,
      });

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        audioContext.close();
        const blob = new Blob(chunks, { type: "audio/webm" });
        resolve(blob);
      };

      mediaRecorder.onerror = (e) => {
        audioContext.close();
        reject(e);
      };

      source.onended = () => {
        mediaRecorder.stop();
      };

      mediaRecorder.start();
      source.start(0);
    } catch (error) {
      console.warn("MP3 encoding failed, falling back to WAV:", error);
      resolve(bufferToWavBlob(buffer, 16));
    }
  });
}

/**
 * Converts an AudioBuffer to the specified format
 */
export async function bufferToBlob(
  buffer: AudioBuffer,
  format: AudioFormat,
): Promise<Blob> {
  const config = AUDIO_FORMATS[format];

  if (format.startsWith("wav-")) {
    return bufferToWavBlob(buffer, config.bitDepth as 16 | 24 | 32);
  } else if (format.startsWith("mp3-")) {
    return bufferToMp3Blob(buffer, config.bitrate);
  }

  // Default to 16-bit WAV
  return bufferToWavBlob(buffer, 16);
}

/**
 * Creates an impulse response buffer for reverb convolution
 */
export function createImpulseResponse(
  ctx: BaseAudioContext,
  duration: number,
  decay: number,
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
  audioContext: AudioContext,
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
  onProgress?: (progress: number) => void,
): Promise<AudioBuffer> {
  if (tracks.length === 0) {
    throw new Error("No tracks to render");
  }

  // Find the longest track duration
  const maxDuration = Math.max(...tracks.map((t) => t.buffer.duration));
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

    // EQ chain - either 5-band parametric or 3-band legacy
    const eqFilters: BiquadFilterNode[] = [];

    if (track.parametricEQ && track.parametricEQ.length > 0) {
      // Use 5-band parametric EQ
      for (const band of track.parametricEQ) {
        const filter = offlineCtx.createBiquadFilter();
        filter.type = band.type;
        filter.frequency.value = band.frequency;
        filter.Q.value = band.q;
        filter.gain.value = band.enabled ? band.gain : 0;
        eqFilters.push(filter);
      }
    } else {
      // Use 3-band legacy EQ
      const eqLow = offlineCtx.createBiquadFilter();
      eqLow.type = "lowshelf";
      eqLow.frequency.value = 320;
      eqLow.gain.value = track.eqLow;
      eqFilters.push(eqLow);

      const eqMid = offlineCtx.createBiquadFilter();
      eqMid.type = "peaking";
      eqMid.frequency.value = 1000;
      eqMid.Q.value = 1;
      eqMid.gain.value = track.eqMid;
      eqFilters.push(eqMid);

      const eqHigh = offlineCtx.createBiquadFilter();
      eqHigh.type = "highshelf";
      eqHigh.frequency.value = 3200;
      eqHigh.gain.value = track.eqHigh;
      eqFilters.push(eqHigh);
    }

    // Reverb
    const reverbNode = offlineCtx.createConvolver();
    reverbNode.buffer = reverbImpulse;
    const reverbGain = offlineCtx.createGain();
    reverbGain.gain.value = track.reverb * 0.8;

    // Delay with optional tempo-synced time
    const delayNode = offlineCtx.createDelay(2);
    delayNode.delayTime.value = track.delayTime ?? 0.3;
    const delayFeedback = offlineCtx.createGain();
    delayFeedback.gain.value = track.delayFeedback ?? 0.4;
    const delayGain = offlineCtx.createGain();
    delayGain.gain.value = track.delay * 0.6;

    // Main routing: Source -> EQ chain -> Gain -> Destination
    let prevNode: AudioNode = source;
    for (const filter of eqFilters) {
      prevNode.connect(filter);
      prevNode = filter;
    }
    prevNode.connect(gainNode);
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
      onProgress(((i + 1) / tracks.length) * 50);
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
  sampleRate: number = 44100,
): Promise<AudioBuffer> {
  const frameCount = Math.ceil(track.buffer.duration * sampleRate);
  const offlineCtx = new OfflineAudioContext(2, frameCount, sampleRate);

  const source = offlineCtx.createBufferSource();
  source.buffer = track.buffer;

  if (applyFX) {
    // Create effect chain
    const gainNode = offlineCtx.createGain();
    gainNode.gain.value = track.volume;

    // EQ chain - either 5-band parametric or 3-band legacy
    const eqFilters: BiquadFilterNode[] = [];

    if (track.parametricEQ && track.parametricEQ.length > 0) {
      // Use 5-band parametric EQ
      for (const band of track.parametricEQ) {
        const filter = offlineCtx.createBiquadFilter();
        filter.type = band.type;
        filter.frequency.value = band.frequency;
        filter.Q.value = band.q;
        filter.gain.value = band.enabled ? band.gain : 0;
        eqFilters.push(filter);
      }
    } else {
      // Use 3-band legacy EQ
      const eqLow = offlineCtx.createBiquadFilter();
      eqLow.type = "lowshelf";
      eqLow.frequency.value = 320;
      eqLow.gain.value = track.eqLow;
      eqFilters.push(eqLow);

      const eqMid = offlineCtx.createBiquadFilter();
      eqMid.type = "peaking";
      eqMid.frequency.value = 1000;
      eqMid.Q.value = 1;
      eqMid.gain.value = track.eqMid;
      eqFilters.push(eqMid);

      const eqHigh = offlineCtx.createBiquadFilter();
      eqHigh.type = "highshelf";
      eqHigh.frequency.value = 3200;
      eqHigh.gain.value = track.eqHigh;
      eqFilters.push(eqHigh);
    }

    // Reverb
    const reverbImpulse = createImpulseResponse(offlineCtx, 2.5, 2.0);
    const reverbNode = offlineCtx.createConvolver();
    reverbNode.buffer = reverbImpulse;
    const reverbGain = offlineCtx.createGain();
    reverbGain.gain.value = track.reverb * 0.8;

    // Delay with optional tempo-synced time
    const delayNode = offlineCtx.createDelay(2);
    delayNode.delayTime.value = track.delayTime ?? 0.3;
    const delayFeedback = offlineCtx.createGain();
    delayFeedback.gain.value = track.delayFeedback ?? 0.4;
    const delayGain = offlineCtx.createGain();
    delayGain.gain.value = track.delay * 0.6;

    // Main routing: Source -> EQ chain -> Gain -> Destination
    let prevNode: AudioNode = source;
    for (const filter of eqFilters) {
      prevNode.connect(filter);
      prevNode = filter;
    }
    prevNode.connect(gainNode);
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
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

