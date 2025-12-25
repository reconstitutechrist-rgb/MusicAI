import React, { useState, useCallback } from "react";
import { AudioAnalysisResult } from "../../types";

interface MasteringAssistantProps {
  audioAnalysis: AudioAnalysisResult | null;
  onApplySettings: (settings: MasteringSuggestions) => void;
  isAnalyzing?: boolean;
}

export interface MasteringSuggestions {
  // EQ recommendations
  eq: {
    lowShelf: { freq: number; gain: number };
    lowMid: { freq: number; gain: number; q: number };
    highMid: { freq: number; gain: number; q: number };
    highShelf: { freq: number; gain: number };
    presence: { freq: number; gain: number; q: number };
  };
  // Compression recommendations
  compression: {
    threshold: number;
    ratio: number;
    attack: number;
    release: number;
    makeupGain: number;
  };
  // Multiband compression presets
  multibandPreset: "gentle" | "punch" | "broadcast" | "vocal";
  // Loudness target
  targetLufs: number;
  truePeakLimit: number;
  // Stereo width adjustment
  stereoWidth: number;
  // AI reasoning
  reasoning: string[];
}

// Genre-based mastering profiles
const GENRE_PROFILES: Record<string, Partial<MasteringSuggestions>> = {
  "hip-hop": {
    eq: {
      lowShelf: { freq: 80, gain: 2 },
      lowMid: { freq: 200, gain: -1.5, q: 1.5 },
      highMid: { freq: 3000, gain: 1, q: 2 },
      highShelf: { freq: 10000, gain: 1.5 },
      presence: { freq: 5000, gain: 0.5, q: 1.5 },
    },
    compression: {
      threshold: -12,
      ratio: 4,
      attack: 0.01,
      release: 0.15,
      makeupGain: 3,
    },
    multibandPreset: "punch",
    targetLufs: -14,
    truePeakLimit: -1,
    stereoWidth: 1.1,
  },
  pop: {
    eq: {
      lowShelf: { freq: 100, gain: 1 },
      lowMid: { freq: 300, gain: -1, q: 2 },
      highMid: { freq: 4000, gain: 1.5, q: 1.5 },
      highShelf: { freq: 12000, gain: 2 },
      presence: { freq: 2500, gain: 1, q: 2 },
    },
    compression: {
      threshold: -14,
      ratio: 3,
      attack: 0.005,
      release: 0.1,
      makeupGain: 2,
    },
    multibandPreset: "gentle",
    targetLufs: -14,
    truePeakLimit: -1,
    stereoWidth: 1.2,
  },
  rock: {
    eq: {
      lowShelf: { freq: 80, gain: 1.5 },
      lowMid: { freq: 250, gain: -2, q: 1.5 },
      highMid: { freq: 3500, gain: 2, q: 1.5 },
      highShelf: { freq: 8000, gain: 1 },
      presence: { freq: 5000, gain: 1.5, q: 2 },
    },
    compression: {
      threshold: -10,
      ratio: 4,
      attack: 0.003,
      release: 0.08,
      makeupGain: 4,
    },
    multibandPreset: "punch",
    targetLufs: -12,
    truePeakLimit: -1,
    stereoWidth: 1.0,
  },
  electronic: {
    eq: {
      lowShelf: { freq: 60, gain: 2.5 },
      lowMid: { freq: 200, gain: -1, q: 2 },
      highMid: { freq: 5000, gain: 1.5, q: 1.5 },
      highShelf: { freq: 14000, gain: 2.5 },
      presence: { freq: 8000, gain: 1, q: 2 },
    },
    compression: {
      threshold: -8,
      ratio: 5,
      attack: 0.001,
      release: 0.05,
      makeupGain: 5,
    },
    multibandPreset: "broadcast",
    targetLufs: -10,
    truePeakLimit: -0.5,
    stereoWidth: 1.3,
  },
  jazz: {
    eq: {
      lowShelf: { freq: 100, gain: 0.5 },
      lowMid: { freq: 400, gain: -0.5, q: 2 },
      highMid: { freq: 2000, gain: 0.5, q: 2 },
      highShelf: { freq: 10000, gain: 1 },
      presence: { freq: 4000, gain: 0.5, q: 2 },
    },
    compression: {
      threshold: -18,
      ratio: 2,
      attack: 0.02,
      release: 0.2,
      makeupGain: 1,
    },
    multibandPreset: "gentle",
    targetLufs: -16,
    truePeakLimit: -2,
    stereoWidth: 1.0,
  },
  classical: {
    eq: {
      lowShelf: { freq: 80, gain: 0 },
      lowMid: { freq: 300, gain: 0, q: 2 },
      highMid: { freq: 3000, gain: 0.5, q: 2 },
      highShelf: { freq: 12000, gain: 0.5 },
      presence: { freq: 5000, gain: 0, q: 2 },
    },
    compression: {
      threshold: -24,
      ratio: 1.5,
      attack: 0.05,
      release: 0.3,
      makeupGain: 0,
    },
    multibandPreset: "gentle",
    targetLufs: -18,
    truePeakLimit: -2,
    stereoWidth: 1.0,
  },
  "r&b": {
    eq: {
      lowShelf: { freq: 80, gain: 2 },
      lowMid: { freq: 250, gain: -1, q: 2 },
      highMid: { freq: 3500, gain: 1, q: 2 },
      highShelf: { freq: 12000, gain: 1.5 },
      presence: { freq: 2000, gain: 1.5, q: 1.5 },
    },
    compression: {
      threshold: -14,
      ratio: 3,
      attack: 0.008,
      release: 0.12,
      makeupGain: 2,
    },
    multibandPreset: "vocal",
    targetLufs: -14,
    truePeakLimit: -1,
    stereoWidth: 1.15,
  },
  default: {
    eq: {
      lowShelf: { freq: 80, gain: 1 },
      lowMid: { freq: 300, gain: -1, q: 2 },
      highMid: { freq: 3000, gain: 1, q: 2 },
      highShelf: { freq: 10000, gain: 1 },
      presence: { freq: 5000, gain: 0.5, q: 2 },
    },
    compression: {
      threshold: -14,
      ratio: 3,
      attack: 0.01,
      release: 0.1,
      makeupGain: 2,
    },
    multibandPreset: "gentle",
    targetLufs: -14,
    truePeakLimit: -1,
    stereoWidth: 1.0,
  },
};

// Mood-based adjustments
const MOOD_ADJUSTMENTS: Record<
  string,
  { eq: Partial<MasteringSuggestions["eq"]>; stereoWidth: number }
> = {
  energetic: { eq: { highShelf: { freq: 10000, gain: 2 } }, stereoWidth: 1.2 },
  chill: {
    eq: { highMid: { freq: 3000, gain: -0.5, q: 2 } },
    stereoWidth: 1.1,
  },
  dark: {
    eq: {
      lowShelf: { freq: 60, gain: 2 },
      highShelf: { freq: 8000, gain: -1 },
    },
    stereoWidth: 0.9,
  },
  bright: { eq: { highShelf: { freq: 12000, gain: 2.5 } }, stereoWidth: 1.15 },
  warm: {
    eq: {
      lowMid: { freq: 400, gain: 1, q: 1.5 },
      highShelf: { freq: 10000, gain: -0.5 },
    },
    stereoWidth: 1.0,
  },
  aggressive: {
    eq: { highMid: { freq: 4000, gain: 2, q: 1.5 } },
    stereoWidth: 1.0,
  },
  default: { eq: {}, stereoWidth: 1.0 },
};

const MasteringAssistant: React.FC<MasteringAssistantProps> = ({
  audioAnalysis,
  onApplySettings,
  isAnalyzing = false,
}) => {
  const [suggestions, setSuggestions] = useState<MasteringSuggestions | null>(
    null,
  );
  const [showDetails, setShowDetails] = useState(false);

  const generateSuggestions = useCallback(() => {
    if (!audioAnalysis) return;

    // Determine base profile from genre
    const genreLower = audioAnalysis.genre.toLowerCase();
    let baseProfile = GENRE_PROFILES["default"];

    for (const [genre, profile] of Object.entries(GENRE_PROFILES)) {
      if (genreLower.includes(genre) || genre.includes(genreLower)) {
        baseProfile = profile as Partial<MasteringSuggestions>;
        break;
      }
    }

    // Apply mood adjustments
    const moodLower = audioAnalysis.mood.toLowerCase();
    let moodAdjustment = MOOD_ADJUSTMENTS["default"] || {
      eq: {},
      stereoWidth: 1.0,
    };

    for (const [mood, adjustment] of Object.entries(MOOD_ADJUSTMENTS)) {
      if (moodLower.includes(mood)) {
        moodAdjustment = adjustment;
        break;
      }
    }

    // Build reasoning
    const reasoning: string[] = [];
    reasoning.push(
      `Detected genre: ${audioAnalysis.genre} - applying ${genreLower.includes("hip") ? "punchy bass and crisp highs" : "balanced"} profile`,
    );
    reasoning.push(
      `Key: ${audioAnalysis.key} - EQ curves optimized for harmonic content`,
    );
    reasoning.push(
      `BPM: ${audioAnalysis.bpm} - compression timing adjusted for tempo`,
    );
    reasoning.push(
      `Mood: ${audioAnalysis.mood} - ${moodLower.includes("energetic") ? "boosting presence and width" : "maintaining natural dynamics"}`,
    );

    if (audioAnalysis.productionFeedback) {
      reasoning.push(
        `Production note: ${audioAnalysis.productionFeedback.slice(0, 100)}...`,
      );
    }

    // Merge base profile with mood adjustments
    const finalSuggestions: MasteringSuggestions = {
      eq: {
        ...baseProfile.eq!,
        ...moodAdjustment.eq,
      } as MasteringSuggestions["eq"],
      compression: baseProfile.compression!,
      multibandPreset: baseProfile.multibandPreset!,
      targetLufs: baseProfile.targetLufs!,
      truePeakLimit: baseProfile.truePeakLimit!,
      stereoWidth: (baseProfile.stereoWidth! + moodAdjustment.stereoWidth) / 2,
      reasoning,
    };

    setSuggestions(finalSuggestions);
  }, [audioAnalysis]);

  const handleApply = () => {
    if (suggestions) {
      onApplySettings(suggestions);
    }
  };

  if (isAnalyzing) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-300">
            Analyzing audio for mastering suggestions...
          </span>
        </div>
      </div>
    );
  }

  if (!audioAnalysis) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <div className="text-center text-gray-400">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <p className="font-medium">AI Mastering Assistant</p>
          <p className="text-sm mt-1">
            Analyze your audio to get AI-powered mastering suggestions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-purple-900/30 to-indigo-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-600/30 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-white">AI Mastering Assistant</h3>
              <p className="text-sm text-gray-400">
                Genre: {audioAnalysis.genre} | Key: {audioAnalysis.key}
              </p>
            </div>
          </div>
          {!suggestions && (
            <button
              onClick={generateSuggestions}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium transition-colors"
            >
              Generate Suggestions
            </button>
          )}
        </div>
      </div>

      {suggestions && (
        <>
          {/* AI Reasoning */}
          <div className="p-4 border-b border-gray-700">
            <h4 className="text-sm font-bold text-purple-300 uppercase tracking-wider mb-2">
              AI Analysis
            </h4>
            <ul className="space-y-1">
              {suggestions.reasoning.map((reason, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-300"
                >
                  <span className="text-purple-400 mt-0.5">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Summary */}
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-gray-700">
            <div className="text-center p-3 bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Target LUFS</p>
              <p className="text-xl font-bold text-green-400">
                {suggestions.targetLufs}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">True Peak</p>
              <p className="text-xl font-bold text-yellow-400">
                {suggestions.truePeakLimit} dB
              </p>
            </div>
            <div className="text-center p-3 bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Comp Ratio</p>
              <p className="text-xl font-bold text-blue-400">
                {suggestions.compression.ratio}:1
              </p>
            </div>
            <div className="text-center p-3 bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Stereo Width</p>
              <p className="text-xl font-bold text-indigo-400">
                {(suggestions.stereoWidth * 100).toFixed(0)}%
              </p>
            </div>
          </div>

          {/* Detailed Settings (Collapsible) */}
          <div className="border-b border-gray-700">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full p-3 flex items-center justify-between text-left hover:bg-gray-700/30 transition-colors"
            >
              <span className="text-sm font-medium text-gray-300">
                Detailed Settings
              </span>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${showDetails ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showDetails && (
              <div className="p-4 space-y-4 bg-gray-900/30">
                {/* EQ Settings */}
                <div>
                  <h5 className="text-xs font-bold text-gray-400 uppercase mb-2">
                    EQ Recommendations
                  </h5>
                  <div className="grid grid-cols-5 gap-2 text-xs">
                    {(
                      Object.entries(suggestions.eq) as [
                        string,
                        { freq: number; gain: number; q?: number },
                      ][]
                    ).map(([band, settings]) => (
                      <div
                        key={band}
                        className="bg-gray-800 p-2 rounded text-center"
                      >
                        <p className="text-gray-500 capitalize">
                          {band.replace(/([A-Z])/g, " $1").trim()}
                        </p>
                        <p className="text-white font-mono">
                          {settings.freq}Hz
                        </p>
                        <p
                          className={`font-bold ${settings.gain >= 0 ? "text-green-400" : "text-red-400"}`}
                        >
                          {settings.gain > 0 ? "+" : ""}
                          {settings.gain}dB
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Compression Settings */}
                <div>
                  <h5 className="text-xs font-bold text-gray-400 uppercase mb-2">
                    Compression Settings
                  </h5>
                  <div className="grid grid-cols-5 gap-2 text-xs">
                    <div className="bg-gray-800 p-2 rounded text-center">
                      <p className="text-gray-500">Threshold</p>
                      <p className="text-white font-bold">
                        {suggestions.compression.threshold}dB
                      </p>
                    </div>
                    <div className="bg-gray-800 p-2 rounded text-center">
                      <p className="text-gray-500">Ratio</p>
                      <p className="text-white font-bold">
                        {suggestions.compression.ratio}:1
                      </p>
                    </div>
                    <div className="bg-gray-800 p-2 rounded text-center">
                      <p className="text-gray-500">Attack</p>
                      <p className="text-white font-bold">
                        {suggestions.compression.attack * 1000}ms
                      </p>
                    </div>
                    <div className="bg-gray-800 p-2 rounded text-center">
                      <p className="text-gray-500">Release</p>
                      <p className="text-white font-bold">
                        {suggestions.compression.release * 1000}ms
                      </p>
                    </div>
                    <div className="bg-gray-800 p-2 rounded text-center">
                      <p className="text-gray-500">Makeup</p>
                      <p className="text-white font-bold">
                        +{suggestions.compression.makeupGain}dB
                      </p>
                    </div>
                  </div>
                </div>

                {/* Multiband Preset */}
                <div>
                  <h5 className="text-xs font-bold text-gray-400 uppercase mb-2">
                    Recommended Multiband Preset
                  </h5>
                  <span className="inline-block px-3 py-1 bg-indigo-600/30 text-indigo-300 rounded-full text-sm font-medium capitalize">
                    {suggestions.multibandPreset}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Apply Button */}
          <div className="p-4 flex gap-3">
            <button
              onClick={handleApply}
              className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-lg text-white font-bold transition-all"
            >
              Apply Mastering Settings
            </button>
            <button
              onClick={generateSuggestions}
              className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
            >
              Regenerate
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default MasteringAssistant;
