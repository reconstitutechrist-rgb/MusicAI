import React, { useRef, useCallback, useState, useEffect } from "react";
import { useTimeline } from "../TimelineEditorContext";
import { TimelineClip } from "./TimelineClip";
import { CrossfadeZone } from "./CrossfadeZone";
import { useTheme } from "../../../../context/AppContext";

interface TimelineTrackProps {
  width: number;
  height?: number;
}

/**
 * TimelineTrack - Container for clips with drag-drop support
 * Renders all clips and crossfade zones
 */
export function TimelineTrack({ width, height = 100 }: TimelineTrackProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, actions } = useTimeline();
  const { clips, crossfades, zoom, scrollPosition, currentTime, isPlaying } =
    state;

  const [dragState, setDragState] = useState<{
    clipId: string;
    offsetX: number;
    startX: number;
    originalStartTime: number;
  } | null>(null);

  const pixelsPerSecond = 100 * zoom;

  // Handle drag start
  const handleDragStart = useCallback(
    (clipId: string, offsetX: number) => {
      const clip = clips.find((c) => c.id === clipId);
      if (!clip) return;

      setDragState({
        clipId,
        offsetX,
        startX: clip.startTime * pixelsPerSecond,
        originalStartTime: clip.startTime,
      });
    },
    [clips, pixelsPerSecond],
  );

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDragState(null);
  }, []);

  // Handle mouse move for dragging
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left + scrollPosition;
      const newStartTime = (mouseX - dragState.offsetX) / pixelsPerSecond;

      // Snap to grid if close (every 0.5 seconds)
      const snapThreshold = 0.1; // seconds
      const snappedTime = Math.round(newStartTime / 0.5) * 0.5;
      const finalTime =
        Math.abs(newStartTime - snappedTime) < snapThreshold
          ? snappedTime
          : newStartTime;

      actions.moveClip(dragState.clipId, Math.max(0, finalTime));
    },
    [dragState, scrollPosition, pixelsPerSecond, actions],
  );

  // Draw playhead
  const playheadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playheadRef.current) return;

    const playheadX = currentTime * pixelsPerSecond - scrollPosition;
    playheadRef.current.style.left = `${playheadX}px`;
    playheadRef.current.style.display =
      playheadX >= 0 && playheadX <= width ? "block" : "none";
  }, [currentTime, pixelsPerSecond, scrollPosition, width]);

  // Animate playhead during playback
  // Note: currentTime is captured via ref to avoid infinite loop
  const playTimeRef = useRef(currentTime);
  playTimeRef.current = currentTime;

  useEffect(() => {
    if (!isPlaying) return;

    let animationId: number;
    const startTime = performance.now();
    const startPlayTime = playTimeRef.current;

    const animate = (timestamp: number) => {
      const elapsed = (timestamp - startTime) / 1000;
      const newTime = startPlayTime + elapsed;

      if (newTime <= state.duration) {
        // Use setCurrentTime instead of seek to avoid restarting audio on every frame
        actions.setCurrentTime(newTime);
        animationId = requestAnimationFrame(animate);
      } else {
        actions.stop();
      }
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, state.duration, actions]);

  // Calculate total timeline width
  const totalWidth = Math.max(width, state.duration * pixelsPerSecond + 200);

  return (
    <div
      ref={containerRef}
      className={`relative border-y ${isDark ? 'bg-gray-900/50 border-white/10' : 'bg-gray-100 border-gray-200'}`}
      style={{ height: `${height}px`, width: `${width}px`, overflow: "hidden" }}
      onMouseMove={dragState ? handleMouseMove : undefined}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
    >
      {/* Scrollable content */}
      <div
        className="absolute top-0 left-0"
        style={{
          width: `${totalWidth}px`,
          height: "100%",
          transform: `translateX(-${scrollPosition}px)`,
        }}
      >
        {/* Grid lines */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: `${totalWidth}px`, height: "100%" }}
        >
          {/* Vertical grid lines every second */}
          {Array.from({ length: Math.ceil(totalWidth / pixelsPerSecond) }).map(
            (_, i) => (
              <line
                key={i}
                x1={i * pixelsPerSecond}
                y1={0}
                x2={i * pixelsPerSecond}
                y2={height}
                stroke={
                  i % 5 === 0
                    ? isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
                    : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"
                }
                strokeWidth={1}
              />
            ),
          )}
        </svg>

        {/* Crossfade zones (rendered behind clips) */}
        {crossfades.map((crossfade) => {
          const clipA = clips.find((c) => c.id === crossfade.clipAId);
          const clipB = clips.find((c) => c.id === crossfade.clipBId);

          if (!clipA || !clipB) return null;

          return (
            <CrossfadeZone
              key={crossfade.id}
              crossfade={crossfade}
              clipA={clipA}
              clipB={clipB}
              pixelsPerSecond={pixelsPerSecond}
              trackHeight={height}
            />
          );
        })}

        {/* Clips */}
        {clips.map((clip) => (
          <TimelineClip
            key={clip.id}
            clip={clip}
            pixelsPerSecond={pixelsPerSecond}
            trackHeight={height - 10}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        ))}

        {/* Playhead */}
        <div
          ref={playheadRef}
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-20"
          style={{ boxShadow: "0 0 8px rgba(239, 68, 68, 0.5)" }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rotate-45" />
        </div>
      </div>

      {/* Empty state */}
      {clips.length === 0 && (
        <div className={`absolute inset-0 flex items-center justify-center ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
          <div className="text-center">
            <p className="text-lg">Drop songs here or add from the library</p>
            <p className="text-sm mt-1">
              Songs will be arranged sequentially with crossfades
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default TimelineTrack;
