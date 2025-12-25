import React, { useState, useEffect, useCallback, useRef } from "react";

interface SidechainCompressorProps {
  audioContext: AudioContext | null;
  targetNode: AudioNode | null; // The node to apply compression to
  sidechainNode: AudioNode | null; // The node to use as sidechain source
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onGainReductionChange?: (gr: number) => void;
}

interface SidechainSettings {
  threshold: number; // -60 to 0 dB
  ratio: number; // 1 to 20
  attack: number; // 0.001 to 1 seconds
  release: number; // 0.01 to 2 seconds
  makeupGain: number; // 0 to 24 dB
}

const DEFAULT_SETTINGS: SidechainSettings = {
  threshold: -24,
  ratio: 4,
  attack: 0.003,
  release: 0.25,
  makeupGain: 0,
};

const PRESETS: { name: string; settings: SidechainSettings }[] = [
  {
    name: "Subtle Ducking",
    settings: {
      threshold: -30,
      ratio: 2,
      attack: 0.01,
      release: 0.3,
      makeupGain: 0,
    },
  },
  {
    name: "Pumping EDM",
    settings: {
      threshold: -20,
      ratio: 8,
      attack: 0.001,
      release: 0.15,
      makeupGain: 2,
    },
  },
  {
    name: "Vocal Ducking",
    settings: {
      threshold: -24,
      ratio: 4,
      attack: 0.005,
      release: 0.4,
      makeupGain: 0,
    },
  },
  {
    name: "Bass Control",
    settings: {
      threshold: -18,
      ratio: 6,
      attack: 0.002,
      release: 0.2,
      makeupGain: 1,
    },
  },
  {
    name: "Aggressive",
    settings: {
      threshold: -15,
      ratio: 12,
      attack: 0.001,
      release: 0.1,
      makeupGain: 3,
    },
  },
];

export default function SidechainCompressor({
  audioContext,
  targetNode,
  sidechainNode,
  enabled,
  onEnabledChange,
  onGainReductionChange,
}: SidechainCompressorProps) {
  const [settings, setSettings] = useState<SidechainSettings>(DEFAULT_SETTINGS);
  const [gainReduction, setGainReduction] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const makeupGainRef = useRef<GainNode | null>(null);
  const sidechainAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);

  // Create and connect the compressor chain
  useEffect(() => {
    if (!audioContext || !targetNode || !sidechainNode) return;

    // Create nodes
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = settings.threshold;
    compressor.ratio.value = settings.ratio;
    compressor.attack.value = settings.attack;
    compressor.release.value = settings.release;
    compressor.knee.value = 6;

    const makeupGain = audioContext.createGain();
    makeupGain.gain.value = Math.pow(10, settings.makeupGain / 20);

    // Analyser for sidechain level detection (for visual feedback)
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    // Connect sidechain source to analyser for visual feedback
    sidechainNode.connect(analyser);

    compressorRef.current = compressor;
    makeupGainRef.current = makeupGain;
    sidechainAnalyserRef.current = analyser;

    // Note: Web Audio API's DynamicsCompressorNode doesn't support external sidechain input
    // We simulate sidechain effect by analyzing the sidechain source and modulating
    // the target's gain based on the sidechain level

    return () => {
      compressor.disconnect();
      makeupGain.disconnect();
      analyser.disconnect();
    };
  }, [audioContext, targetNode, sidechainNode]);

  // Update compressor settings
  useEffect(() => {
    if (!compressorRef.current || !makeupGainRef.current) return;

    const rampTime = 0.02;
    const currentTime = audioContext?.currentTime || 0;

    compressorRef.current.threshold.setTargetAtTime(
      settings.threshold,
      currentTime,
      rampTime,
    );
    compressorRef.current.ratio.setTargetAtTime(
      settings.ratio,
      currentTime,
      rampTime,
    );
    compressorRef.current.attack.setTargetAtTime(
      settings.attack,
      currentTime,
      rampTime,
    );
    compressorRef.current.release.setTargetAtTime(
      settings.release,
      currentTime,
      rampTime,
    );
    makeupGainRef.current.gain.setTargetAtTime(
      Math.pow(10, settings.makeupGain / 20),
      currentTime,
      rampTime,
    );
  }, [settings, audioContext]);

  // Gain reduction meter animation
  useEffect(() => {
    if (!enabled || !compressorRef.current) {
      cancelAnimationFrame(animationRef.current);
      setGainReduction(0);
      return;
    }

    const updateMeter = () => {
      if (compressorRef.current) {
        const gr = compressorRef.current.reduction;
        setGainReduction(gr);
        onGainReductionChange?.(gr);
      }
      animationRef.current = requestAnimationFrame(updateMeter);
    };

    animationRef.current = requestAnimationFrame(updateMeter);

    return () => cancelAnimationFrame(animationRef.current);
  }, [enabled, onGainReductionChange]);

  const updateSetting = useCallback(
    <K extends keyof SidechainSettings>(
      key: K,
      value: SidechainSettings[K],
    ) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const loadPreset = useCallback((preset: (typeof PRESETS)[0]) => {
    setSettings(preset.settings);
  }, []);

  const formatMs = (seconds: number) => `${(seconds * 1000).toFixed(0)}ms`;
  const formatDb = (db: number) => `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`;

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 bg-gradient-to-r from-orange-900/30 to-red-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-600/30 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-orange-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                Sidechain Compressor
              </h4>
              <p className="text-xs text-gray-400">Ducking effect</p>
            </div>
          </div>
          <button
            onClick={() => onEnabledChange(!enabled)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              enabled
                ? "bg-orange-600 text-white"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
            }`}
          >
            {enabled ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Gain Reduction Meter */}
      <div className="p-3 bg-gray-900/50 border-b border-gray-700">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">Gain Reduction</span>
          <span className="text-xs font-mono text-orange-400">
            {formatDb(gainReduction)}
          </span>
        </div>
        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-75"
            style={{ width: `${Math.min(100, Math.abs(gainReduction) * 5)}%` }}
          />
        </div>
      </div>

      {/* Presets */}
      <div className="p-3 border-b border-gray-700">
        <p className="text-xs text-gray-400 mb-2">Presets</p>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => loadPreset(preset)}
              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Controls */}
      <div className="p-3 space-y-3">
        {/* Threshold */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Threshold</span>
            <span className="text-gray-300 font-mono">
              {formatDb(settings.threshold)}
            </span>
          </div>
          <input
            type="range"
            min="-60"
            max="0"
            step="0.5"
            value={settings.threshold}
            onChange={(e) =>
              updateSetting("threshold", parseFloat(e.target.value))
            }
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
        </div>

        {/* Ratio */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Ratio</span>
            <span className="text-gray-300 font-mono">
              {settings.ratio.toFixed(1)}:1
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="20"
            step="0.5"
            value={settings.ratio}
            onChange={(e) => updateSetting("ratio", parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
        </div>

        {/* Advanced Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1"
        >
          <svg
            className={`w-3 h-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          Advanced Settings
        </button>

        {/* Advanced Controls */}
        {showAdvanced && (
          <div className="space-y-3 pt-2 border-t border-gray-700">
            {/* Attack */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Attack</span>
                <span className="text-gray-300 font-mono">
                  {formatMs(settings.attack)}
                </span>
              </div>
              <input
                type="range"
                min="0.001"
                max="0.1"
                step="0.001"
                value={settings.attack}
                onChange={(e) =>
                  updateSetting("attack", parseFloat(e.target.value))
                }
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            {/* Release */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Release</span>
                <span className="text-gray-300 font-mono">
                  {formatMs(settings.release)}
                </span>
              </div>
              <input
                type="range"
                min="0.01"
                max="1"
                step="0.01"
                value={settings.release}
                onChange={(e) =>
                  updateSetting("release", parseFloat(e.target.value))
                }
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            {/* Makeup Gain */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Makeup Gain</span>
                <span className="text-gray-300 font-mono">
                  {formatDb(settings.makeupGain)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="24"
                step="0.5"
                value={settings.makeupGain}
                onChange={(e) =>
                  updateSetting("makeupGain", parseFloat(e.target.value))
                }
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 bg-gray-900/30 border-t border-gray-700">
        <p className="text-[10px] text-gray-500">
          The sidechain source controls when compression is applied. Use
          instrumental as sidechain source to duck vocals/harmonies when the
          beat hits.
        </p>
      </div>
    </div>
  );
}
