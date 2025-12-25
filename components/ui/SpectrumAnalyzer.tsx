import React, { useEffect, useRef, useCallback } from "react";

interface SpectrumAnalyzerProps {
  analyser: AnalyserNode | null;
  width?: number;
  height?: number;
  mode?: "bars" | "line" | "filled";
  showPeakHold?: boolean;
  minDb?: number;
  maxDb?: number;
  barCount?: number;
}

// Frequency markers to display
const FREQ_MARKERS = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

// Convert frequency to x position (logarithmic scale)
const freqToX = (
  freq: number,
  width: number,
  minFreq = 20,
  maxFreq = 20000,
): number => {
  const minLog = Math.log10(minFreq);
  const maxLog = Math.log10(maxFreq);
  const freqLog = Math.log10(Math.max(minFreq, Math.min(maxFreq, freq)));
  return ((freqLog - minLog) / (maxLog - minLog)) * width;
};

// Convert bin index to frequency
const binToFreq = (
  bin: number,
  sampleRate: number,
  fftSize: number,
): number => {
  return (bin * sampleRate) / fftSize;
};

const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({
  analyser,
  width = 400,
  height = 120,
  mode = "bars",
  showPeakHold = true,
  minDb = -90,
  maxDb = -10,
  barCount = 64,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const peakHoldRef = useRef<Float32Array>(
    new Float32Array(barCount).fill(minDb),
  );
  const peakDecayRef = useRef<Float32Array>(new Float32Array(barCount).fill(0));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      animationFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // Set canvas size with device pixel ratio
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    }

    // Clear canvas
    ctx.fillStyle = "#111827"; // gray-900
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = "#374151"; // gray-700
    ctx.lineWidth = 0.5;

    // Horizontal dB grid lines
    const dbSteps = [-80, -60, -40, -20, 0];
    ctx.font = "9px monospace";
    ctx.fillStyle = "#6b7280"; // gray-500
    ctx.textAlign = "left";

    for (const db of dbSteps) {
      const y = height - ((db - minDb) / (maxDb - minDb)) * height;
      if (y >= 0 && y <= height) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.fillText(`${db}`, 2, y - 2);
      }
    }

    // Vertical frequency grid lines
    ctx.textAlign = "center";
    for (const freq of FREQ_MARKERS) {
      const x = freqToX(freq, width);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Format frequency label
      const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
      ctx.fillText(label, x, height - 2);
    }

    if (!analyser) {
      animationFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    // Get frequency data
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatFrequencyData(dataArray);

    const sampleRate = analyser.context.sampleRate;
    const fftSize = analyser.fftSize;

    // Create logarithmically spaced frequency bands
    const minFreq = 20;
    const maxFreq = 20000;
    const bands: number[] = [];

    for (let i = 0; i < barCount; i++) {
      const lowFreq = minFreq * Math.pow(maxFreq / minFreq, i / barCount);
      const highFreq =
        minFreq * Math.pow(maxFreq / minFreq, (i + 1) / barCount);

      // Find bins in this frequency range
      const lowBin = Math.floor((lowFreq * fftSize) / sampleRate);
      const highBin = Math.ceil((highFreq * fftSize) / sampleRate);

      // Average the bins in this range
      let sum = 0;
      let count = 0;
      for (
        let bin = Math.max(0, lowBin);
        bin <= Math.min(bufferLength - 1, highBin);
        bin++
      ) {
        sum += dataArray[bin];
        count++;
      }

      bands.push(count > 0 ? sum / count : minDb);
    }

    // Calculate bar dimensions
    const barWidth = (width / barCount) * 0.8;
    const barGap = (width / barCount) * 0.2;

    // Create gradient for bars
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, "#22c55e"); // green-500
    gradient.addColorStop(0.5, "#22c55e"); // green-500
    gradient.addColorStop(0.7, "#eab308"); // yellow-500
    gradient.addColorStop(0.85, "#f97316"); // orange-500
    gradient.addColorStop(1, "#ef4444"); // red-500

    if (mode === "bars") {
      // Draw bars
      for (let i = 0; i < barCount; i++) {
        const db = bands[i];
        const normalizedHeight = Math.max(0, (db - minDb) / (maxDb - minDb));
        const barHeight = normalizedHeight * height;
        const x = i * (barWidth + barGap) + barGap / 2;

        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);

        // Peak hold
        if (showPeakHold) {
          // Update peak hold
          if (db > peakHoldRef.current[i]) {
            peakHoldRef.current[i] = db;
            peakDecayRef.current[i] = 0;
          } else {
            peakDecayRef.current[i]++;
            if (peakDecayRef.current[i] > 30) {
              // Hold for ~0.5 seconds
              peakHoldRef.current[i] -= 1.5; // Decay rate in dB per frame
            }
          }

          const peakNormalized = Math.max(
            0,
            (peakHoldRef.current[i] - minDb) / (maxDb - minDb),
          );
          const peakY = height - peakNormalized * height;

          if (peakY < height - 2) {
            ctx.fillStyle = peakNormalized > 0.9 ? "#ef4444" : "#facc15";
            ctx.fillRect(x, peakY - 2, barWidth, 2);
          }
        }
      }
    } else if (mode === "line" || mode === "filled") {
      // Draw line or filled area
      ctx.beginPath();
      ctx.moveTo(0, height);

      for (let i = 0; i < barCount; i++) {
        const db = bands[i];
        const normalizedHeight = Math.max(0, (db - minDb) / (maxDb - minDb));
        const x = (i / (barCount - 1)) * width;
        const y = height - normalizedHeight * height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      if (mode === "filled") {
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.strokeStyle = "#818cf8"; // indigo-400
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw peak hold line for line/filled modes
      if (showPeakHold) {
        ctx.beginPath();
        for (let i = 0; i < barCount; i++) {
          const db = bands[i];

          // Update peak hold
          if (db > peakHoldRef.current[i]) {
            peakHoldRef.current[i] = db;
            peakDecayRef.current[i] = 0;
          } else {
            peakDecayRef.current[i]++;
            if (peakDecayRef.current[i] > 30) {
              peakHoldRef.current[i] -= 1.5;
            }
          }

          const peakNormalized = Math.max(
            0,
            (peakHoldRef.current[i] - minDb) / (maxDb - minDb),
          );
          const x = (i / (barCount - 1)) * width;
          const y = height - peakNormalized * height;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.strokeStyle = "#facc15"; // yellow-400
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Draw border
    ctx.strokeStyle = "#4b5563"; // gray-600
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    // Request next frame
    animationFrameRef.current = requestAnimationFrame(draw);
  }, [analyser, width, height, mode, showPeakHold, minDb, maxDb, barCount]);

  useEffect(() => {
    // Reset peak hold arrays when barCount changes
    peakHoldRef.current = new Float32Array(barCount).fill(minDb);
    peakDecayRef.current = new Float32Array(barCount).fill(0);
  }, [barCount, minDb]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [draw]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-indigo-300 font-bold uppercase tracking-wider">
          Spectrum Analyzer
        </span>
        <span className="text-xs text-gray-500">
          {mode === "bars" ? "Bar" : mode === "line" ? "Line" : "Filled"} Mode
        </span>
      </div>
      <canvas
        ref={canvasRef}
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
        className="rounded-md"
      />
    </div>
  );
};

export default SpectrumAnalyzer;
