import React, { useRef, useEffect, useCallback, useState } from "react";
import { TimelineClip as TimelineClipType } from "../../../../types/timeline";
import { useTimeline } from "../TimelineEditorContext";

interface TimelineClipProps {
  clip: TimelineClipType;
  pixelsPerSecond: number;
  trackHeight: number;
  onDragStart?: (clipId: string, offsetX: number) => void;
  onDragEnd?: () => void;
}

/**
 * TimelineClip - Renders a single audio clip with waveform
 * Supports selection, drag to move, and trim handles
 */
export function TimelineClip({
  clip,
  pixelsPerSecond,
  trackHeight,
  onDragStart,
  onDragEnd,
}: TimelineClipProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, actions } = useTimeline();
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [trimMode, setTrimMode] = useState<"start" | "end" | null>(null);
  const trimStartRef = useRef<{
    x: number;
    trimStart: number;
    trimEnd: number;
  }>({
    x: 0,
    trimStart: 0,
    trimEnd: 0,
  });

  const isSelected = state.selectedClipId === clip.id;
  const effectiveDuration = clip.duration - clip.trimStart - clip.trimEnd;
  const clipWidth = effectiveDuration * pixelsPerSecond;
  const clipLeft = clip.startTime * pixelsPerSecond;

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !clip.waveformData) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = clipWidth * dpr;
    canvas.height = (trackHeight - 20) * dpr;
    ctx.scale(dpr, dpr);

    const width = clipWidth;
    const height = trackHeight - 20;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Calculate which portion of waveform to display (accounting for trim)
    const waveformLength = clip.waveformData.length;
    const trimStartRatio = clip.trimStart / clip.duration;
    const trimEndRatio = clip.trimEnd / clip.duration;
    const startIndex = Math.floor(trimStartRatio * waveformLength);
    const endIndex = Math.floor((1 - trimEndRatio) * waveformLength);
    const visibleLength = endIndex - startIndex;

    if (visibleLength <= 0) return;

    // Draw waveform
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    if (clip.isMuted) {
      gradient.addColorStop(0, "#4a4a6a");
      gradient.addColorStop(1, "#3a3a5a");
    } else {
      gradient.addColorStop(0, "#818cf8");
      gradient.addColorStop(1, "#6366f1");
    }
    ctx.fillStyle = gradient;

    const barWidth = width / visibleLength;
    const centerY = height / 2;

    for (let i = 0; i < visibleLength; i++) {
      const value = clip.waveformData[startIndex + i];
      const barHeight = value * height * 0.8;
      const x = i * barWidth;

      ctx.fillRect(
        x,
        centerY - barHeight / 2,
        Math.max(1, barWidth - 0.5),
        barHeight,
      );
    }
  }, [
    clip.waveformData,
    clipWidth,
    trackHeight,
    clip.trimStart,
    clip.trimEnd,
    clip.duration,
    clip.isMuted,
  ]);

  // Handle mouse down for dragging
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Left click only

      actions.selectClip(clip.id);
      setIsDragging(true);

      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && onDragStart) {
        const offsetX = e.clientX - rect.left;
        onDragStart(clip.id, offsetX);
      }
    },
    [clip.id, actions, onDragStart],
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onDragEnd?.();
    }
  }, [isDragging, onDragEnd]);

  // Add global mouse up listener
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mouseup", handleMouseUp);
      return () => window.removeEventListener("mouseup", handleMouseUp);
    }
  }, [isDragging, handleMouseUp]);

  // Handle double-click for mute toggle
  const handleDoubleClick = useCallback(() => {
    actions.toggleClipMute(clip.id);
  }, [clip.id, actions]);

  // Handle keyboard
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        actions.removeClip(clip.id);
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        actions.toggleClipMute(clip.id);
      }
    },
    [clip.id, actions],
  );

  // Handle trim start
  const handleTrimStart = useCallback(
    (mode: "start" | "end", e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setTrimMode(mode);
      trimStartRef.current = {
        x: e.clientX,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
      };
    },
    [clip.trimStart, clip.trimEnd],
  );

  // Handle trim drag
  useEffect(() => {
    if (!trimMode) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - trimStartRef.current.x;
      const deltaTime = deltaX / pixelsPerSecond;

      if (trimMode === "start") {
        // Dragging left edge: increase trimStart (move right = more trim)
        const newTrimStart = Math.max(
          0,
          Math.min(
            clip.duration - clip.trimEnd - 1, // Leave at least 1 second
            trimStartRef.current.trimStart + deltaTime,
          ),
        );
        actions.trimClip(clip.id, newTrimStart, clip.trimEnd);
      } else {
        // Dragging right edge: increase trimEnd (move left = more trim)
        const newTrimEnd = Math.max(
          0,
          Math.min(
            clip.duration - clip.trimStart - 1, // Leave at least 1 second
            trimStartRef.current.trimEnd - deltaTime,
          ),
        );
        actions.trimClip(clip.id, clip.trimStart, newTrimEnd);
      }
    };

    const handleMouseUp = () => {
      setTrimMode(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    trimMode,
    pixelsPerSecond,
    clip.id,
    clip.duration,
    clip.trimStart,
    clip.trimEnd,
    actions,
  ]);

  return (
    <div
      ref={containerRef}
      className={`absolute rounded-lg overflow-hidden transition-shadow ${
        isSelected
          ? "ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/25"
          : isHovering
            ? "ring-1 ring-white/30"
            : ""
      } ${clip.isMuted ? "opacity-50" : ""}`}
      style={{
        left: `${clipLeft}px`,
        width: `${clipWidth}px`,
        height: `${trackHeight}px`,
        top: 0,
        cursor: isDragging ? "grabbing" : "grab",
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${clip.songTitle}${clip.isMuted ? " (muted)" : ""}`}
      aria-pressed={isSelected}
    >
      {/* Background */}
      <div
        className={`absolute inset-0 ${
          clip.isMuted
            ? "bg-gradient-to-b from-gray-700 to-gray-800"
            : "bg-gradient-to-b from-indigo-600/80 to-indigo-900/80"
        }`}
      />

      {/* Header with title */}
      <div className="relative flex items-center justify-between px-2 h-5 bg-black/20 border-b border-white/10">
        <span className="text-xs font-medium text-white truncate max-w-[80%]">
          {clip.songTitle}
        </span>
        {clip.analysis && (
          <span className="text-[10px] text-white/60">
            {clip.analysis.bpm} BPM | {clip.analysis.key}
          </span>
        )}
      </div>

      {/* Waveform canvas */}
      <canvas
        ref={canvasRef}
        className="relative mx-1 mt-1"
        style={{
          width: `${Math.max(0, clipWidth - 8)}px`,
          height: `${Math.max(0, trackHeight - 24)}px`,
        }}
      />

      {/* Mute indicator */}
      {clip.isMuted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <span className="text-white/80 text-sm font-medium">MUTED</span>
        </div>
      )}

      {/* Trim handles (visible when selected or hovering) */}
      {(isSelected || isHovering) && (
        <>
          {/* Left trim handle */}
          <div
            className={`absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize ${
              trimMode === "start"
                ? "bg-yellow-500/70"
                : "bg-white/30 hover:bg-white/50"
            }`}
            onMouseDown={(e) => handleTrimStart("start", e)}
            title="Drag to trim start"
          />
          {/* Right trim handle */}
          <div
            className={`absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize ${
              trimMode === "end"
                ? "bg-yellow-500/70"
                : "bg-white/30 hover:bg-white/50"
            }`}
            onMouseDown={(e) => handleTrimStart("end", e)}
            title="Drag to trim end"
          />
        </>
      )}
    </div>
  );
}

export default TimelineClip;
