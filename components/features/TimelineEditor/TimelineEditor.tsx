import React, { useRef, useEffect, useState, useCallback } from "react";
import { TimelineEditorProvider, useTimeline } from "./TimelineEditorContext";
import { TimelineRuler } from "./components/TimelineRuler";
import { TimelineTrack } from "./components/TimelineTrack";
import { TransportControls } from "./components/TransportControls";
import { ControlModeSelector } from "./components/ControlModeSelector";
import { SongLibraryPanel } from "./components/SongLibraryPanel";
import { LibrarySong } from "../../../types/timeline";

interface TimelineEditorProps {
  songs: LibrarySong[];
  audioContext: AudioContext | null;
  onClose?: () => void;
  onExport?: (audioBlob: Blob, audioUrl: string) => void;
  onUploadSong?: (file: File) => Promise<LibrarySong>;
}

/**
 * TimelineEditorInner - Main timeline editor UI
 * Wrapped by provider in TimelineEditor
 */
function TimelineEditorInner({
  songs,
  onClose,
  onExport,
  onUploadSong,
}: Omit<TimelineEditorProps, "audioContext">) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const { state, actions } = useTimeline();
  const [timelineWidth, setTimelineWidth] = useState(800);
  const [showAutoMergeModal, setShowAutoMergeModal] = useState(false);
  const [autoMergeDescription, setAutoMergeDescription] = useState("");

  // Track viewport width
  useEffect(() => {
    const updateWidth = () => {
      if (timelineRef.current) {
        setTimelineWidth(timelineRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Handle wheel for horizontal scroll and zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Zoom with Ctrl+wheel
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        actions.setZoom(state.zoom * delta);
      } else if (e.shiftKey) {
        // Horizontal scroll with Shift+wheel
        e.preventDefault();
        actions.setScroll(state.scrollPosition + e.deltaY);
      }
    },
    [state.zoom, state.scrollPosition, actions],
  );

  // Handle auto merge
  const handleAutoMerge = useCallback(async () => {
    if (!autoMergeDescription.trim()) return;
    await actions.autoMerge(autoMergeDescription);
    setShowAutoMergeModal(false);
    setAutoMergeDescription("");
  }, [autoMergeDescription, actions]);

  // Handle export
  const handleExport = useCallback(async () => {
    const blob = await actions.renderMergedAudio();
    if (onExport && blob.size > 0) {
      const url = URL.createObjectURL(blob);
      onExport(blob, url);
    }
  }, [actions, onExport]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focused on input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (state.isPlaying) actions.pause();
          else actions.play();
          break;
        case "Home":
          e.preventDefault();
          actions.seek(0);
          break;
        case "End":
          e.preventDefault();
          actions.seek(state.duration);
          break;
        case "ArrowLeft":
          e.preventDefault();
          actions.seek(Math.max(0, state.currentTime - (e.shiftKey ? 5 : 1)));
          break;
        case "ArrowRight":
          e.preventDefault();
          actions.seek(
            Math.min(state.duration, state.currentTime + (e.shiftKey ? 5 : 1)),
          );
          break;
        case "Delete":
        case "Backspace":
          if (state.selectedClipId) {
            e.preventDefault();
            actions.removeClip(state.selectedClipId);
          }
          break;
        case "Escape":
          actions.selectClip(null);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state, actions]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-gray-950 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-white/10">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">Song Merger</h2>
          <ControlModeSelector />
        </div>

        <div className="flex items-center gap-2">
          {/* Auto Merge button (for automated mode) */}
          {state.controlMode === "automated" && (
            <button
              onClick={() => setShowAutoMergeModal(true)}
              disabled={state.clips.length < 2 || state.isAnalyzing}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg text-white text-sm font-medium hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span>✨</span>
              <span>Auto Merge</span>
            </button>
          )}

          {/* Get Suggestions button (for ai-suggests mode) */}
          {state.controlMode === "ai-suggests" && state.clips.length >= 2 && (
            <button
              onClick={actions.analyzeAndSuggest}
              disabled={state.isAnalyzing}
              className="px-4 py-2 bg-indigo-500/20 border border-indigo-500/50 rounded-lg text-indigo-400 text-sm font-medium hover:bg-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {state.isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <span>💡</span>
                  <span>Get Suggestions</span>
                </>
              )}
            </button>
          )}

          {/* Export button */}
          {state.clips.length > 0 && (
            <button
              onClick={handleExport}
              disabled={state.isRendering}
              className="px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm font-medium hover:bg-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {state.isRendering ? (
                <>
                  <div className="w-4 h-4 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
                  <span>{state.renderProgress}%</span>
                </>
              ) : (
                <>
                  <span>↓</span>
                  <span>Export</span>
                </>
              )}
            </button>
          )}

          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Song library sidebar */}
        <SongLibraryPanel
          songs={songs}
          onUploadSong={onUploadSong}
          className="w-64 flex-shrink-0"
        />

        {/* Timeline area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Transport controls */}
          <TransportControls />

          {/* Timeline ruler and track */}
          <div
            ref={timelineRef}
            className="flex-1 overflow-hidden"
            onWheel={handleWheel}
          >
            <TimelineRuler width={timelineWidth} />
            <TimelineTrack width={timelineWidth} height={120} />
          </div>

          {/* Suggestions panel (if any) */}
          {state.suggestions.length > 0 && (
            <div className="p-3 bg-gray-900/80 border-t border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-yellow-400">💡</span>
                <span className="text-sm font-medium text-white">
                  AI Suggestions
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {state.suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg text-sm"
                  >
                    <span className="text-white/80">
                      {suggestion.description}
                    </span>
                    <button
                      onClick={() => actions.applySuggestion(suggestion.id)}
                      className="text-green-400 hover:text-green-300"
                      title="Apply"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => actions.dismissSuggestion(suggestion.id)}
                      className="text-red-400 hover:text-red-300"
                      title="Dismiss"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Auto Merge Modal */}
      {showAutoMergeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-semibold text-white mb-4">
              Auto Merge Songs
            </h3>
            <p className="text-white/60 text-sm mb-4">
              Describe how you want the songs merged. The AI will analyze the
              songs and create an optimal arrangement with smooth transitions.
            </p>
            <textarea
              value={autoMergeDescription}
              onChange={(e) => setAutoMergeDescription(e.target.value)}
              placeholder="e.g., Create an energetic party mix that builds up gradually, with smooth transitions between songs..."
              className="w-full h-32 bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowAutoMergeModal(false)}
                className="px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAutoMerge}
                disabled={!autoMergeDescription.trim() || state.isAnalyzing}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg text-white font-medium hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state.isAnalyzing ? "Processing..." : "Create Merge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * TimelineEditor - Main export with provider wrapper
 */
export function TimelineEditor(props: TimelineEditorProps) {
  return (
    <TimelineEditorProvider audioContext={props.audioContext}>
      <TimelineEditorInner {...props} />
    </TimelineEditorProvider>
  );
}

export default TimelineEditor;
