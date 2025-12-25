import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AutomationLaneData, AutomationPoint, AutomationCurveType, AutomatableParameter } from '../../types';

interface AutomationLaneProps {
  lane: AutomationLaneData;
  duration: number;
  currentTime: number;
  onUpdate: (lane: AutomationLaneData) => void;
  onDelete: () => void;
  parameterLabel: string;
  color?: string;
}

const PARAMETER_LABELS: Record<AutomatableParameter, string> = {
  'inst-volume': 'Instrumental Volume',
  'vocal-volume': 'Vocal Volume',
  'harmony-volume': 'Harmony Volume',
  'vocal-eqLow': 'Vocal EQ Low',
  'vocal-eqMid': 'Vocal EQ Mid',
  'vocal-eqHigh': 'Vocal EQ High',
  'harmony-eqLow': 'Harmony EQ Low',
  'harmony-eqMid': 'Harmony EQ Mid',
  'harmony-eqHigh': 'Harmony EQ High',
  'vocal-reverb': 'Vocal Reverb',
  'harmony-reverb': 'Harmony Reverb',
  'vocal-delay': 'Vocal Delay',
  'harmony-delay': 'Harmony Delay',
  'master-volume': 'Master Volume'
};

const CURVE_COLORS: Record<AutomationCurveType, string> = {
  linear: '#6366f1',
  exponential: '#8b5cf6',
  hold: '#ec4899',
  smooth: '#14b8a6'
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function interpolateValue(
  p1: AutomationPoint,
  p2: AutomationPoint,
  time: number
): number {
  if (time <= p1.time) return p1.value;
  if (time >= p2.time) return p2.value;

  const t = (time - p1.time) / (p2.time - p1.time);

  switch (p1.curve) {
    case 'hold':
      return p1.value;
    case 'exponential':
      return p1.value + (p2.value - p1.value) * (t * t);
    case 'smooth':
      // Smoothstep interpolation
      const smooth = t * t * (3 - 2 * t);
      return p1.value + (p2.value - p1.value) * smooth;
    case 'linear':
    default:
      return p1.value + (p2.value - p1.value) * t;
  }
}

export function getValueAtTime(lane: AutomationLaneData, time: number): number {
  if (lane.points.length === 0) return 0.5;
  if (lane.points.length === 1) return lane.points[0].value;

  const sortedPoints = [...lane.points].sort((a, b) => a.time - b.time);

  // Before first point
  if (time <= sortedPoints[0].time) return sortedPoints[0].value;
  // After last point
  if (time >= sortedPoints[sortedPoints.length - 1].time) {
    return sortedPoints[sortedPoints.length - 1].value;
  }

  // Find surrounding points
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    if (time >= sortedPoints[i].time && time < sortedPoints[i + 1].time) {
      return interpolateValue(sortedPoints[i], sortedPoints[i + 1], time);
    }
  }

  return 0.5;
}

export function denormalizeValue(normalized: number, min: number, max: number): number {
  return min + normalized * (max - min);
}

export default function AutomationLane({
  lane,
  duration,
  currentTime,
  onUpdate,
  onDelete,
  parameterLabel,
  color = '#6366f1'
}: AutomationLaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showCurveMenu, setShowCurveMenu] = useState<{ x: number; y: number; pointId: string } | null>(null);

  const getCanvasCoords = useCallback((e: React.MouseEvent): { time: number; value: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { time: 0, value: 0.5 };

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const time = (x / rect.width) * duration;
    const value = 1 - (y / rect.height);

    return {
      time: Math.max(0, Math.min(duration, time)),
      value: Math.max(0, Math.min(1, value))
    };
  }, [duration]);

  const drawLane = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;

    // Horizontal grid (value)
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Vertical grid (time) - every 5 seconds
    const gridInterval = 5;
    for (let t = 0; t <= duration; t += gridInterval) {
      const x = (t / duration) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw automation curve
    if (lane.points.length > 0) {
      const sortedPoints = [...lane.points].sort((a, b) => a.time - b.time);

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      // Start from left edge
      const firstValue = sortedPoints[0].value;
      ctx.moveTo(0, (1 - firstValue) * height);

      // Draw line to first point
      const firstX = (sortedPoints[0].time / duration) * width;
      ctx.lineTo(firstX, (1 - firstValue) * height);

      // Draw between points with interpolation
      for (let i = 0; i < sortedPoints.length - 1; i++) {
        const p1 = sortedPoints[i];
        const p2 = sortedPoints[i + 1];
        const x1 = (p1.time / duration) * width;
        const x2 = (p2.time / duration) * width;

        // Sample curve for smooth drawing
        const steps = Math.ceil((x2 - x1) / 2);
        for (let s = 1; s <= steps; s++) {
          const t = p1.time + ((p2.time - p1.time) * s) / steps;
          const v = interpolateValue(p1, p2, t);
          const x = (t / duration) * width;
          const y = (1 - v) * height;
          ctx.lineTo(x, y);
        }
      }

      // Draw to right edge
      const lastValue = sortedPoints[sortedPoints.length - 1].value;
      ctx.lineTo(width, (1 - lastValue) * height);

      ctx.stroke();

      // Draw points
      sortedPoints.forEach(point => {
        const x = (point.time / duration) * width;
        const y = (1 - point.value) * height;

        // Point shadow
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();

        // Point
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = selectedPointId === point.id ? '#fff' : CURVE_COLORS[point.curve];
        ctx.fill();

        // Point border
        ctx.strokeStyle = selectedPointId === point.id ? color : '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // Draw playhead
    if (currentTime >= 0 && currentTime <= duration) {
      const playheadX = (currentTime / duration) * width;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [lane, duration, currentTime, color, selectedPointId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
      drawLane();
    });

    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [drawLane]);

  useEffect(() => {
    drawLane();
  }, [drawLane]);

  const findPointAt = useCallback((time: number, value: number): AutomationPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const threshold = 15; // pixels

    for (const point of lane.points) {
      const px = (point.time / duration) * width;
      const py = (1 - point.value) * height;
      const mx = (time / duration) * width;
      const my = (1 - value) * height;

      const dist = Math.sqrt((px - mx) ** 2 + (py - my) ** 2);
      if (dist < threshold) return point;
    }

    return null;
  }, [lane.points, duration]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const { time, value } = getCanvasCoords(e);
    const point = findPointAt(time, value);

    if (e.button === 2) {
      // Right click - show curve menu
      e.preventDefault();
      if (point) {
        setShowCurveMenu({ x: e.clientX, y: e.clientY, pointId: point.id });
        setSelectedPointId(point.id);
      }
      return;
    }

    if (point) {
      setSelectedPointId(point.id);
      setIsDragging(true);
    } else if (e.shiftKey) {
      // Shift+click to add point
      const newPoint: AutomationPoint = {
        id: generateId(),
        time,
        value,
        curve: 'linear'
      };
      onUpdate({
        ...lane,
        points: [...lane.points, newPoint]
      });
      setSelectedPointId(newPoint.id);
    }
  }, [getCanvasCoords, findPointAt, lane, onUpdate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !selectedPointId) return;

    const { time, value } = getCanvasCoords(e);
    onUpdate({
      ...lane,
      points: lane.points.map(p =>
        p.id === selectedPointId ? { ...p, time, value } : p
      )
    });
  }, [isDragging, selectedPointId, getCanvasCoords, lane, onUpdate]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const { time, value } = getCanvasCoords(e);
    const point = findPointAt(time, value);

    if (point) {
      // Delete point on double click
      onUpdate({
        ...lane,
        points: lane.points.filter(p => p.id !== point.id)
      });
      setSelectedPointId(null);
    } else {
      // Add new point
      const newPoint: AutomationPoint = {
        id: generateId(),
        time,
        value,
        curve: 'linear'
      };
      onUpdate({
        ...lane,
        points: [...lane.points, newPoint]
      });
      setSelectedPointId(newPoint.id);
    }
  }, [getCanvasCoords, findPointAt, lane, onUpdate]);

  const handleCurveSelect = useCallback((curve: AutomationCurveType) => {
    if (!showCurveMenu) return;

    onUpdate({
      ...lane,
      points: lane.points.map(p =>
        p.id === showCurveMenu.pointId ? { ...p, curve } : p
      )
    });
    setShowCurveMenu(null);
  }, [showCurveMenu, lane, onUpdate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedPointId) {
        onUpdate({
          ...lane,
          points: lane.points.filter(p => p.id !== selectedPointId)
        });
        setSelectedPointId(null);
      }
    }
  }, [selectedPointId, lane, onUpdate]);

  // Close curve menu on outside click
  useEffect(() => {
    const handleClick = () => setShowCurveMenu(null);
    if (showCurveMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showCurveMenu]);

  const currentValue = getValueAtTime(lane, currentTime);
  const displayValue = denormalizeValue(currentValue, lane.minValue, lane.maxValue);

  return (
    <div
      ref={containerRef}
      className="relative bg-gray-800 rounded-lg overflow-hidden"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-700/50 border-b border-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-medium text-gray-200">
            {parameterLabel || PARAMETER_LABELS[lane.parameter]}
          </span>
          <span className="text-xs text-gray-400 ml-2">
            {displayValue.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdate({ ...lane, enabled: !lane.enabled })}
            className={`px-2 py-0.5 text-xs rounded ${
              lane.enabled
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-600 text-gray-400'
            }`}
          >
            {lane.enabled ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={onDelete}
            className="text-gray-400 hover:text-red-400 transition-colors"
            title="Delete lane"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-24 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Instructions */}
      <div className="absolute bottom-1 right-2 text-[10px] text-gray-500">
        Shift+click: add | Double-click: add/delete | Right-click: curve | Drag: move
      </div>

      {/* Curve Type Menu */}
      {showCurveMenu && (
        <div
          className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 z-50"
          style={{ left: showCurveMenu.x, top: showCurveMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-xs text-gray-400 border-b border-gray-600">
            Curve Type
          </div>
          {(['linear', 'smooth', 'exponential', 'hold'] as AutomationCurveType[]).map(curve => (
            <button
              key={curve}
              onClick={() => handleCurveSelect(curve)}
              className="w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: CURVE_COLORS[curve] }}
              />
              {curve.charAt(0).toUpperCase() + curve.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { PARAMETER_LABELS };
