/**
 * Stem Library Component
 * Displays separated songs and their stems for drag-and-drop to the mixer
 */

import React, { useState } from "react";
import {
  SeparatedSong,
  StemType,
  STEM_COLORS,
  STEM_LABELS,
} from "../../../types/stemBlender";
import { useStemBlender } from "./StemBlenderProvider";

interface StemLibraryProps {
  className?: string;
}

const StemLibrary: React.FC<StemLibraryProps> = ({ className = "" }) => {
  const { state, addStemToMixer, removeSeparatedSong } = useStemBlender();
  const [expandedSongs, setExpandedSongs] = useState<Set<string>>(new Set());

  const toggleExpanded = (songId: string) => {
    setExpandedSongs((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) {
        next.delete(songId);
      } else {
        next.add(songId);
      }
      return next;
    });
  };

  const handleDragStart = (
    e: React.DragEvent,
    song: SeparatedSong,
    stemType: StemType
  ) => {
    const stem = song.stems[stemType];
    if (!stem) return;

    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        stem,
        bpm: song.analysis?.bpm || 120,
        key: song.analysis?.key || "C major",
      })
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleAddToMixer = (song: SeparatedSong, stemType: StemType) => {
    const stem = song.stems[stemType];
    if (!stem) return;
    addStemToMixer(stem, song.analysis?.bpm || 120, song.analysis?.key || "C major");
  };

  // Stem icon based on type
  const getStemIcon = (type: StemType) => {
    switch (type) {
      case "vocals":
        return "🎤";
      case "drums":
        return "🥁";
      case "bass":
        return "🎸";
      case "other":
        return "🎹";
    }
  };

  if (state.separatedSongs.length === 0) {
    return (
      <div className={`p-4 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Stem Library</h3>
        <div className="text-center py-8 text-gray-400">
          <div className="text-4xl mb-3">📚</div>
          <p>No separated songs yet</p>
          <p className="text-sm mt-2">
            Use the Stem Separator to separate songs, then they'll appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 ${className}`}>
      <h3 className="text-lg font-semibold mb-4">
        Stem Library ({state.separatedSongs.length})
      </h3>

      <div className="space-y-3">
        {state.separatedSongs.map((song) => {
          const isExpanded = expandedSongs.has(song.id);
          const availableStems = (
            Object.entries(song.stems) as [StemType, unknown][]
          ).filter(([, stem]) => stem !== null);

          return (
            <div
              key={song.id}
              className="bg-gray-800 rounded-lg overflow-hidden"
            >
              {/* Song Header */}
              <button
                onClick={() => toggleExpanded(song.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎵</span>
                  <div className="text-left">
                    <p className="font-medium truncate max-w-[200px]">
                      {song.originalTitle}
                    </p>
                    <p className="text-xs text-gray-400">
                      {availableStems.length} stems
                      {song.analysis && (
                        <span className="ml-2">
                          • {song.analysis.bpm} BPM • {song.analysis.key}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSeparatedSong(song.id);
                    }}
                    className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors"
                    title="Remove from library"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                  <svg
                    className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
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
                </div>
              </button>

              {/* Stems Grid */}
              {isExpanded && (
                <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                  {(["vocals", "drums", "bass", "other"] as StemType[]).map(
                    (stemType) => {
                      const stem = song.stems[stemType];
                      const isAvailable = stem !== null;

                      return (
                        <div
                          key={stemType}
                          draggable={isAvailable}
                          onDragStart={(e) =>
                            isAvailable && handleDragStart(e, song, stemType)
                          }
                          className={`
                            relative p-3 rounded-lg border-2 transition-all
                            ${
                              isAvailable
                                ? "cursor-grab active:cursor-grabbing border-transparent hover:border-white/20"
                                : "cursor-not-allowed opacity-40 border-transparent"
                            }
                          `}
                          style={{
                            backgroundColor: isAvailable
                              ? `${STEM_COLORS[stemType]}20`
                              : "transparent",
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">
                              {getStemIcon(stemType)}
                            </span>
                            <span
                              className="font-medium text-sm"
                              style={{
                                color: isAvailable
                                  ? STEM_COLORS[stemType]
                                  : "inherit",
                              }}
                            >
                              {STEM_LABELS[stemType]}
                            </span>
                          </div>

                          {isAvailable ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAddToMixer(song, stemType)}
                                className="flex-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs transition-colors"
                              >
                                Add to Mixer
                              </button>
                              <a
                                href={stem!.audioUrl}
                                download={`${song.originalTitle}_${stemType}.mp3`}
                                className="p-1 bg-white/10 hover:bg-white/20 rounded transition-colors"
                                title="Download"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                  />
                                </svg>
                              </a>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">
                              Not available
                            </p>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center">
        Drag stems to the mixer or click "Add to Mixer"
      </p>
    </div>
  );
};

export default StemLibrary;
