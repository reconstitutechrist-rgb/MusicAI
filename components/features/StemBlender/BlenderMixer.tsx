/**
 * Blender Mixer Component
 * Main mixing interface for stem blending
 */

import React, { useCallback, useRef, useState } from "react";
import { useStemBlender } from "./StemBlenderProvider";
import BlenderTrackStrip from "./BlenderTrackStrip";
import { StemTrack } from "../../../types/stemBlender";
import Button from "../../ui/Button";
import { audioBufferToWav } from "../../../utils/audioBufferToWav";

interface BlenderMixerProps {
  onExport?: (blob: Blob, filename: string) => void;
}

const BlenderMixer: React.FC<BlenderMixerProps> = ({ onExport }) => {
  const { state, addStemToMixer, setMasterVolume, clearAllTracks, dispatch } =
    useStemBlender();
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      try {
        const data = JSON.parse(
          e.dataTransfer.getData("application/json")
        ) as { stem: StemTrack; bpm: number; key?: string };
        addStemToMixer(data.stem, data.bpm, data.key || "C major");
      } catch (err) {
        console.error("Failed to parse drop data:", err);
      }
    },
    [addStemToMixer]
  );

  // Playback controls
  const handlePlay = () => {
    dispatch({ type: "SET_PLAYING", payload: true });
  };

  const handlePause = () => {
    dispatch({ type: "SET_PLAYING", payload: false });
  };

  const handleStop = () => {
    dispatch({ type: "SET_PLAYING", payload: false });
    dispatch({ type: "SET_CURRENT_TIME", payload: 0 });
  };

  // Export mix
  const handleExport = async () => {
    if (state.tracks.length === 0) return;
    if (state.duration <= 0) {
      console.error("Cannot export: no audio duration");
      return;
    }

    setIsExporting(true);
    try {
      // Create offline audio context
      const sampleRate = 44100;
      const duration = state.duration;
      const offlineCtx = new OfflineAudioContext(
        2,
        Math.ceil(duration * sampleRate),
        sampleRate
      );

      // Check for solo
      const hasSolo = state.tracks.some((t) => t.solo);

      // Load and connect all tracks
      for (const track of state.tracks) {
        // Skip muted tracks or non-solo tracks when solo is active
        if (track.muted) continue;
        if (hasSolo && !track.solo) continue;

        // Get audio buffer (either pre-loaded or fetch it)
        let audioBuffer = track.stem.audioBuffer;
        if (!audioBuffer) {
          // Fetch audio buffer if not loaded
          const response = await fetch(track.stem.audioUrl);
          const arrayBuffer = await response.arrayBuffer();
          audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
        }

        // Create source
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;

        // Create gain and pan nodes
        const gain = offlineCtx.createGain();
        gain.gain.value = track.volume * state.masterVolume;

        const pan = offlineCtx.createStereoPanner();
        pan.pan.value = track.pan;

        // Connect nodes
        source.connect(gain);
        gain.connect(pan);
        pan.connect(offlineCtx.destination);

        // Start with offset
        source.start(track.offset);
      }

      // Render
      const renderedBuffer = await offlineCtx.startRendering();

      // Convert to WAV blob
      const wavBlob = audioBufferToWav(renderedBuffer);

      // Generate filename
      const filename = `stem_blend_${new Date().toISOString().slice(0, 10)}.wav`;

      if (onExport) {
        onExport(wavBlob, filename);
      } else {
        // Download directly
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header / Transport */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Mixer</h3>
          <span className="text-sm text-gray-400">
            {state.tracks.length} tracks
          </span>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleStop}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
            title="Stop"
          >
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <rect x="6" y="6" width="12" height="12" />
            </svg>
          </button>
          {state.isPlaying ? (
            <button
              onClick={handlePause}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
              title="Pause"
            >
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handlePlay}
              className="p-2 bg-green-500 hover:bg-green-600 rounded"
              title="Play"
            >
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </button>
          )}
        </div>

        {/* Time Display */}
        <div className="text-sm font-mono">
          {formatTime(state.currentTime)} / {formatTime(state.duration)}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={clearAllTracks}
            disabled={state.tracks.length === 0}
          >
            Clear All
          </Button>
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={state.tracks.length === 0 || isExporting}
          >
            {isExporting ? "Exporting..." : "Export Mix"}
          </Button>
        </div>
      </div>

      {/* Master Volume */}
      <div className="px-4 py-2 bg-gray-900/50 flex items-center gap-4 border-b border-gray-700">
        <span className="text-sm text-gray-400">Master</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={state.masterVolume}
          onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
          className="flex-1 max-w-xs h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
        <span className="text-sm text-gray-400 w-12">
          {Math.round(state.masterVolume * 100)}%
        </span>

        {/* BPM Analysis */}
        {state.bpmAnalysis && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">Avg BPM:</span>
            <span className="font-medium">
              {state.bpmAnalysis.averageBpm.toFixed(0)}
            </span>
            {!state.bpmAnalysis.isCompatible && (
              <span className="text-yellow-400 text-xs">
                (BPM mismatch: {state.bpmAnalysis.maxDifference.toFixed(0)})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tracks Grid */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          flex-1 overflow-auto p-4 transition-colors
          ${isDragOver ? "bg-purple-500/10" : ""}
        `}
      >
        {state.tracks.length === 0 ? (
          <div
            className={`
              h-full min-h-[200px] border-2 border-dashed rounded-lg
              flex flex-col items-center justify-center
              transition-colors
              ${isDragOver ? "border-purple-500 bg-purple-500/5" : "border-gray-600"}
            `}
          >
            <div className="text-4xl mb-3">🎚️</div>
            <p className="text-gray-400">Drag stems here to start mixing</p>
            <p className="text-sm text-gray-500 mt-2">
              Add stems from the library on the left
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {state.tracks.map((track) => (
              <BlenderTrackStrip key={track.id} track={track} />
            ))}

            {/* Add Track Placeholder */}
            <div
              className={`
                min-h-[300px] border-2 border-dashed rounded-lg
                flex flex-col items-center justify-center
                transition-colors cursor-pointer
                ${isDragOver ? "border-purple-500 bg-purple-500/5" : "border-gray-700 hover:border-gray-600"}
              `}
            >
              <div className="text-2xl mb-2">➕</div>
              <p className="text-sm text-gray-500">Add stem</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlenderMixer;
