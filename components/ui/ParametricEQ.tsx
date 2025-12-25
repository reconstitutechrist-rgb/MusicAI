import React, { useEffect, useRef, useState, useCallback } from "react";

export interface EQBand {
  id: string;
  frequency: number; // 20-20000 Hz
  gain: number; // -12 to +12 dB
  q: number; // 0.1 to 10
  type: BiquadFilterType;
  enabled: boolean;
}

interface ParametricEQProps {
  bands: EQBand[];
  onChange: (bands: EQBand[]) => void;
  height?: number;
}

// Presets for quick EQ settings
export const EQ_PRESETS: { name: string; bands: Omit<EQBand, "id">[] }[] = [
  {
    name: "Flat",
    bands: [
      { frequency: 80, gain: 0, q: 0.7, type: "lowshelf", enabled: true },
      { frequency: 250, gain: 0, q: 1.4, type: "peaking", enabled: true },
      { frequency: 1000, gain: 0, q: 1.4, type: "peaking", enabled: true },
      { frequency: 4000, gain: 0, q: 1.4, type: "peaking", enabled: true },
      { frequency: 12000, gain: 0, q: 0.7, type: "highshelf", enabled: true },
    ],
  },
  {
    name: "Vocal Presence",
    bands: [
      { frequency: 80, gain: -3, q: 0.7, type: "lowshelf", enabled: true },
      { frequency: 200, gain: -2, q: 2, type: "peaking", enabled: true },
      { frequency: 2500, gain: 4, q: 1.5, type: "peaking", enabled: true },
      { frequency: 5000, gain: 3, q: 1, type: "peaking", enabled: true },
      { frequency: 10000, gain: 2, q: 0.7, type: "highshelf", enabled: true },
    ],
  },
  {
    name: "Bass Boost",
    bands: [
      { frequency: 60, gain: 6, q: 0.8, type: "lowshelf", enabled: true },
      { frequency: 150, gain: 3, q: 1.5, type: "peaking", enabled: true },
      { frequency: 800, gain: -1, q: 1, type: "peaking", enabled: true },
      { frequency: 3000, gain: 0, q: 1, type: "peaking", enabled: true },
      { frequency: 10000, gain: -2, q: 0.7, type: "highshelf", enabled: true },
    ],
  },
  {
    name: "High Cut",
    bands: [
      { frequency: 80, gain: 0, q: 0.7, type: "lowshelf", enabled: true },
      { frequency: 300, gain: 0, q: 1, type: "peaking", enabled: true },
      { frequency: 1000, gain: 0, q: 1, type: "peaking", enabled: true },
      { frequency: 4000, gain: -3, q: 1.5, type: "peaking", enabled: true },
      { frequency: 8000, gain: -8, q: 0.7, type: "highshelf", enabled: true },
    ],
  },
  {
    name: "Telephone",
    bands: [
      { frequency: 300, gain: -12, q: 1, type: "lowshelf", enabled: true },
      { frequency: 800, gain: 2, q: 2, type: "peaking", enabled: true },
      { frequency: 2000, gain: 4, q: 1.5, type: "peaking", enabled: true },
      { frequency: 3500, gain: -12, q: 1, type: "highshelf", enabled: true },
      { frequency: 5000, gain: 0, q: 1, type: "peaking", enabled: false },
    ],
  },
];

// Default 5-band EQ
export const DEFAULT_EQ_BANDS: EQBand[] = [
  {
    id: "band-1",
    frequency: 80,
    gain: 0,
    q: 0.7,
    type: "lowshelf",
    enabled: true,
  },
  {
    id: "band-2",
    frequency: 250,
    gain: 0,
    q: 1.4,
    type: "peaking",
    enabled: true,
  },
  {
    id: "band-3",
    frequency: 1000,
    gain: 0,
    q: 1.4,
    type: "peaking",
    enabled: true,
  },
  {
    id: "band-4",
    frequency: 4000,
    gain: 0,
    q: 1.4,
    type: "peaking",
    enabled: true,
  },
  {
    id: "band-5",
    frequency: 12000,
    gain: 0,
    q: 0.7,
    type: "highshelf",
    enabled: true,
  },
];

// Frequency to X position (logarithmic scale)
const freqToX = (freq: number, width: number): number => {
  const minFreq = 20;
  const maxFreq = 20000;
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  const logFreq = Math.log10(freq);
  return ((logFreq - logMin) / (logMax - logMin)) * width;
};

// X position to frequency
const xToFreq = (x: number, width: number): number => {
  const minFreq = 20;
  const maxFreq = 20000;
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  const logFreq = (x / width) * (logMax - logMin) + logMin;
  return Math.pow(10, logFreq);
};

// Gain to Y position
const gainToY = (gain: number, height: number): number => {
  const minGain = -12;
  const maxGain = 12;
  return height / 2 - (gain / (maxGain - minGain)) * height;
};

// Y position to gain
const yToGain = (y: number, height: number): number => {
  const minGain = -12;
  const maxGain = 12;
  return ((height / 2 - y) / height) * (maxGain - minGain);
};

// Calculate frequency response for a single band
const calcBandResponse = (freq: number, band: EQBand): number => {
  if (!band.enabled) return 0;

  const f0 = band.frequency;
  const G = band.gain;
  const Q = band.q;

  // Simplified frequency response approximation
  const ratio = freq / f0;
  const logRatio = Math.log2(ratio);

  switch (band.type) {
    case "lowshelf": {
      const bandwidth = 2;
      if (ratio < 1) {
        return G;
      } else {
        return G * Math.exp(-Math.pow(logRatio * Q, 2) * bandwidth);
      }
    }
    case "highshelf": {
      const bandwidth = 2;
      if (ratio > 1) {
        return G;
      } else {
        return G * Math.exp(-Math.pow(logRatio * Q, 2) * bandwidth);
      }
    }
    case "peaking":
    default: {
      // Bell curve response
      const bandwidth = 1 / Q;
      return G * Math.exp(-Math.pow(logRatio / bandwidth, 2) * 2);
    }
  }
};

const ParametricEQ: React.FC<ParametricEQProps> = ({
  bands,
  onChange,
  height = 180,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingBand, setDraggingBand] = useState<string | null>(null);
  const [selectedBand, setSelectedBand] = useState<string | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(400);

  // Handle resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setCanvasWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Draw the EQ curve
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvasWidth;

    // Set canvas size with device pixel ratio
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = "#111827"; // gray-900
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = "#374151"; // gray-700
    ctx.lineWidth = 0.5;

    // Horizontal grid lines (gain levels)
    const gainLines = [-12, -6, 0, 6, 12];
    ctx.setLineDash([2, 2]);
    gainLines.forEach((gain) => {
      const y = gainToY(gain, height);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });

    // Vertical grid lines (frequency markers)
    const freqMarkers = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
    freqMarkers.forEach((freq) => {
      const x = freqToX(freq, width);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // 0dB line (more prominent)
    ctx.strokeStyle = "#4b5563"; // gray-600
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Calculate and draw combined frequency response
    const points: number[] = [];
    for (let x = 0; x < width; x++) {
      const freq = xToFreq(x, width);
      let totalGain = 0;
      bands.forEach((band) => {
        totalGain += calcBandResponse(freq, band);
      });
      totalGain = Math.max(-12, Math.min(12, totalGain)); // Clamp
      points.push(gainToY(totalGain, height));
    }

    // Draw filled area
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    points.forEach((y, x) => {
      ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height / 2);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(99, 102, 241, 0.3)"); // indigo
    gradient.addColorStop(0.5, "rgba(99, 102, 241, 0.05)");
    gradient.addColorStop(1, "rgba(99, 102, 241, 0.3)");
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw curve line
    ctx.beginPath();
    ctx.moveTo(0, points[0]);
    points.forEach((y, x) => {
      ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#818cf8"; // indigo-400
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw band handles
    bands.forEach((band) => {
      if (!band.enabled) return;

      const x = freqToX(band.frequency, width);
      const y = gainToY(band.gain, height);

      const isSelected = selectedBand === band.id;
      const isDragging = draggingBand === band.id;

      // Handle circle
      ctx.beginPath();
      ctx.arc(x, y, isSelected || isDragging ? 10 : 8, 0, Math.PI * 2);

      if (isDragging) {
        ctx.fillStyle = "#c084fc"; // purple-400
      } else if (isSelected) {
        ctx.fillStyle = "#a855f7"; // purple-500
      } else {
        ctx.fillStyle = "#6366f1"; // indigo-500
      }
      ctx.fill();

      // Handle border
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw frequency labels
    ctx.fillStyle = "#6b7280"; // gray-500
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    [100, 1000, 10000].forEach((freq) => {
      const x = freqToX(freq, width);
      const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
      ctx.fillText(label, x, height - 4);
    });

    // Draw gain labels
    ctx.textAlign = "right";
    [12, 0, -12].forEach((gain) => {
      const y = gainToY(gain, height);
      ctx.fillText(`${gain > 0 ? "+" : ""}${gain}`, 22, y + 3);
    });
  }, [bands, canvasWidth, height, selectedBand, draggingBand]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find closest band
    let closestBand: EQBand | null = null;
    let closestDist = Infinity;

    bands.forEach((band) => {
      if (!band.enabled) return;
      const bx = freqToX(band.frequency, canvasWidth);
      const by = gainToY(band.gain, height);
      const dist = Math.sqrt(Math.pow(x - bx, 2) + Math.pow(y - by, 2));
      if (dist < closestDist && dist < 20) {
        closestDist = dist;
        closestBand = band;
      }
    });

    if (closestBand) {
      setDraggingBand(closestBand.id);
      setSelectedBand(closestBand.id);
    } else {
      setSelectedBand(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingBand) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newFreq = Math.max(20, Math.min(20000, xToFreq(x, canvasWidth)));
    const newGain = Math.max(-12, Math.min(12, yToGain(y, height)));

    const newBands = bands.map((band) =>
      band.id === draggingBand
        ? {
            ...band,
            frequency: Math.round(newFreq),
            gain: Math.round(newGain * 10) / 10,
          }
        : band,
    );
    onChange(newBands);
  };

  const handleMouseUp = () => {
    setDraggingBand(null);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find clicked band
    bands.forEach((band) => {
      if (!band.enabled) return;
      const bx = freqToX(band.frequency, canvasWidth);
      const by = gainToY(band.gain, height);
      const dist = Math.sqrt(Math.pow(x - bx, 2) + Math.pow(y - by, 2));
      if (dist < 20) {
        // Reset this band to 0 gain
        const newBands = bands.map((b) =>
          b.id === band.id ? { ...b, gain: 0 } : b,
        );
        onChange(newBands);
      }
    });
  };

  const selectedBandData = selectedBand
    ? bands.find((b) => b.id === selectedBand)
    : null;

  const updateSelectedBand = (updates: Partial<EQBand>) => {
    if (!selectedBand) return;
    const newBands = bands.map((band) =>
      band.id === selectedBand ? { ...band, ...updates } : band,
    );
    onChange(newBands);
  };

  return (
    <div ref={containerRef} className="w-full">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: `${height}px` }}
        className="rounded-lg cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      />

      {/* Selected Band Controls */}
      {selectedBandData && (
        <div className="mt-3 p-3 bg-gray-800/50 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">
              Band {bands.findIndex((b) => b.id === selectedBand) + 1}
            </span>
            <button
              onClick={() =>
                updateSelectedBand({ enabled: !selectedBandData.enabled })
              }
              className={`px-2 py-1 text-xs rounded ${
                selectedBandData.enabled
                  ? "bg-green-600/20 text-green-400"
                  : "bg-gray-700 text-gray-500"
              }`}
            >
              {selectedBandData.enabled ? "ON" : "OFF"}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Freq (Hz)
              </label>
              <input
                type="number"
                min={20}
                max={20000}
                value={selectedBandData.frequency}
                onChange={(e) =>
                  updateSelectedBand({
                    frequency: parseInt(e.target.value) || 20,
                  })
                }
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Gain (dB)
              </label>
              <input
                type="number"
                min={-12}
                max={12}
                step={0.5}
                value={selectedBandData.gain}
                onChange={(e) =>
                  updateSelectedBand({ gain: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Q</label>
              <input
                type="number"
                min={0.1}
                max={10}
                step={0.1}
                value={selectedBandData.q}
                onChange={(e) =>
                  updateSelectedBand({ q: parseFloat(e.target.value) || 1 })
                }
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Filter Type
            </label>
            <select
              value={selectedBandData.type}
              onChange={(e) =>
                updateSelectedBand({ type: e.target.value as BiquadFilterType })
              }
              className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
            >
              <option value="lowshelf">Low Shelf</option>
              <option value="peaking">Peaking (Bell)</option>
              <option value="highshelf">High Shelf</option>
            </select>
          </div>
        </div>
      )}

      {/* Quick band overview */}
      <div className="mt-2 flex gap-1">
        {bands.map((band, idx) => (
          <button
            key={band.id}
            onClick={() => setSelectedBand(band.id)}
            className={`flex-1 py-1 px-2 text-xs rounded transition-colors ${
              selectedBand === band.id
                ? "bg-indigo-600 text-white"
                : band.enabled
                  ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  : "bg-gray-800 text-gray-500"
            }`}
          >
            {idx + 1}
          </button>
        ))}
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-600 mt-2">
        Drag handles to adjust. Double-click to reset band.
      </p>
    </div>
  );
};

export default ParametricEQ;
