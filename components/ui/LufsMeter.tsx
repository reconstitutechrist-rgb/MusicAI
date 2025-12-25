import React, { useEffect, useRef, useCallback, useState } from "react";

export type LufsPreset =
  | "spotify"
  | "youtube"
  | "apple"
  | "broadcast"
  | "custom";

interface LufsPresetConfig {
  name: string;
  target: number;
  truePeakLimit: number;
  toleranceRange: number;
  color: string;
}

export const LUFS_PRESETS: Record<LufsPreset, LufsPresetConfig> = {
  spotify: {
    name: "Spotify",
    target: -14,
    truePeakLimit: -1,
    toleranceRange: 2,
    color: "#1DB954",
  },
  youtube: {
    name: "YouTube",
    target: -13,
    truePeakLimit: -1,
    toleranceRange: 2,
    color: "#FF0000",
  },
  apple: {
    name: "Apple Music",
    target: -16,
    truePeakLimit: -1,
    toleranceRange: 2,
    color: "#FC3C44",
  },
  broadcast: {
    name: "Broadcast",
    target: -24,
    truePeakLimit: -2,
    toleranceRange: 1,
    color: "#3B82F6",
  },
  custom: {
    name: "Custom",
    target: -14,
    truePeakLimit: -1,
    toleranceRange: 2,
    color: "#8B5CF6",
  },
};

/**
 * ITU-R BS.1770-4 K-weighting filter coefficients
 * These create the frequency-dependent weighting curve used for loudness measurement
 */
interface KWeightingFilters {
  // Stage 1: High-shelf boost at ~1681.97 Hz (+4dB) - models acoustic effects of head
  highShelf: BiquadFilterNode;
  // Stage 2: High-pass filter at ~38.13 Hz - removes very low frequencies
  highPass: BiquadFilterNode;
}

interface LufsMeterProps {
  analyser: AnalyserNode | null;
  audioContext: AudioContext | null;
  /** Optional: provide audio source for proper K-weighting. If not provided, uses raw analyser data */
  audioSource?: AudioNode | null;
  width?: number;
  height?: number;
  targetPreset?: LufsPreset;
  onPresetChange?: (preset: LufsPreset) => void;
}

interface LufsReadings {
  momentary: number; // 400ms window
  shortTerm: number; // 3s window
  integrated: number; // Full program
  truePeak: number; // dBTP
  range?: number; // LRA (Loudness Range)
}

/**
 * Creates K-weighting filter chain per ITU-R BS.1770-4
 * Stage 1: Pre-filter (high shelf) - acoustic effect of head
 * Stage 2: Revised Low Frequency B-curve (high-pass)
 */
function createKWeightingFilters(ctx: AudioContext): KWeightingFilters {
  // Stage 1: High-shelf filter at 1681.97 Hz with +4 dB gain
  // This models the acoustic effects of the human head
  const highShelf = ctx.createBiquadFilter();
  highShelf.type = "highshelf";
  highShelf.frequency.value = 1681.97;
  highShelf.gain.value = 4.0;

  // Stage 2: High-pass filter at 38.13 Hz
  // This is the "Revised Low Frequency B-curve" (RLB)
  const highPass = ctx.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = 38.13;
  highPass.Q.value = 0.5; // Low Q for gentle rolloff

  // Connect in series
  highShelf.connect(highPass);

  return { highShelf, highPass };
}

const LufsMeter: React.FC<LufsMeterProps> = ({
  analyser,
  audioContext,
  audioSource,
  width = 300,
  height = 180,
  targetPreset = "spotify",
  onPresetChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // K-weighting filter chain
  const kWeightingRef = useRef<KWeightingFilters | null>(null);
  const kWeightedAnalyserRef = useRef<AnalyserNode | null>(null);

  // Rolling buffers for LUFS calculation
  const momentaryBufferRef = useRef<number[]>([]);
  const shortTermBufferRef = useRef<number[]>([]);
  // For integrated loudness with gating
  const gatedBlocksRef = useRef<number[]>([]);
  const truePeakRef = useRef<number>(-Infinity);
  // For LRA (Loudness Range) calculation
  const lraBlocksRef = useRef<number[]>([]);

  const [readings, setReadings] = useState<LufsReadings>({
    momentary: -Infinity,
    shortTerm: -Infinity,
    integrated: -Infinity,
    truePeak: -Infinity,
    range: undefined,
  });

  // Setup K-weighting filter chain when audio context and source are available
  useEffect(() => {
    if (!audioContext || !audioSource) {
      kWeightingRef.current = null;
      kWeightedAnalyserRef.current = null;
      return;
    }

    // Create K-weighting filters
    const kWeighting = createKWeightingFilters(audioContext);
    kWeightingRef.current = kWeighting;

    // Create analyser for K-weighted signal
    const kAnalyser = audioContext.createAnalyser();
    kAnalyser.fftSize = 2048;
    kAnalyser.smoothingTimeConstant = 0;
    kWeightedAnalyserRef.current = kAnalyser;

    // Connect: source -> highShelf -> highPass -> kAnalyser
    audioSource.connect(kWeighting.highShelf);
    kWeighting.highPass.connect(kAnalyser);

    return () => {
      try {
        audioSource.disconnect(kWeighting.highShelf);
      } catch {
        // May already be disconnected
      }
    };
  }, [audioContext, audioSource]);

  // Calculate mean square for a block of samples
  const calculateMeanSquare = useCallback((samples: Float32Array): number => {
    if (samples.length === 0) return 0;

    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return sum / samples.length;
  }, []);

  // Convert mean square to LUFS
  const meanSquareToLufs = useCallback((meanSquare: number): number => {
    if (meanSquare <= 0) return -Infinity;
    // LUFS = -0.691 + 10 * log10(mean square)
    // The -0.691 factor accounts for the K-weighting reference
    return -0.691 + 10 * Math.log10(meanSquare);
  }, []);

  // Calculate integrated loudness with proper gating per ITU-R BS.1770-4
  const calculateIntegratedWithGating = useCallback(
    (blocks: number[]): number => {
      if (blocks.length === 0) return -Infinity;

      // Step 1: Absolute gate at -70 LUFS
      const absoluteThreshold = -70;
      const afterAbsoluteGate = blocks.filter(
        (lufs) => lufs > absoluteThreshold,
      );

      if (afterAbsoluteGate.length === 0) return -Infinity;

      // Step 2: Calculate ungated average (for relative threshold)
      const ungatedSum = afterAbsoluteGate.reduce(
        (sum, lufs) => sum + Math.pow(10, lufs / 10),
        0,
      );
      const ungatedAvg = 10 * Math.log10(ungatedSum / afterAbsoluteGate.length);

      // Step 3: Relative gate at -10 LU below ungated average
      const relativeThreshold = ungatedAvg - 10;

      // Step 4: Calculate final gated average
      const afterRelativeGate = afterAbsoluteGate.filter(
        (lufs) => lufs > relativeThreshold,
      );

      if (afterRelativeGate.length === 0) return -Infinity;

      const gatedSum = afterRelativeGate.reduce(
        (sum, lufs) => sum + Math.pow(10, lufs / 10),
        0,
      );
      return 10 * Math.log10(gatedSum / afterRelativeGate.length);
    },
    [],
  );

  // Calculate Loudness Range (LRA) per ITU-R BS.1770-4
  const calculateLRA = useCallback((blocks: number[]): number | undefined => {
    if (blocks.length < 10) return undefined; // Need enough data

    // Step 1: Absolute gate at -70 LUFS
    const absoluteThreshold = -70;
    const afterAbsoluteGate = blocks.filter((lufs) => lufs > absoluteThreshold);

    if (afterAbsoluteGate.length < 10) return undefined;

    // Step 2: Calculate average and apply -20 LU relative gate
    const avgSum = afterAbsoluteGate.reduce(
      (sum, lufs) => sum + Math.pow(10, lufs / 10),
      0,
    );
    const avg = 10 * Math.log10(avgSum / afterAbsoluteGate.length);
    const relativeThreshold = avg - 20; // -20 LU for LRA

    const afterRelativeGate = afterAbsoluteGate.filter(
      (lufs) => lufs > relativeThreshold,
    );

    if (afterRelativeGate.length < 10) return undefined;

    // Step 3: Sort and find 10th and 95th percentiles
    const sorted = [...afterRelativeGate].sort((a, b) => a - b);
    const lowIdx = Math.floor(sorted.length * 0.1);
    const highIdx = Math.floor(sorted.length * 0.95);

    // LRA is the difference between 95th and 10th percentile
    return sorted[highIdx] - sorted[lowIdx];
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      animationFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    }

    // Clear canvas
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, width, height);

    const preset = LUFS_PRESETS[targetPreset];
    const meterHeight = height - 40;
    const meterY = 10;

    // LUFS scale: -60 to 0 LUFS
    const minLufs = -60;
    const maxLufs = 0;
    const lufsRange = maxLufs - minLufs;

    // Draw meter background with scale
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(10, meterY, width - 100, meterHeight);

    // Draw scale markers
    ctx.font = "9px monospace";
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "right";

    const scaleMarks = [0, -6, -12, -18, -24, -30, -40, -50, -60];
    for (const mark of scaleMarks) {
      const y = meterY + ((maxLufs - mark) / lufsRange) * meterHeight;
      ctx.fillText(`${mark}`, width - 75, y + 3);

      ctx.strokeStyle = "#374151";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(width - 90, y);
      ctx.stroke();
    }

    // Draw target zone
    const targetY =
      meterY + ((maxLufs - preset.target) / lufsRange) * meterHeight;
    const toleranceY = (preset.toleranceRange / lufsRange) * meterHeight; // Use preset tolerance

    ctx.fillStyle = preset.color + "33"; // 20% opacity
    ctx.fillRect(10, targetY - toleranceY, width - 100, toleranceY * 2);

    ctx.strokeStyle = preset.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(10, targetY);
    ctx.lineTo(width - 90, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (analyser && audioContext) {
      // Use K-weighted analyser if available, otherwise fall back to raw analyser
      const activeAnalyser = kWeightedAnalyserRef.current || analyser;

      // Get audio data from K-weighted signal
      const bufferLength = activeAnalyser.fftSize;
      const dataArray = new Float32Array(bufferLength);
      activeAnalyser.getFloatTimeDomainData(dataArray);

      // Calculate current K-weighted loudness
      const meanSquare = calculateMeanSquare(dataArray);
      const currentLoudness = meanSquareToLufs(meanSquare);

      // Update true peak (using raw analyser for accurate peak detection)
      const rawDataArray = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(rawDataArray);
      let currentPeak = -Infinity;
      for (let i = 0; i < rawDataArray.length; i++) {
        const sample = Math.abs(rawDataArray[i]);
        if (sample > 0) {
          const peakDb = 20 * Math.log10(sample);
          currentPeak = Math.max(currentPeak, peakDb);
        }
      }
      if (currentPeak > truePeakRef.current) {
        truePeakRef.current = currentPeak;
      }

      // Update momentary buffer (400ms at 60fps ≈ 24 frames)
      momentaryBufferRef.current.push(currentLoudness);
      if (momentaryBufferRef.current.length > 24) {
        momentaryBufferRef.current.shift();
      }

      // Update short-term buffer (3s ≈ 180 frames)
      shortTermBufferRef.current.push(currentLoudness);
      if (shortTermBufferRef.current.length > 180) {
        shortTermBufferRef.current.shift();
      }

      // Store blocks for integrated loudness with proper gating
      gatedBlocksRef.current.push(currentLoudness);
      // Keep last 10 minutes worth of blocks for LRA calculation
      if (gatedBlocksRef.current.length > 36000) {
        // 10 min at 60fps
        gatedBlocksRef.current.shift();
      }

      // Store blocks for LRA (every 3 seconds for short-term blocks)
      if (shortTermBufferRef.current.length === 180) {
        const shortTermAvg =
          shortTermBufferRef.current.reduce(
            (a, b) => a + Math.pow(10, b / 10),
            0,
          ) / shortTermBufferRef.current.length;
        const shortTermBlock =
          shortTermAvg > 0 ? 10 * Math.log10(shortTermAvg) : -Infinity;
        lraBlocksRef.current.push(shortTermBlock);
        if (lraBlocksRef.current.length > 200) {
          // Keep ~10 minutes
          lraBlocksRef.current.shift();
        }
      }

      // Calculate momentary (400ms window)
      const momentaryAvg =
        momentaryBufferRef.current.length > 0
          ? momentaryBufferRef.current.reduce(
              (a, b) => a + Math.pow(10, b / 10),
              0,
            ) / momentaryBufferRef.current.length
          : 0;
      const momentaryLufs =
        momentaryAvg > 0 ? 10 * Math.log10(momentaryAvg) : -Infinity;

      // Calculate short-term (3s window)
      const shortTermAvg =
        shortTermBufferRef.current.length > 0
          ? shortTermBufferRef.current.reduce(
              (a, b) => a + Math.pow(10, b / 10),
              0,
            ) / shortTermBufferRef.current.length
          : 0;
      const shortTermLufs =
        shortTermAvg > 0 ? 10 * Math.log10(shortTermAvg) : -Infinity;

      // Calculate integrated loudness with proper two-stage gating
      const integratedLufs = calculateIntegratedWithGating(
        gatedBlocksRef.current,
      );

      // Calculate Loudness Range (LRA)
      const lra = calculateLRA(lraBlocksRef.current);

      setReadings({
        momentary: momentaryLufs,
        shortTerm: shortTermLufs,
        integrated: integratedLufs,
        truePeak: truePeakRef.current,
        range: lra,
      });

      // Draw momentary meter bar
      const momentaryNorm = Math.max(
        0,
        Math.min(1, (momentaryLufs - minLufs) / lufsRange),
      );
      const momentaryH = momentaryNorm * meterHeight;

      // Gradient based on level
      const gradient = ctx.createLinearGradient(
        0,
        meterY + meterHeight,
        0,
        meterY,
      );
      gradient.addColorStop(0, "#22c55e");
      gradient.addColorStop(0.4, "#22c55e");
      gradient.addColorStop(0.6, "#eab308");
      gradient.addColorStop(0.8, "#f97316");
      gradient.addColorStop(1, "#ef4444");

      ctx.fillStyle = gradient;
      ctx.fillRect(15, meterY + meterHeight - momentaryH, 40, momentaryH);

      // Draw short-term indicator
      const shortTermNorm = Math.max(
        0,
        Math.min(1, (shortTermLufs - minLufs) / lufsRange),
      );
      const shortTermY = meterY + meterHeight - shortTermNorm * meterHeight;

      ctx.fillStyle = "#818cf8";
      ctx.fillRect(60, shortTermY - 2, 30, 4);

      // Draw integrated indicator
      const integratedNorm = Math.max(
        0,
        Math.min(1, (integratedLufs - minLufs) / lufsRange),
      );
      const integratedY = meterY + meterHeight - integratedNorm * meterHeight;

      ctx.fillStyle = "#f472b6";
      ctx.fillRect(95, integratedY - 2, 30, 4);
    }

    // Draw labels
    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("M", 35, height - 5);
    ctx.fillText("S", 75, height - 5);
    ctx.fillText("I", 110, height - 5);

    // Draw readings panel
    const panelX = width - 85;
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(panelX, meterY, 75, meterHeight);

    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#22c55e";
    ctx.fillText("Momentary", panelX + 5, meterY + 15);
    ctx.font = "bold 16px monospace";
    ctx.fillText(
      readings.momentary > -100 ? readings.momentary.toFixed(1) : "-∞",
      panelX + 5,
      meterY + 32,
    );

    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle = "#818cf8";
    ctx.fillText("Short Term", panelX + 5, meterY + 50);
    ctx.font = "bold 14px monospace";
    ctx.fillText(
      readings.shortTerm > -100 ? readings.shortTerm.toFixed(1) : "-∞",
      panelX + 5,
      meterY + 65,
    );

    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle = "#f472b6";
    ctx.fillText("Integrated", panelX + 5, meterY + 83);
    ctx.font = "bold 14px monospace";
    ctx.fillText(
      readings.integrated > -100 ? readings.integrated.toFixed(1) : "-∞",
      panelX + 5,
      meterY + 98,
    );

    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle =
      readings.truePeak > preset.truePeakLimit ? "#ef4444" : "#6b7280";
    ctx.fillText("True Peak", panelX + 5, meterY + 105);
    ctx.font = "bold 12px monospace";
    ctx.fillText(
      readings.truePeak > -100 ? readings.truePeak.toFixed(1) + " dBTP" : "-∞",
      panelX + 5,
      meterY + 117,
    );

    // LRA (Loudness Range)
    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle = "#a78bfa";
    ctx.fillText("LRA", panelX + 5, meterY + 132);
    ctx.font = "bold 12px monospace";
    ctx.fillText(
      readings.range !== undefined ? readings.range.toFixed(1) + " LU" : "—",
      panelX + 5,
      meterY + 144,
    );

    // Draw border
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    animationFrameRef.current = requestAnimationFrame(draw);
  }, [
    analyser,
    audioContext,
    width,
    height,
    targetPreset,
    readings,
    calculateMeanSquare,
    meanSquareToLufs,
    calculateIntegratedWithGating,
    calculateLRA,
  ]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [draw]);

  // Reset all measurements
  const resetIntegrated = () => {
    momentaryBufferRef.current = [];
    shortTermBufferRef.current = [];
    gatedBlocksRef.current = [];
    lraBlocksRef.current = [];
    truePeakRef.current = -Infinity;
    setReadings({
      momentary: -Infinity,
      shortTerm: -Infinity,
      integrated: -Infinity,
      truePeak: -Infinity,
      range: undefined,
    });
  };

  const isKWeighted = kWeightedAnalyserRef.current !== null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-indigo-300 font-bold uppercase tracking-wider">
            Loudness Meter (LUFS)
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              isKWeighted
                ? "bg-green-900/50 text-green-400 border border-green-700"
                : "bg-yellow-900/50 text-yellow-400 border border-yellow-700"
            }`}
            title={
              isKWeighted
                ? "ITU-R BS.1770-4 K-weighting active"
                : "Using simplified measurement (no K-weighting)"
            }
          >
            {isKWeighted ? "K-Weighted" : "Basic"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={targetPreset}
            onChange={(e) => onPresetChange?.(e.target.value as LufsPreset)}
            className="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-300"
          >
            {Object.entries(LUFS_PRESETS).map(([key, config]) => (
              <option key={key} value={key}>
                {config.name} ({config.target} LUFS)
              </option>
            ))}
          </select>
          <button
            onClick={resetIntegrated}
            className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300"
            title="Reset integrated measurement"
          >
            Reset
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
        className="rounded-md"
      />
    </div>
  );
};

export default LufsMeter;
