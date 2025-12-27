import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  CrossfadeRegion,
  TimelineClip as TimelineClipType,
  CrossfadeCurveType,
} from "../../../../types/timeline";
import { useTimeline } from "../TimelineEditorContext";
import { generateCrossfadeCurve } from "../../../../utils/crossfadeAlgorithms";

interface CrossfadeZoneProps {
  crossfade: CrossfadeRegion;
  clipA: TimelineClipType;
  clipB: TimelineClipType;
  pixelsPerSecond: number;
  trackHeight: number;
}

/**
 * CrossfadeZone - Visual representation of crossfade between two clips
 * Shows curve visualization and allows duration adjustment
 */
export function CrossfadeZone({
  crossfade,
  clipA,
  clipB,
  pixelsPerSecond,
  trackHeight,
}: CrossfadeZoneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state, actions } = useTimeline();
  const [isHovering, setIsHovering] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const isSelected = state.selectedCrossfadeId === crossfade.id;

  // Calculate position
  const clipAEnd =
    clipA.startTime + clipA.duration - clipA.trimStart - clipA.trimEnd;
  const crossfadeStart = clipB.startTime;
  const crossfadeEnd = Math.min(clipAEnd, clipB.startTime + crossfade.duration);
  const crossfadeWidth = Math.max(
    0,
    (crossfadeEnd - crossfadeStart) * pixelsPerSecond,
  );
  const crossfadeLeft = crossfadeStart * pixelsPerSecond;

  // Don't render if no actual overlap
  if (crossfadeWidth <= 0) return null;

  // Draw crossfade curve visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = crossfadeWidth * dpr;
    canvas.height = trackHeight * dpr;
    ctx.scale(dpr, dpr);

    const width = crossfadeWidth;
    const height = trackHeight;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw crossfade background
    const bgGradient = ctx.createLinearGradient(0, 0, width, 0);
    bgGradient.addColorStop(0, "rgba(99, 102, 241, 0.3)");
    bgGradient.addColorStop(0.5, "rgba(168, 85, 247, 0.4)");
    bgGradient.addColorStop(1, "rgba(99, 102, 241, 0.3)");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Generate curve data
    const { curveA, curveB } = generateCrossfadeCurve(crossfade.curveType, 100);

    // Draw curve A (fade out)
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let i = 0; i < curveA.length; i++) {
      const x = (i / (curveA.length - 1)) * width;
      const y = height - curveA[i] * height * 0.8;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();

    const gradientA = ctx.createLinearGradient(0, 0, 0, height);
    gradientA.addColorStop(0, "rgba(239, 68, 68, 0.6)");
    gradientA.addColorStop(1, "rgba(239, 68, 68, 0.1)");
    ctx.fillStyle = gradientA;
    ctx.fill();

    // Draw curve B (fade in)
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let i = 0; i < curveB.length; i++) {
      const x = (i / (curveB.length - 1)) * width;
      const y = height - curveB[i] * height * 0.8;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();

    const gradientB = ctx.createLinearGradient(0, 0, 0, height);
    gradientB.addColorStop(0, "rgba(34, 197, 94, 0.6)");
    gradientB.addColorStop(1, "rgba(34, 197, 94, 0.1)");
    ctx.fillStyle = gradientB;
    ctx.fill();

    // Draw curve lines
    ctx.strokeStyle = "rgba(239, 68, 68, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < curveA.length; i++) {
      const x = (i / (curveA.length - 1)) * width;
      const y = height - curveA[i] * height * 0.8 - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(34, 197, 94, 0.8)";
    ctx.beginPath();
    for (let i = 0; i < curveB.length; i++) {
      const x = (i / (curveB.length - 1)) * width;
      const y = height - curveB[i] * height * 0.8 - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [crossfadeWidth, trackHeight, crossfade.curveType]);

  // Handle curve type change
  const handleCurveChange = useCallback(
    (curve: CrossfadeCurveType) => {
      actions.setCrossfadeCurve(crossfade.id, curve);
      setShowMenu(false);
    },
    [crossfade.id, actions],
  );

  // Handle generate transition
  const handleGenerateTransition = useCallback(() => {
    actions.generateTransitionAudio(crossfade.id);
    setShowMenu(false);
  }, [crossfade.id, actions]);

  const curveOptions: { value: CrossfadeCurveType; label: string }[] = [
    { value: "linear", label: "Linear" },
    { value: "equalPower", label: "Equal Power" },
    { value: "sCurve", label: "S-Curve" },
    { value: "exponential", label: "Exponential" },
  ];

  return (
    <div
      className={`absolute z-10 ${
        isSelected ? "ring-2 ring-purple-500" : ""
      } ${isHovering ? "ring-1 ring-white/30" : ""}`}
      style={{
        left: `${crossfadeLeft}px`,
        width: `${crossfadeWidth}px`,
        height: `${trackHeight}px`,
        top: 0,
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setShowMenu(false);
      }}
      onClick={() => setShowMenu(!showMenu)}
    >
      {/* Crossfade visualization canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: `${crossfadeWidth}px`, height: `${trackHeight}px` }}
      />

      {/* Duration label */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-black/60 px-2 py-0.5 rounded text-xs text-white/80">
        {crossfade.duration.toFixed(1)}s
      </div>

      {/* Curve type indicator */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/60 px-2 py-0.5 rounded text-xs text-white/60">
        {crossfade.curveType}
      </div>

      {/* AI transition indicator */}
      {crossfade.transitionAudioBuffer && (
        <div className="absolute top-1 right-1 bg-green-500/80 px-1.5 py-0.5 rounded text-[10px] text-white font-medium">
          AI
        </div>
      )}

      {/* Generating indicator */}
      {crossfade.isGenerating && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="flex items-center gap-2 text-white">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-sm">Generating...</span>
          </div>
        </div>
      )}

      {/* Context menu */}
      {showMenu && !crossfade.isGenerating && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-gray-800 rounded-lg shadow-xl border border-white/10 py-2 min-w-[160px] z-50">
          <div className="px-3 py-1 text-xs text-white/50 uppercase tracking-wider">
            Curve Type
          </div>
          {curveOptions.map((option) => (
            <button
              key={option.value}
              className={`w-full px-3 py-1.5 text-left text-sm hover:bg-white/10 transition-colors ${
                crossfade.curveType === option.value
                  ? "text-purple-400"
                  : "text-white"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                handleCurveChange(option.value);
              }}
            >
              {option.label}
              {crossfade.curveType === option.value && " ✓"}
            </button>
          ))}

          <div className="border-t border-white/10 my-2" />

          <button
            className="w-full px-3 py-1.5 text-left text-sm text-purple-400 hover:bg-white/10 transition-colors flex items-center gap-2"
            onClick={(e) => {
              e.stopPropagation();
              handleGenerateTransition();
            }}
          >
            <span>✨</span>
            <span>Generate AI Transition</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default CrossfadeZone;
