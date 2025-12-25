import React, { useEffect, useRef, useCallback, useState } from "react";

export interface CompressorBandSettings {
  name: string;
  lowFreq: number;
  highFreq: number;
  enabled: boolean;
  solo: boolean;
  threshold: number; // -60 to 0 dB
  ratio: number; // 1 to 20
  attack: number; // 0.001 to 1 seconds
  release: number; // 0.01 to 2 seconds
  makeupGain: number; // 0 to 24 dB
}

export interface MultibandCompressorSettings {
  bands: CompressorBandSettings[];
  bypass: boolean;
  inputGain: number;
  outputGain: number;
}

export const DEFAULT_BAND_SETTINGS: CompressorBandSettings[] = [
  {
    name: "Low",
    lowFreq: 20,
    highFreq: 150,
    enabled: true,
    solo: false,
    threshold: -20,
    ratio: 4,
    attack: 0.01,
    release: 0.2,
    makeupGain: 0,
  },
  {
    name: "Low-Mid",
    lowFreq: 150,
    highFreq: 600,
    enabled: true,
    solo: false,
    threshold: -18,
    ratio: 3,
    attack: 0.005,
    release: 0.15,
    makeupGain: 0,
  },
  {
    name: "High-Mid",
    lowFreq: 600,
    highFreq: 3000,
    enabled: true,
    solo: false,
    threshold: -16,
    ratio: 2.5,
    attack: 0.003,
    release: 0.1,
    makeupGain: 0,
  },
  {
    name: "High",
    lowFreq: 3000,
    highFreq: 20000,
    enabled: true,
    solo: false,
    threshold: -14,
    ratio: 2,
    attack: 0.001,
    release: 0.08,
    makeupGain: 0,
  },
];

export const DEFAULT_MULTIBAND_SETTINGS: MultibandCompressorSettings = {
  bands: DEFAULT_BAND_SETTINGS,
  bypass: true,
  inputGain: 0,
  outputGain: 0,
};

export const MULTIBAND_PRESETS: Record<string, MultibandCompressorSettings> = {
  Gentle: {
    bands: [
      {
        name: "Low",
        lowFreq: 20,
        highFreq: 150,
        enabled: true,
        solo: false,
        threshold: -24,
        ratio: 2,
        attack: 0.02,
        release: 0.3,
        makeupGain: 1,
      },
      {
        name: "Low-Mid",
        lowFreq: 150,
        highFreq: 600,
        enabled: true,
        solo: false,
        threshold: -22,
        ratio: 2,
        attack: 0.01,
        release: 0.2,
        makeupGain: 1,
      },
      {
        name: "High-Mid",
        lowFreq: 600,
        highFreq: 3000,
        enabled: true,
        solo: false,
        threshold: -20,
        ratio: 1.5,
        attack: 0.005,
        release: 0.15,
        makeupGain: 0,
      },
      {
        name: "High",
        lowFreq: 3000,
        highFreq: 20000,
        enabled: true,
        solo: false,
        threshold: -18,
        ratio: 1.5,
        attack: 0.003,
        release: 0.1,
        makeupGain: 0,
      },
    ],
    bypass: false,
    inputGain: 0,
    outputGain: 0,
  },
  Punch: {
    bands: [
      {
        name: "Low",
        lowFreq: 20,
        highFreq: 150,
        enabled: true,
        solo: false,
        threshold: -18,
        ratio: 6,
        attack: 0.005,
        release: 0.15,
        makeupGain: 3,
      },
      {
        name: "Low-Mid",
        lowFreq: 150,
        highFreq: 600,
        enabled: true,
        solo: false,
        threshold: -16,
        ratio: 4,
        attack: 0.003,
        release: 0.1,
        makeupGain: 2,
      },
      {
        name: "High-Mid",
        lowFreq: 600,
        highFreq: 3000,
        enabled: true,
        solo: false,
        threshold: -14,
        ratio: 3,
        attack: 0.002,
        release: 0.08,
        makeupGain: 1,
      },
      {
        name: "High",
        lowFreq: 3000,
        highFreq: 20000,
        enabled: true,
        solo: false,
        threshold: -12,
        ratio: 2.5,
        attack: 0.001,
        release: 0.06,
        makeupGain: 0,
      },
    ],
    bypass: false,
    inputGain: 0,
    outputGain: -2,
  },
  Broadcast: {
    bands: [
      {
        name: "Low",
        lowFreq: 20,
        highFreq: 150,
        enabled: true,
        solo: false,
        threshold: -30,
        ratio: 8,
        attack: 0.01,
        release: 0.25,
        makeupGain: 6,
      },
      {
        name: "Low-Mid",
        lowFreq: 150,
        highFreq: 600,
        enabled: true,
        solo: false,
        threshold: -28,
        ratio: 6,
        attack: 0.008,
        release: 0.2,
        makeupGain: 5,
      },
      {
        name: "High-Mid",
        lowFreq: 600,
        highFreq: 3000,
        enabled: true,
        solo: false,
        threshold: -26,
        ratio: 5,
        attack: 0.005,
        release: 0.15,
        makeupGain: 4,
      },
      {
        name: "High",
        lowFreq: 3000,
        highFreq: 20000,
        enabled: true,
        solo: false,
        threshold: -24,
        ratio: 4,
        attack: 0.003,
        release: 0.1,
        makeupGain: 3,
      },
    ],
    bypass: false,
    inputGain: -3,
    outputGain: 3,
  },
  Vocal: {
    bands: [
      {
        name: "Low",
        lowFreq: 20,
        highFreq: 150,
        enabled: true,
        solo: false,
        threshold: -30,
        ratio: 4,
        attack: 0.02,
        release: 0.3,
        makeupGain: 0,
      },
      {
        name: "Low-Mid",
        lowFreq: 150,
        highFreq: 600,
        enabled: true,
        solo: false,
        threshold: -20,
        ratio: 3,
        attack: 0.01,
        release: 0.15,
        makeupGain: 2,
      },
      {
        name: "High-Mid",
        lowFreq: 600,
        highFreq: 3000,
        enabled: true,
        solo: false,
        threshold: -16,
        ratio: 2.5,
        attack: 0.005,
        release: 0.1,
        makeupGain: 3,
      },
      {
        name: "High",
        lowFreq: 3000,
        highFreq: 20000,
        enabled: true,
        solo: false,
        threshold: -18,
        ratio: 2,
        attack: 0.003,
        release: 0.08,
        makeupGain: 1,
      },
    ],
    bypass: false,
    inputGain: 0,
    outputGain: 0,
  },
};

interface MultibandCompressorProps {
  audioContext: AudioContext | null;
  settings: MultibandCompressorSettings;
  onChange: (settings: MultibandCompressorSettings) => void;
  bypass: boolean;
  onBypassChange: (bypass: boolean) => void;
  gainReductions?: number[]; // Real-time gain reduction per band (from audio nodes)
}

const BAND_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444"];

const MultibandCompressor: React.FC<MultibandCompressorProps> = ({
  audioContext,
  settings,
  onChange,
  bypass,
  onBypassChange,
  gainReductions = [0, 0, 0, 0],
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [selectedBand, setSelectedBand] = useState<number>(0);
  const [selectedPreset, setSelectedPreset] = useState<string>("");

  const updateBand = (
    index: number,
    updates: Partial<CompressorBandSettings>,
  ) => {
    const newBands = [...settings.bands];
    newBands[index] = { ...newBands[index], ...updates };
    onChange({ ...settings, bands: newBands });
  };

  const applyPreset = (presetName: string) => {
    const preset = MULTIBAND_PRESETS[presetName];
    if (preset) {
      onChange(preset);
      setSelectedPreset(presetName);
      onBypassChange(preset.bypass);
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      animationFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    // Clear
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, width, height);

    // Draw frequency response visualization
    const freqWidth = width;
    const freqHeight = 60;

    // Logarithmic frequency scale
    const minFreq = 20;
    const maxFreq = 20000;
    const freqToX = (freq: number) => {
      const minLog = Math.log10(minFreq);
      const maxLog = Math.log10(maxFreq);
      const freqLog = Math.log10(Math.max(minFreq, Math.min(maxFreq, freq)));
      return ((freqLog - minLog) / (maxLog - minLog)) * freqWidth;
    };

    // Draw frequency grid
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 0.5;
    ctx.font = "9px monospace";
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "center";

    const freqMarkers = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
    for (const freq of freqMarkers) {
      const x = freqToX(freq);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, freqHeight);
      ctx.stroke();
      const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
      ctx.fillText(label, x, freqHeight + 12);
    }

    // Draw band regions
    for (let i = 0; i < settings.bands.length; i++) {
      const band = settings.bands[i];
      const x1 = freqToX(band.lowFreq);
      const x2 = freqToX(band.highFreq);

      // Band fill
      ctx.fillStyle = BAND_COLORS[i] + (band.enabled ? "33" : "11");
      ctx.fillRect(x1, 0, x2 - x1, freqHeight);

      // Band border (highlight if selected)
      ctx.strokeStyle =
        i === selectedBand ? BAND_COLORS[i] : BAND_COLORS[i] + "66";
      ctx.lineWidth = i === selectedBand ? 2 : 1;
      ctx.strokeRect(x1, 0, x2 - x1, freqHeight);

      // Draw gain reduction meter inside band
      if (!bypass && band.enabled) {
        const reduction = Math.abs(gainReductions[i] || 0);
        const reductionHeight = Math.min(
          freqHeight,
          (reduction / 20) * freqHeight,
        );
        ctx.fillStyle = BAND_COLORS[i] + "88";
        ctx.fillRect(
          x1 + 2,
          freqHeight - reductionHeight,
          x2 - x1 - 4,
          reductionHeight,
        );
      }

      // Band name label
      ctx.fillStyle = BAND_COLORS[i];
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(band.name, (x1 + x2) / 2, freqHeight / 2 + 4);

      // Solo/Mute indicators
      if (band.solo) {
        ctx.fillStyle = "#facc15";
        ctx.fillText("S", x1 + 10, 15);
      }
      if (!band.enabled) {
        ctx.fillStyle = "#ef4444";
        ctx.fillText("M", x1 + 10, 15);
      }
    }

    // Draw border
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, freqWidth - 1, freqHeight - 1);

    animationFrameRef.current = requestAnimationFrame(draw);
  }, [settings, bypass, selectedBand, gainReductions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = 400 * dpr;
      canvas.height = 80 * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    }

    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [draw]);

  const currentBand = settings.bands[selectedBand];

  return (
    <div className="flex flex-col gap-3 p-3 bg-gray-800 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-indigo-300 font-bold uppercase tracking-wider">
          Multiband Compressor
        </span>
        <div className="flex items-center gap-2">
          <select
            value={selectedPreset}
            onChange={(e) => applyPreset(e.target.value)}
            className="text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-300"
          >
            <option value="">Presets...</option>
            {Object.keys(MULTIBAND_PRESETS).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            onClick={() => onBypassChange(!bypass)}
            className={`text-xs px-3 py-1 rounded font-medium ${
              bypass ? "bg-gray-600 text-gray-400" : "bg-green-600 text-white"
            }`}
          >
            {bypass ? "Bypassed" : "Active"}
          </button>
        </div>
      </div>

      {/* Frequency visualization */}
      <canvas
        ref={canvasRef}
        style={{ width: "400px", height: "80px" }}
        className="rounded"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const clickFreq = 20 * Math.pow(1000, x / 400);

          for (let i = 0; i < settings.bands.length; i++) {
            if (
              clickFreq >= settings.bands[i].lowFreq &&
              clickFreq < settings.bands[i].highFreq
            ) {
              setSelectedBand(i);
              break;
            }
          }
        }}
      />

      {/* Band selector buttons */}
      <div className="flex gap-1">
        {settings.bands.map((band, i) => (
          <button
            key={i}
            onClick={() => setSelectedBand(i)}
            className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${
              i === selectedBand
                ? "text-white"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
            }`}
            style={{
              backgroundColor: i === selectedBand ? BAND_COLORS[i] : undefined,
            }}
          >
            {band.name}
          </button>
        ))}
      </div>

      {/* Selected band controls */}
      <div className="grid grid-cols-2 gap-3 p-3 bg-gray-900 rounded">
        {/* Enable/Solo */}
        <div className="flex gap-2">
          <button
            onClick={() =>
              updateBand(selectedBand, { enabled: !currentBand.enabled })
            }
            className={`flex-1 py-1 text-xs rounded ${
              currentBand.enabled
                ? "bg-green-600 text-white"
                : "bg-gray-700 text-red-400"
            }`}
          >
            {currentBand.enabled ? "Enabled" : "Muted"}
          </button>
          <button
            onClick={() =>
              updateBand(selectedBand, { solo: !currentBand.solo })
            }
            className={`flex-1 py-1 text-xs rounded ${
              currentBand.solo
                ? "bg-yellow-500 text-black"
                : "bg-gray-700 text-gray-400"
            }`}
          >
            Solo
          </button>
        </div>

        {/* Gain reduction display */}
        <div className="flex items-center justify-end">
          <span className="text-xs text-gray-500 mr-2">GR:</span>
          <span className="text-sm font-mono text-orange-400">
            {gainReductions[selectedBand]?.toFixed(1) || "0.0"} dB
          </span>
        </div>

        {/* Threshold */}
        <div className="col-span-2">
          <label className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Threshold</span>
            <span className="font-mono">
              {currentBand.threshold.toFixed(1)} dB
            </span>
          </label>
          <input
            type="range"
            min="-60"
            max="0"
            step="0.5"
            value={currentBand.threshold}
            onChange={(e) =>
              updateBand(selectedBand, {
                threshold: parseFloat(e.target.value),
              })
            }
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Ratio */}
        <div>
          <label className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Ratio</span>
            <span className="font-mono">{currentBand.ratio.toFixed(1)}:1</span>
          </label>
          <input
            type="range"
            min="1"
            max="20"
            step="0.5"
            value={currentBand.ratio}
            onChange={(e) =>
              updateBand(selectedBand, { ratio: parseFloat(e.target.value) })
            }
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Makeup Gain */}
        <div>
          <label className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Makeup</span>
            <span className="font-mono">
              {currentBand.makeupGain.toFixed(1)} dB
            </span>
          </label>
          <input
            type="range"
            min="0"
            max="24"
            step="0.5"
            value={currentBand.makeupGain}
            onChange={(e) =>
              updateBand(selectedBand, {
                makeupGain: parseFloat(e.target.value),
              })
            }
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Attack */}
        <div>
          <label className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Attack</span>
            <span className="font-mono">
              {(currentBand.attack * 1000).toFixed(1)} ms
            </span>
          </label>
          <input
            type="range"
            min="0.001"
            max="0.5"
            step="0.001"
            value={currentBand.attack}
            onChange={(e) =>
              updateBand(selectedBand, { attack: parseFloat(e.target.value) })
            }
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Release */}
        <div>
          <label className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Release</span>
            <span className="font-mono">
              {(currentBand.release * 1000).toFixed(0)} ms
            </span>
          </label>
          <input
            type="range"
            min="0.01"
            max="2"
            step="0.01"
            value={currentBand.release}
            onChange={(e) =>
              updateBand(selectedBand, { release: parseFloat(e.target.value) })
            }
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>
      </div>

      {/* Input/Output Gain */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Input Gain</span>
            <span className="font-mono">
              {settings.inputGain.toFixed(1)} dB
            </span>
          </label>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            value={settings.inputGain}
            onChange={(e) =>
              onChange({ ...settings, inputGain: parseFloat(e.target.value) })
            }
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>
        <div className="flex-1">
          <label className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Output Gain</span>
            <span className="font-mono">
              {settings.outputGain.toFixed(1)} dB
            </span>
          </label>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            value={settings.outputGain}
            onChange={(e) =>
              onChange({ ...settings, outputGain: parseFloat(e.target.value) })
            }
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>
      </div>
    </div>
  );
};

export default MultibandCompressor;
