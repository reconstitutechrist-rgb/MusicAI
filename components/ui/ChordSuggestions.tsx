import React, { useState, useMemo } from "react";
import { AudioAnalysisResult } from "../../types";

interface ChordSuggestionsProps {
  audioAnalysis: AudioAnalysisResult | null;
  onChordSelect?: (chord: string) => void;
}

// Music theory data for chord suggestions
const CHORD_QUALITIES = [
  "",
  "m",
  "7",
  "maj7",
  "m7",
  "dim",
  "aug",
  "sus4",
  "sus2",
  "add9",
];

const SCALE_DEGREES: Record<string, string[]> = {
  major: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
  minor: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
  dorian: ["i", "ii", "III", "IV", "v", "vi°", "VII"],
  mixolydian: ["I", "ii", "iii°", "IV", "v", "vi", "VII"],
};

// Note names in order
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NOTES = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

// Interval patterns for scales
const SCALE_INTERVALS: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
};

// Common chord progressions by genre
const GENRE_PROGRESSIONS: Record<string, string[][]> = {
  pop: [
    ["I", "V", "vi", "IV"],
    ["I", "IV", "V", "IV"],
    ["vi", "IV", "I", "V"],
    ["I", "vi", "IV", "V"],
  ],
  rock: [
    ["I", "IV", "V", "I"],
    ["I", "bVII", "IV", "I"],
    ["I", "V", "IV", "I"],
    ["i", "bVI", "bVII", "i"],
  ],
  jazz: [
    ["ii", "V", "I", "I"],
    ["I", "vi", "ii", "V"],
    ["iii", "vi", "ii", "V"],
    ["I", "IV", "iii", "vi"],
  ],
  "hip-hop": [
    ["i", "VI", "III", "VII"],
    ["i", "iv", "VII", "III"],
    ["vi", "IV", "I", "V"],
    ["i", "i", "iv", "VII"],
  ],
  electronic: [
    ["i", "VI", "III", "VII"],
    ["i", "iv", "v", "i"],
    ["I", "I", "IV", "IV"],
    ["vi", "IV", "vi", "V"],
  ],
  "r&b": [
    ["I", "V/vi", "vi", "IV"],
    ["ii", "V", "I", "vi"],
    ["I", "iii", "vi", "IV"],
    ["IVmaj7", "V", "iii", "vi"],
  ],
  default: [
    ["I", "V", "vi", "IV"],
    ["I", "IV", "V", "I"],
    ["ii", "V", "I", "I"],
    ["vi", "IV", "I", "V"],
  ],
};

// Related keys (circle of fifths and relative major/minor)
const getRelatedKeys = (
  key: string,
): { key: string; relationship: string }[] => {
  const isMinor =
    key.toLowerCase().includes("m") || key.toLowerCase().includes("minor");
  const rootMatch = key.match(/^[A-Ga-g][#b]?/);
  if (!rootMatch) return [];

  let root = rootMatch[0].toUpperCase();
  if (root.length === 2 && root[1] === "B") {
    root = root[0] + "b";
  }

  const useFlats =
    key.includes("b") || ["F", "Bb", "Eb", "Ab", "Db"].includes(root);
  const noteArray = useFlats ? FLAT_NOTES : NOTES;
  const rootIndex = noteArray.findIndex((n) => n === root);
  if (rootIndex === -1) return [];

  const related: { key: string; relationship: string }[] = [];

  if (isMinor) {
    // Relative major (3 semitones up)
    related.push({
      key: noteArray[(rootIndex + 3) % 12] + " Major",
      relationship: "Relative Major",
    });
    // Parallel major
    related.push({ key: root + " Major", relationship: "Parallel Major" });
    // Dominant (5 semitones up)
    related.push({
      key: noteArray[(rootIndex + 7) % 12] + " minor",
      relationship: "Dominant",
    });
    // Subdominant (5 semitones down)
    related.push({
      key: noteArray[(rootIndex + 5) % 12] + " minor",
      relationship: "Subdominant",
    });
  } else {
    // Relative minor (3 semitones down)
    related.push({
      key: noteArray[(rootIndex + 9) % 12] + " minor",
      relationship: "Relative Minor",
    });
    // Parallel minor
    related.push({ key: root + " minor", relationship: "Parallel Minor" });
    // Dominant key (5 semitones up)
    related.push({
      key: noteArray[(rootIndex + 7) % 12] + " Major",
      relationship: "Dominant Key",
    });
    // Subdominant key (5 semitones down)
    related.push({
      key: noteArray[(rootIndex + 5) % 12] + " Major",
      relationship: "Subdominant Key",
    });
  }

  return related;
};

// Get scale notes from key
const getScaleNotes = (key: string): string[] => {
  const isMinor =
    key.toLowerCase().includes("m") || key.toLowerCase().includes("minor");
  const rootMatch = key.match(/^[A-Ga-g][#b]?/);
  if (!rootMatch) return [];

  let root = rootMatch[0].toUpperCase();
  if (root.length === 2 && root[1] === "B") {
    root = root[0] + "b";
  }

  const useFlats =
    key.includes("b") || ["F", "Bb", "Eb", "Ab", "Db"].includes(root);
  const noteArray = useFlats ? FLAT_NOTES : NOTES;
  const rootIndex = noteArray.findIndex((n) => n === root);
  if (rootIndex === -1) return [];

  const intervals = isMinor
    ? SCALE_INTERVALS["minor"]
    : SCALE_INTERVALS["major"];
  return intervals.map((interval) => noteArray[(rootIndex + interval) % 12]);
};

// Convert roman numeral to chord in key
const romanToChord = (roman: string, key: string): string => {
  const scaleNotes = getScaleNotes(key);
  if (scaleNotes.length === 0) return roman;

  const isMinor =
    key.toLowerCase().includes("m") || key.toLowerCase().includes("minor");
  const degrees = isMinor ? SCALE_DEGREES["minor"] : SCALE_DEGREES["major"];

  // Handle special cases like bVII, V/vi
  if (roman.includes("/")) return roman; // Secondary dominants - keep as is for display

  // Find degree index
  const cleanRoman = roman.replace(/[°+]/, "").replace(/maj7|7|m7|m/, "");
  let degreeIndex = -1;

  if (roman.startsWith("b")) {
    // Borrowed chord (e.g., bVII)
    const degree = roman.slice(1).replace(/[°+]/, "").toLowerCase();
    const degreeMap: Record<string, number> = {
      i: 0,
      ii: 1,
      iii: 2,
      iv: 3,
      v: 4,
      vi: 5,
      vii: 6,
    };
    degreeIndex = degreeMap[degree];
    if (degreeIndex !== undefined && degreeIndex >= 0) {
      // Flatten the note
      const useFlats =
        key.includes("b") ||
        ["F", "Bb", "Eb", "Ab", "Db"].includes(scaleNotes[0]);
      const noteArray = useFlats ? FLAT_NOTES : NOTES;
      const originalIndex = noteArray.indexOf(scaleNotes[degreeIndex]);
      const flattenedNote = noteArray[(originalIndex - 1 + 12) % 12];
      return flattenedNote + (roman.includes("7") ? "7" : "");
    }
  }

  const romanLower = cleanRoman.toLowerCase();
  for (let i = 0; i < degrees.length; i++) {
    if (degrees[i].toLowerCase().replace("°", "") === romanLower) {
      degreeIndex = i;
      break;
    }
  }

  if (degreeIndex === -1 || degreeIndex >= scaleNotes.length) return roman;

  let chord = scaleNotes[degreeIndex];

  // Add quality based on case and symbols
  if (roman === roman.toLowerCase() && !roman.includes("maj")) {
    chord += "m";
  }
  if (roman.includes("°")) chord += "dim";
  if (roman.includes("+")) chord += "aug";
  if (roman.includes("maj7")) chord += "maj7";
  else if (roman.includes("7")) chord += "7";
  else if (roman.includes("m7")) chord += "m7";

  return chord;
};

const ChordSuggestions: React.FC<ChordSuggestionsProps> = ({
  audioAnalysis,
  onChordSelect,
}) => {
  const [activeTab, setActiveTab] = useState<
    "progressions" | "alternatives" | "keys"
  >("progressions");
  const [selectedProgression, setSelectedProgression] = useState<number | null>(
    null,
  );

  // Get suggestions based on detected genre
  const progressionSuggestions = useMemo(() => {
    if (!audioAnalysis) return GENRE_PROGRESSIONS["default"];

    const genreLower = audioAnalysis.genre.toLowerCase();
    for (const [genre, progs] of Object.entries(GENRE_PROGRESSIONS)) {
      if (
        genreLower.includes(genre) ||
        genre.includes(genreLower.split(" ")[0])
      ) {
        return progs;
      }
    }
    return GENRE_PROGRESSIONS["default"];
  }, [audioAnalysis]);

  const relatedKeys = useMemo(() => {
    if (!audioAnalysis) return [];
    return getRelatedKeys(audioAnalysis.key);
  }, [audioAnalysis]);

  const scaleNotes = useMemo(() => {
    if (!audioAnalysis) return [];
    return getScaleNotes(audioAnalysis.key);
  }, [audioAnalysis]);

  // Generate alternative chords for detected progression
  const alternativeChords = useMemo(() => {
    if (!audioAnalysis || !audioAnalysis.chords.length) return [];

    return audioAnalysis.chords.map((chord) => {
      const rootMatch = chord.match(/^[A-Ga-g][#b]?/);
      if (!rootMatch) return { original: chord, alternatives: [] };

      const root = rootMatch[0];
      const quality = chord.slice(root.length);

      // Generate alternatives
      const alternatives: string[] = [];

      // Same root, different qualities
      CHORD_QUALITIES.filter((q) => q !== quality)
        .slice(0, 4)
        .forEach((q) => {
          alternatives.push(root + q);
        });

      return { original: chord, alternatives };
    });
  }, [audioAnalysis]);

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
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          <p className="font-medium">Chord & Key Analysis</p>
          <p className="text-sm mt-1">
            Analyze audio to get harmonic suggestions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-blue-900/30 to-cyan-900/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600/30 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-white">
              Chord & Harmony Suggestions
            </h3>
            <p className="text-sm text-gray-400">
              Key:{" "}
              <span className="text-blue-300 font-medium">
                {audioAnalysis.key}
              </span>{" "}
              | Chords:{" "}
              <span className="text-cyan-300">
                {audioAnalysis.chords.join(" - ")}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Scale Notes Display */}
      <div className="p-3 border-b border-gray-700 bg-gray-900/30">
        <p className="text-xs text-gray-500 uppercase mb-2">Scale Notes</p>
        <div className="flex gap-2 flex-wrap">
          {scaleNotes.map((note, i) => (
            <span
              key={i}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                i === 0 ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"
              }`}
            >
              {note}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {[
          { id: "progressions", label: "Progressions" },
          { id: "alternatives", label: "Alternatives" },
          { id: "keys", label: "Related Keys" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-gray-700/50 text-white border-b-2 border-blue-500"
                : "text-gray-400 hover:text-white hover:bg-gray-700/30"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === "progressions" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Suggested progressions for {audioAnalysis.genre}:
            </p>
            {progressionSuggestions.map((prog, i) => (
              <div
                key={i}
                onClick={() =>
                  setSelectedProgression(selectedProgression === i ? null : i)
                }
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  selectedProgression === i
                    ? "bg-blue-600/30 border border-blue-500"
                    : "bg-gray-700/50 hover:bg-gray-700 border border-transparent"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex gap-2">
                    {prog.map((numeral, j) => (
                      <span key={j} className="text-lg font-bold text-white">
                        {numeral}
                      </span>
                    ))}
                  </div>
                  {selectedProgression === i && (
                    <span className="text-xs text-blue-400">
                      Click chord to copy
                    </span>
                  )}
                </div>
                {selectedProgression === i && (
                  <div className="flex gap-2 mt-2 pt-2 border-t border-gray-600">
                    {prog.map((numeral, j) => (
                      <button
                        key={j}
                        onClick={(e) => {
                          e.stopPropagation();
                          const chord = romanToChord(
                            numeral,
                            audioAnalysis.key,
                          );
                          onChordSelect?.(chord);
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium text-white transition-colors"
                      >
                        {romanToChord(numeral, audioAnalysis.key)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "alternatives" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Alternative chords for your progression:
            </p>
            {alternativeChords.map((item, i) => (
              <div key={i} className="p-3 bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-lg font-bold text-cyan-400">
                    {item.original}
                  </span>
                  <span className="text-gray-500">→</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {item.alternatives.map((alt, j) => (
                    <button
                      key={j}
                      onClick={() => onChordSelect?.(alt)}
                      className="px-3 py-1 bg-gray-600 hover:bg-cyan-600 rounded text-sm text-gray-200 hover:text-white transition-colors"
                    >
                      {alt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "keys" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Modulation suggestions from {audioAnalysis.key}:
            </p>
            {relatedKeys.map((item, i) => (
              <div
                key={i}
                className="p-3 bg-gray-700/50 rounded-lg flex items-center justify-between"
              >
                <div>
                  <span className="text-lg font-bold text-white">
                    {item.key}
                  </span>
                  <span className="ml-3 text-sm text-gray-400">
                    {item.relationship}
                  </span>
                </div>
                <button
                  onClick={() => onChordSelect?.(item.key.split(" ")[0])}
                  className="px-3 py-1 bg-gray-600 hover:bg-indigo-600 rounded text-sm text-gray-200 hover:text-white transition-colors"
                >
                  Try it
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChordSuggestions;
