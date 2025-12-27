import React, { useRef, useEffect, useCallback } from "react";
import { useTimeline } from "../TimelineEditorContext";

interface TimelineRulerProps {
  width: number;
  height?: number;
  onSeek?: (time: number) => void;
}

/**
 * TimelineRuler - Canvas-based time ruler with markers
 * Supports click-to-seek and displays time markers
 */
export function TimelineRuler({
  width,
  height = 30,
  onSeek,
}: TimelineRulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state, actions } = useTimeline();
  const { zoom, scrollPosition, currentTime, duration } = state;

  // Pixels per second at current zoom level
  const pixelsPerSecond = 100 * zoom;

  // Format time as MM:SS or MM:SS.ms
  const formatTime = useCallback(
    (seconds: number, showMs: boolean = false): string => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 10);

      if (showMs) {
        return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
      }
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    },
    [],
  );

  // Draw the ruler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle device pixel ratio for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    // Calculate visible time range
    const startTime = scrollPosition / pixelsPerSecond;
    const visibleDuration = width / pixelsPerSecond;
    const endTime = startTime + visibleDuration;

    // Determine marker interval based on zoom
    let majorInterval: number;
    let minorInterval: number;

    if (pixelsPerSecond >= 400) {
      // Very zoomed in: mark every 0.1s
      majorInterval = 1;
      minorInterval = 0.1;
    } else if (pixelsPerSecond >= 100) {
      // Medium zoom: mark every 1s
      majorInterval = 5;
      minorInterval = 1;
    } else if (pixelsPerSecond >= 25) {
      // Zoomed out: mark every 5s
      majorInterval = 15;
      minorInterval = 5;
    } else {
      // Very zoomed out: mark every 30s
      majorInterval = 60;
      minorInterval = 15;
    }

    // Draw minor markers
    ctx.strokeStyle = "#3a3a5e";
    ctx.lineWidth = 1;
    ctx.beginPath();

    const firstMinor = Math.floor(startTime / minorInterval) * minorInterval;
    for (let t = firstMinor; t <= endTime; t += minorInterval) {
      const x = (t - startTime) * pixelsPerSecond;
      ctx.moveTo(x, height - 5);
      ctx.lineTo(x, height);
    }
    ctx.stroke();

    // Draw major markers with labels
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#a5a5c9";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";

    const firstMajor = Math.floor(startTime / majorInterval) * majorInterval;
    for (let t = firstMajor; t <= endTime; t += majorInterval) {
      const x = (t - startTime) * pixelsPerSecond;

      // Draw line
      ctx.beginPath();
      ctx.moveTo(x, height - 12);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Draw label
      ctx.fillText(formatTime(t), x, height - 15);
    }

    // Draw playhead position indicator
    if (currentTime >= startTime && currentTime <= endTime) {
      const playheadX = (currentTime - startTime) * pixelsPerSecond;
      ctx.fillStyle = "#f43f5e";
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();
    }

    // Draw duration end marker
    if (duration > 0 && duration >= startTime && duration <= endTime) {
      const endX = (duration - startTime) * pixelsPerSecond;
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(endX, 0);
      ctx.lineTo(endX, height);
      ctx.stroke();
    }
  }, [
    width,
    height,
    zoom,
    scrollPosition,
    currentTime,
    duration,
    pixelsPerSecond,
    formatTime,
  ]);

  // Handle click to seek
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const startTime = scrollPosition / pixelsPerSecond;
      const clickTime = startTime + x / pixelsPerSecond;

      if (onSeek) {
        onSeek(Math.max(0, Math.min(clickTime, duration)));
      } else {
        actions.seek(Math.max(0, Math.min(clickTime, duration)));
      }
    },
    [scrollPosition, pixelsPerSecond, duration, onSeek, actions],
  );

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        cursor: "pointer",
      }}
      onClick={handleClick}
      className="border-b border-white/10"
      aria-label="Timeline ruler - click to seek"
      role="slider"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
    />
  );
}

export default TimelineRuler;
