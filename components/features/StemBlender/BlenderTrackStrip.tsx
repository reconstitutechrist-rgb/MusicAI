/**
 * Blender Track Strip Component
 * Individual track channel strip with volume, pan, mute/solo controls
 */

import React, { useRef, useEffect, useState } from "react";
import { BlenderTrack, STEM_LABELS } from "../../../types/stemBlender";
import { useStemBlender } from "./StemBlenderProvider";

interface BlenderTrackStripProps {
  track: BlenderTrack;
  audioLevel?: number; // 0-1 for VU meter
}

const BlenderTrackStrip: React.FC<BlenderTrackStripProps> = ({
  track,
  audioLevel = 0,
}) => {
  const {
    updateTrackVolume,
    updateTrackPan,
    toggleMute,
    toggleSolo,
    setTrackOffset,
    removeTrackFromMixer,
    state,
  } = useStemBlender();

  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [isDraggingPan, setIsDraggingPan] = useState(false);
  const volumeRef = useRef<HTMLDivElement>(null);

  // Check if this track should be audible (solo logic)
  const hasSoloActive = state.tracks.some((t) => t.solo);
  const isAudible = !track.muted && (!hasSoloActive || track.solo);

  // Stem icon
  const getStemIcon = () => {
    switch (track.stem.type) {
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

  // Handle volume drag
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateTrackVolume(track.id, parseFloat(e.target.value));
  };

  // Handle pan change
  const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateTrackPan(track.id, parseFloat(e.target.value));
  };

  // Handle offset change
  const handleOffsetChange = (delta: number) => {
    const newOffset = Math.max(0, track.offset + delta);
    setTrackOffset(track.id, newOffset);
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Pan position label
  const getPanLabel = () => {
    if (track.pan === 0) return "C";
    if (track.pan < 0) return `${Math.abs(Math.round(track.pan * 100))}L`;
    return `${Math.round(track.pan * 100)}R`;
  };

  return (
    <div
      className={`
        bg-gray-800 rounded-lg p-3 border-l-4 transition-opacity
        ${isAudible ? "opacity-100" : "opacity-50"}
      `}
      style={{ borderLeftColor: track.color }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{getStemIcon()}</span>
          <div>
            <p
              className="font-medium text-sm"
              style={{ color: track.color }}
            >
              {STEM_LABELS[track.stem.type]}
            </p>
            <p className="text-xs text-gray-400 truncate max-w-[120px]">
              {track.stem.songTitle}
            </p>
          </div>
        </div>
        <button
          onClick={() => removeTrackFromMixer(track.id)}
          className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors"
          title="Remove track"
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Volume Fader with VU Meter */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>Volume</span>
          <span>{Math.round(track.volume * 100)}%</span>
        </div>
        <div className="relative h-6">
          {/* VU Meter Background */}
          <div className="absolute inset-0 bg-gray-700 rounded overflow-hidden">
            <div
              className="h-full transition-all duration-75"
              style={{
                width: `${audioLevel * 100}%`,
                background: `linear-gradient(90deg, ${track.color}80, ${track.color})`,
              }}
            />
          </div>
          {/* Volume Slider */}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={track.volume}
            onChange={handleVolumeChange}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
          {/* Volume Indicator */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white rounded"
            style={{ left: `${track.volume * 100}%` }}
          />
        </div>
      </div>

      {/* Pan Knob */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>Pan</span>
          <span>{getPanLabel()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">L</span>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={track.pan}
            onChange={handlePanChange}
            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(90deg,
                ${track.pan < 0 ? track.color : "transparent"} 0%,
                transparent 50%,
                ${track.pan > 0 ? track.color : "transparent"} 100%)`,
            }}
          />
          <span className="text-xs text-gray-500">R</span>
        </div>
      </div>

      {/* Mute/Solo Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => toggleMute(track.id)}
          className={`
            flex-1 py-1.5 rounded text-sm font-medium transition-colors
            ${
              track.muted
                ? "bg-red-500 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }
          `}
        >
          M
        </button>
        <button
          onClick={() => toggleSolo(track.id)}
          className={`
            flex-1 py-1.5 rounded text-sm font-medium transition-colors
            ${
              track.solo
                ? "bg-yellow-500 text-black"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }
          `}
        >
          S
        </button>
      </div>

      {/* Time Offset */}
      <div className="border-t border-gray-700 pt-3">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>Offset</span>
          <span>{formatTime(track.offset)}</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => handleOffsetChange(-0.5)}
            disabled={track.offset <= 0}
            className="flex-1 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            -0.5s
          </button>
          <button
            onClick={() => setTrackOffset(track.id, 0)}
            className="flex-1 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Reset
          </button>
          <button
            onClick={() => handleOffsetChange(0.5)}
            className="flex-1 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            +0.5s
          </button>
        </div>
      </div>

      {/* Duration Info */}
      <div className="mt-3 text-xs text-gray-500 text-center">
        Duration: {formatTime(track.stem.duration)}
      </div>
    </div>
  );
};

export default BlenderTrackStrip;
