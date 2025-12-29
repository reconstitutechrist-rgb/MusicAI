import React, { useCallback } from "react";
import { useTimeline } from "../TimelineEditorContext";
import { useTheme } from "../../../../context/AppContext";

interface TransportControlsProps {
  className?: string;
}

/**
 * TransportControls - Play/Pause/Stop and seek controls
 * Also includes zoom controls and current time display
 */
export function TransportControls({ className = "" }: TransportControlsProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { state, actions } = useTimeline();
  const { currentTime, duration, isPlaying, zoom } = state;

  // Format time display
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  }, []);

  // Handle play/pause toggle
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      actions.pause();
    } else {
      actions.play();
    }
  }, [isPlaying, actions]);

  // Handle zoom
  const handleZoomIn = useCallback(() => {
    actions.setZoom(Math.min(zoom * 1.5, 16));
  }, [zoom, actions]);

  const handleZoomOut = useCallback(() => {
    actions.setZoom(Math.max(zoom / 1.5, 0.1));
  }, [zoom, actions]);

  const handleZoomFit = useCallback(() => {
    // Calculate zoom to fit entire duration in viewport
    const viewportWidth = state.viewportWidth || 800;
    if (duration > 0) {
      const fitZoom = viewportWidth / (duration * 100);
      actions.setZoom(Math.max(0.1, Math.min(fitZoom, 16)));
    }
  }, [state.viewportWidth, duration, actions]);

  // Handle skip forward/backward
  const handleSkipBackward = useCallback(() => {
    actions.seek(Math.max(0, currentTime - 5));
  }, [currentTime, actions]);

  const handleSkipForward = useCallback(() => {
    actions.seek(Math.min(duration, currentTime + 5));
  }, [currentTime, duration, actions]);

  return (
    <div
      className={`flex items-center gap-4 px-4 py-2 border-b ${isDark ? 'bg-gray-900/80 border-white/10' : 'bg-gray-100 border-gray-200'} ${className}`}
    >
      {/* Playback controls */}
      <div className="flex items-center gap-2">
        {/* Stop */}
        <button
          onClick={actions.stop}
          className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-white/80 hover:text-white' : 'hover:bg-gray-200 text-gray-600 hover:text-gray-900'}`}
          aria-label="Stop"
          title="Stop (and return to start)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </button>

        {/* Skip backward */}
        <button
          onClick={handleSkipBackward}
          className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-white/80 hover:text-white' : 'hover:bg-gray-200 text-gray-600 hover:text-gray-900'}`}
          aria-label="Skip backward 5 seconds"
          title="Skip backward 5 seconds"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
          </svg>
        </button>

        {/* Play/Pause */}
        <button
          onClick={handlePlayPause}
          className={`p-3 rounded-full transition-colors ${
            isPlaying
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-indigo-500 hover:bg-indigo-600 text-white"
          }`}
          aria-label={isPlaying ? "Pause" : "Play"}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Skip forward */}
        <button
          onClick={handleSkipForward}
          className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-white/80 hover:text-white' : 'hover:bg-gray-200 text-gray-600 hover:text-gray-900'}`}
          aria-label="Skip forward 5 seconds"
          title="Skip forward 5 seconds"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
          </svg>
        </button>
      </div>

      {/* Time display */}
      <div className="flex items-center gap-2 font-mono text-sm">
        <span className={isDark ? 'text-white' : 'text-gray-900'}>{formatTime(currentTime)}</span>
        <span className={isDark ? 'text-white/40' : 'text-gray-400'}>/</span>
        <span className={isDark ? 'text-white/60' : 'text-gray-600'}>{formatTime(duration)}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleZoomOut}
          className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-white/10 text-white/60 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-900'}`}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
            <path d="M8 11h6" />
          </svg>
        </button>

        <span className={`text-sm min-w-[4rem] text-center ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
          {(zoom * 100).toFixed(0)}%
        </span>

        <button
          onClick={handleZoomIn}
          className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-white/10 text-white/60 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-900'}`}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
            <path d="M11 8v6M8 11h6" />
          </svg>
        </button>

        <button
          onClick={handleZoomFit}
          className={`px-2 py-1 rounded transition-colors text-sm ${isDark ? 'hover:bg-white/10 text-white/60 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-900'}`}
          aria-label="Fit to view"
          title="Fit to view"
        >
          Fit
        </button>
      </div>

      {/* Rendering progress (if any) */}
      {state.isRendering && (
        <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/20 rounded-lg">
          <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          <span className="text-purple-400 text-sm">
            Rendering {state.renderProgress}%
          </span>
        </div>
      )}
    </div>
  );
}

export default TransportControls;
