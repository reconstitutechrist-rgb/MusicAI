import { CrossfadeCurveType, TimelineClip, CrossfadeRegion, MergeSuggestion, LibrarySong } from "../types/timeline";
import { renderCrossfadeOffline, generateCrossfadeCurve } from "../utils/crossfadeAlgorithms";

/**
 * Auto-merge plan result
 */
interface AutoMergePlan {
  orderedSongIds: string[];
  crossfadeDurations: number[];
  compatibility: {
    score: number;
    keyCompatibility: string;
    bpmDifference: number;
  };
}

/**
 * Generate merge suggestions based on clip analysis
 * Analyzes BPM, key, and structure to provide optimization recommendations
 */
export async function generateMergeSuggestions(
  clips: TimelineClip[],
  crossfades: CrossfadeRegion[]
): Promise<MergeSuggestion[]> {
  const suggestions: MergeSuggestion[] = [];

  if (clips.length < 2) {
    return suggestions;
  }

  // Sort clips by start time
  const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);

  // Analyze BPM compatibility
  const bpmValues = sortedClips
    .map(c => c.analysis?.bpm)
    .filter((bpm): bpm is number => bpm !== undefined && bpm !== null);

  if (bpmValues.length >= 2) {
    const avgBpm = bpmValues.reduce((a, b) => a + b, 0) / bpmValues.length;
    const maxBpmDiff = Math.max(...bpmValues.map(bpm => Math.abs(bpm - avgBpm)));

    if (maxBpmDiff > 15) {
      // Find clips with significantly different BPM
      const outlierClips = sortedClips.filter(c => {
        const bpm = c.analysis?.bpm;
        return bpm && Math.abs(bpm - avgBpm) > 15;
      });

      if (outlierClips.length > 0) {
        suggestions.push({
          id: `bpm-match-${Date.now()}`,
          type: "bpm-match",
          description: `Consider reordering clips to minimize BPM jumps. ${outlierClips[0].songTitle} (${outlierClips[0].analysis?.bpm} BPM) differs significantly from the average (${Math.round(avgBpm)} BPM).`,
          confidence: Math.min(90, 50 + maxBpmDiff),
          clipIds: outlierClips.map(c => c.id),
          suggestedValue: avgBpm,
        });
      }
    }
  }

  // Analyze key compatibility
  const keys = sortedClips
    .map(c => c.analysis?.key)
    .filter((key): key is string => key !== undefined && key !== null);

  if (keys.length >= 2) {
    // Check for compatible keys (same key or relative major/minor)
    const keyGroups = groupByCompatibleKeys(keys);
    if (keyGroups.length > 1) {
      suggestions.push({
        id: `key-match-${Date.now()}`,
        type: "key-match",
        description: "Clips have varying keys. Consider reordering to group compatible keys together for smoother transitions.",
        confidence: 70,
        clipIds: sortedClips.map(c => c.id),
      });
    }
  }

  // Analyze crossfade durations
  for (const crossfade of crossfades) {
    const clipA = sortedClips.find(c => c.id === crossfade.clipAId);
    const clipB = sortedClips.find(c => c.id === crossfade.clipBId);

    if (clipA?.analysis?.bpm && clipB?.analysis?.bpm) {
      const bpmDiff = Math.abs(clipA.analysis.bpm - clipB.analysis.bpm);
      const suggestedDuration = await suggestCrossfadeDuration(clipA, clipB);

      if (Math.abs(crossfade.duration - suggestedDuration) > 1) {
        suggestions.push({
          id: `crossfade-${crossfade.id}-${Date.now()}`,
          type: "crossfade",
          description: `Crossfade between "${clipA.songTitle}" and "${clipB.songTitle}" could be adjusted. Suggested: ${suggestedDuration.toFixed(1)}s based on BPM analysis.`,
          confidence: 60 + Math.min(20, bpmDiff),
          clipIds: [clipA.id, clipB.id],
          suggestedValue: suggestedDuration,
        });
      }
    }
  }

  // Sort by confidence
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Group keys by compatibility (same key family)
 */
function groupByCompatibleKeys(keys: string[]): string[][] {
  const keyFamilies: Record<string, string[]> = {};

  for (const key of keys) {
    // Normalize key (e.g., "C major" -> "C", "A minor" -> "Am")
    const normalized = normalizeKey(key);
    const family = getKeyFamily(normalized);

    if (!keyFamilies[family]) {
      keyFamilies[family] = [];
    }
    keyFamilies[family].push(key);
  }

  return Object.values(keyFamilies);
}

/**
 * Normalize a key string
 */
function normalizeKey(key: string): string {
  return key.replace(/\s*(major|minor|maj|min)/gi, match =>
    match.toLowerCase().includes("min") ? "m" : ""
  ).trim();
}

/**
 * Get the key family (circle of fifths proximity)
 */
function getKeyFamily(key: string): string {
  // Simplified key family mapping
  const families: Record<string, string> = {
    "C": "C", "Am": "C", "G": "C", "Em": "C",
    "D": "D", "Bm": "D", "A": "D", "F#m": "D",
    "E": "E", "C#m": "E", "B": "E", "G#m": "E",
    "F": "F", "Dm": "F", "Bb": "F", "Gm": "F",
  };
  return families[key] || key;
}

/**
 * Helper to parse BPM from string or number
 */
function parseBpm(bpm: string | number | undefined): number | undefined {
  if (bpm === undefined || bpm === null) return undefined;
  if (typeof bpm === "number") return bpm;
  const parsed = parseFloat(bpm);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Generate an automatic merge plan based on song analysis
 * Orders songs and calculates optimal crossfade durations
 */
export async function generateAutoMergePlan(
  songs: LibrarySong[],
  _description: string
): Promise<AutoMergePlan> {
  if (songs.length === 0) {
    return {
      orderedSongIds: [],
      crossfadeDurations: [],
      compatibility: {
        score: 100,
        keyCompatibility: "N/A",
        bpmDifference: 0,
      },
    };
  }

  if (songs.length === 1) {
    return {
      orderedSongIds: [songs[0].id],
      crossfadeDurations: [],
      compatibility: {
        score: 100,
        keyCompatibility: "N/A",
        bpmDifference: 0,
      },
    };
  }

  // Sort songs by BPM for smooth transitions
  const songsWithBpm = songs.filter(s => parseBpm(s.analysis?.bpm) !== undefined);
  const songsWithoutBpm = songs.filter(s => parseBpm(s.analysis?.bpm) === undefined);

  // Sort by BPM (ascending)
  songsWithBpm.sort((a, b) => (parseBpm(a.analysis?.bpm) || 0) - (parseBpm(b.analysis?.bpm) || 0));

  // Combine: songs with BPM first, then those without
  const orderedSongs = [...songsWithBpm, ...songsWithoutBpm];
  const orderedSongIds = orderedSongs.map(s => s.id);

  // Calculate crossfade durations based on BPM differences
  const crossfadeDurations: number[] = [];
  for (let i = 0; i < orderedSongs.length - 1; i++) {
    const currentBpm = parseBpm(orderedSongs[i].analysis?.bpm) || 120;
    const nextBpm = parseBpm(orderedSongs[i + 1].analysis?.bpm) || 120;
    const bpmDiff = Math.abs(currentBpm - nextBpm);

    // Longer crossfades for bigger BPM differences
    let duration = 4; // default
    if (bpmDiff < 5) {
      duration = 3; // Quick transition for similar BPMs
    } else if (bpmDiff < 15) {
      duration = 4; // Standard transition
    } else if (bpmDiff < 30) {
      duration = 5; // Longer transition
    } else {
      duration = 6; // Extended transition for large BPM jumps
    }

    crossfadeDurations.push(duration);
  }

  // Calculate compatibility score
  const bpmValues = orderedSongs
    .map(s => parseBpm(s.analysis?.bpm))
    .filter((bpm): bpm is number => bpm !== undefined);

  const bpmDifference = bpmValues.length >= 2
    ? Math.max(...bpmValues) - Math.min(...bpmValues)
    : 0;

  const keys = orderedSongs
    .map(s => s.analysis?.key)
    .filter((key): key is string => key !== undefined);

  const keyGroups = groupByCompatibleKeys(keys);
  const keyCompatibility = keyGroups.length === 1
    ? "Excellent"
    : keyGroups.length === 2
    ? "Good"
    : "Mixed";

  // Score based on BPM range and key compatibility
  let score = 100;
  score -= Math.min(30, bpmDifference / 2);
  score -= (keyGroups.length - 1) * 10;

  return {
    orderedSongIds,
    crossfadeDurations,
    compatibility: {
      score: Math.max(0, Math.round(score)),
      keyCompatibility,
      bpmDifference: Math.round(bpmDifference),
    },
  };
}

/**
 * Service for audio transition processing in the Timeline Editor
 * Handles crossfade generation, audio merging, and transition effects
 */

/**
 * Generate transition audio for a crossfade region between two clips
 * Uses Web Audio API offline rendering for the crossfade
 */
export async function generateTransitionAudio(
  crossfade: CrossfadeRegion,
  clips: TimelineClip[],
  onProgress?: (progress: number) => void
): Promise<AudioBuffer | null> {
  const clipA = clips.find(c => c.id === crossfade.clipAId);
  const clipB = clips.find(c => c.id === crossfade.clipBId);

  if (!clipA?.audioBuffer || !clipB?.audioBuffer) {
    console.warn("Cannot generate transition: missing audio buffers");
    return null;
  }

  onProgress?.(10);

  try {
    // Extract the overlapping portions of each clip
    const sampleRate = clipA.audioBuffer.sampleRate;

    // Calculate where clip B starts relative to clip A
    const clipAEnd = clipA.startTime + clipA.duration - clipA.trimEnd;
    const crossfadeStart = clipB.startTime;
    const overlapDuration = Math.min(
      crossfade.duration,
      clipAEnd - crossfadeStart
    );

    if (overlapDuration <= 0) {
      console.warn("No overlap between clips for crossfade");
      return null;
    }

    onProgress?.(30);

    // Extract the relevant portion from clip A (end section)
    const clipAOverlapStart = clipA.duration - clipA.trimEnd - overlapDuration;
    const clipABuffer = extractBufferSection(
      clipA.audioBuffer,
      Math.max(0, clipAOverlapStart),
      overlapDuration,
      sampleRate
    );

    onProgress?.(50);

    // Extract the relevant portion from clip B (beginning section)
    const clipBBuffer = extractBufferSection(
      clipB.audioBuffer,
      clipB.trimStart,
      overlapDuration,
      sampleRate
    );

    onProgress?.(70);

    // Render the crossfade
    const transitionBuffer = await renderCrossfadeOffline(
      clipABuffer,
      clipBBuffer,
      overlapDuration,
      crossfade.curveType,
      sampleRate
    );

    onProgress?.(100);

    return transitionBuffer;
  } catch (error) {
    console.error("Error generating transition audio:", error);
    return null;
  }
}

/**
 * Extract a section of an AudioBuffer
 */
function extractBufferSection(
  buffer: AudioBuffer,
  startTime: number,
  duration: number,
  sampleRate: number
): AudioBuffer {
  const startSample = Math.floor(startTime * sampleRate);
  const numSamples = Math.floor(duration * sampleRate);
  const numChannels = buffer.numberOfChannels;

  // Create offline context to create the new buffer
  const offlineCtx = new OfflineAudioContext(
    numChannels,
    numSamples,
    sampleRate
  );
  const newBuffer = offlineCtx.createBuffer(numChannels, numSamples, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const sourceData = buffer.getChannelData(channel);
    const destData = newBuffer.getChannelData(channel);

    for (let i = 0; i < numSamples; i++) {
      const sourceIndex = startSample + i;
      if (sourceIndex < sourceData.length) {
        destData[i] = sourceData[sourceIndex];
      }
    }
  }

  return newBuffer;
}

/**
 * Merge all clips into a single audio buffer with crossfades applied
 */
export async function mergeClipsWithCrossfades(
  clips: TimelineClip[],
  crossfades: CrossfadeRegion[],
  onProgress?: (status: string, progress: number) => void
): Promise<AudioBuffer | null> {
  if (clips.length === 0) {
    return null;
  }

  // Sort clips by start time
  const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);

  // Calculate total duration
  const lastClip = sortedClips[sortedClips.length - 1];
  const totalDuration = lastClip.startTime + lastClip.duration - lastClip.trimEnd;

  if (totalDuration <= 0) {
    return null;
  }

  // Use the sample rate from the first clip
  const sampleRate = sortedClips[0].audioBuffer?.sampleRate || 44100;
  const numSamples = Math.ceil(totalDuration * sampleRate);

  onProgress?.("Creating output buffer...", 5);

  // Create output buffer (stereo)
  const offlineCtx = new OfflineAudioContext(2, numSamples, sampleRate);
  const outputBuffer = offlineCtx.createBuffer(2, numSamples, sampleRate);

  // Process each clip
  for (let i = 0; i < sortedClips.length; i++) {
    const clip = sortedClips[i];

    if (!clip.audioBuffer) {
      continue;
    }

    onProgress?.(`Processing clip ${i + 1}/${sortedClips.length}...`,
      10 + (i / sortedClips.length) * 70);

    const clipStartSample = Math.floor(clip.startTime * sampleRate);
    const trimStartSample = Math.floor(clip.trimStart * sampleRate);

    // Find crossfades involving this clip
    const crossfadeIn = crossfades.find(cf => cf.clipBId === clip.id);
    const crossfadeOut = crossfades.find(cf => cf.clipAId === clip.id);

    // Generate gain envelope for this clip
    const clipDuration = clip.duration - clip.trimStart - clip.trimEnd;
    const clipNumSamples = Math.floor(clipDuration * sampleRate);
    const gainEnvelope = new Float32Array(clipNumSamples);
    gainEnvelope.fill(clip.volume);

    // Apply crossfade in (if exists)
    if (crossfadeIn) {
      const fadeInSamples = Math.floor(crossfadeIn.duration * sampleRate);
      const { curveB } = generateCrossfadeCurve(crossfadeIn.curveType, fadeInSamples);
      for (let j = 0; j < Math.min(fadeInSamples, clipNumSamples); j++) {
        gainEnvelope[j] *= curveB[j] || 0;
      }
    }

    // Apply crossfade out (if exists)
    if (crossfadeOut) {
      const fadeOutSamples = Math.floor(crossfadeOut.duration * sampleRate);
      const { curveA } = generateCrossfadeCurve(crossfadeOut.curveType, fadeOutSamples);
      const startOffset = clipNumSamples - fadeOutSamples;
      for (let j = 0; j < fadeOutSamples && startOffset + j < clipNumSamples; j++) {
        gainEnvelope[startOffset + j] *= curveA[j] || 0;
      }
    }

    // Mix clip into output buffer
    for (let channel = 0; channel < Math.min(2, clip.audioBuffer.numberOfChannels); channel++) {
      const sourceData = clip.audioBuffer.getChannelData(channel);
      const destData = outputBuffer.getChannelData(channel);

      for (let j = 0; j < clipNumSamples; j++) {
        const sourceIndex = trimStartSample + j;
        const destIndex = clipStartSample + j;

        if (sourceIndex < sourceData.length &&
            destIndex >= 0 && destIndex < destData.length) {
          // Apply gain and mix (add to existing audio for overlaps)
          destData[destIndex] += sourceData[sourceIndex] * gainEnvelope[j];
        }
      }
    }
  }

  onProgress?.("Normalizing audio...", 85);

  // Normalize to prevent clipping
  normalizeBuffer(outputBuffer);

  onProgress?.("Complete!", 100);

  return outputBuffer;
}

/**
 * Normalize an AudioBuffer to prevent clipping
 */
function normalizeBuffer(buffer: AudioBuffer, targetPeak: number = 0.95): void {
  let maxSample = 0;

  // Find the maximum absolute sample value
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      maxSample = Math.max(maxSample, Math.abs(data[i]));
    }
  }

  // Apply normalization if needed
  if (maxSample > targetPeak) {
    const gain = targetPeak / maxSample;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        data[i] *= gain;
      }
    }
  }
}

/**
 * Preview a crossfade by rendering just the transition section
 */
export async function previewCrossfade(
  crossfade: CrossfadeRegion,
  clips: TimelineClip[],
  contextTime: number = 2 // seconds of context before and after
): Promise<AudioBuffer | null> {
  const clipA = clips.find(c => c.id === crossfade.clipAId);
  const clipB = clips.find(c => c.id === crossfade.clipBId);

  if (!clipA?.audioBuffer || !clipB?.audioBuffer) {
    return null;
  }

  const sampleRate = clipA.audioBuffer.sampleRate;
  const totalDuration = crossfade.duration + (contextTime * 2);

  // Create preview buffer
  const offlineCtx = new OfflineAudioContext(
    2,
    Math.ceil(totalDuration * sampleRate),
    sampleRate
  );

  // Extract clip A end section (context + crossfade portion)
  const clipAExtractDuration = contextTime + crossfade.duration;
  const clipAStartOffset = Math.max(0,
    clipA.duration - clipA.trimEnd - clipAExtractDuration
  );
  const clipABuffer = extractBufferSection(
    clipA.audioBuffer,
    clipAStartOffset,
    clipAExtractDuration,
    sampleRate
  );

  // Extract clip B start section (crossfade + context portion)
  const clipBExtractDuration = crossfade.duration + contextTime;
  const clipBBuffer = extractBufferSection(
    clipB.audioBuffer,
    clipB.trimStart,
    clipBExtractDuration,
    sampleRate
  );

  // Render with crossfade
  return renderCrossfadeOffline(
    clipABuffer,
    clipBBuffer,
    crossfade.duration,
    crossfade.curveType,
    sampleRate
  );
}

/**
 * Convert an AudioBuffer to a Blob for download
 */
export function audioBufferToBlob(
  buffer: AudioBuffer,
  format: "wav" | "mp3" = "wav"
): Blob {
  if (format === "wav") {
    return audioBufferToWav(buffer);
  }
  // For MP3, we'd need an encoder library
  // Fall back to WAV for now
  return audioBufferToWav(buffer);
}

/**
 * Convert AudioBuffer to WAV Blob
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * numChannels * bytesPerSample;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // Interleave channels and write audio data
  const offset = 44;
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let index = 0;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      const intSample = sample < 0
        ? sample * 0x8000
        : sample * 0x7FFF;
      view.setInt16(offset + index, intSample, true);
      index += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Analyze optimal crossfade duration based on audio content
 */
export async function suggestCrossfadeDuration(
  clipA: TimelineClip,
  clipB: TimelineClip
): Promise<number> {
  // Default suggestion based on BPM matching
  const bpmA = clipA.analysis?.bpm || 120;
  const bpmB = clipB.analysis?.bpm || 120;
  const avgBpm = (bpmA + bpmB) / 2;

  // Shorter crossfades for faster tempos, longer for slower
  // Base: 4 seconds at 120 BPM
  const baseDuration = 4;
  const bpmFactor = 120 / avgBpm;

  // Clamp between 2 and 8 seconds
  return Math.max(2, Math.min(8, baseDuration * bpmFactor));
}

/**
 * Recommend crossfade curve type based on clip characteristics
 */
export function suggestCrossfadeCurve(
  clipA: TimelineClip,
  clipB: TimelineClip
): CrossfadeCurveType {
  const bpmA = clipA.analysis?.bpm || 120;
  const bpmB = clipB.analysis?.bpm || 120;
  const bpmDiff = Math.abs(bpmA - bpmB);

  // For similar tempos, use equal power for smooth transition
  if (bpmDiff < 5) {
    return "equalPower";
  }

  // For moderate differences, use S-curve for natural feel
  if (bpmDiff < 15) {
    return "sCurve";
  }

  // For large differences, use linear for more noticeable transition
  return "linear";
}
