import React, { useEffect, useRef, useCallback, useState } from 'react';

export type LufsPreset = 'spotify' | 'youtube' | 'apple' | 'broadcast' | 'custom';

interface LufsPresetConfig {
  name: string;
  target: number;
  truePeakLimit: number;
  color: string;
}

export const LUFS_PRESETS: Record<LufsPreset, LufsPresetConfig> = {
  spotify: { name: 'Spotify', target: -14, truePeakLimit: -1, color: '#1DB954' },
  youtube: { name: 'YouTube', target: -13, truePeakLimit: -1, color: '#FF0000' },
  apple: { name: 'Apple Music', target: -16, truePeakLimit: -1, color: '#FC3C44' },
  broadcast: { name: 'Broadcast', target: -24, truePeakLimit: -2, color: '#3B82F6' },
  custom: { name: 'Custom', target: -14, truePeakLimit: -1, color: '#8B5CF6' }
};

interface LufsMeterProps {
  analyser: AnalyserNode | null;
  audioContext: AudioContext | null;
  width?: number;
  height?: number;
  targetPreset?: LufsPreset;
  onPresetChange?: (preset: LufsPreset) => void;
}

interface LufsReadings {
  momentary: number;   // 400ms window
  shortTerm: number;   // 3s window
  integrated: number;  // Full program
  truePeak: number;    // dBTP
}

const LufsMeter: React.FC<LufsMeterProps> = ({
  analyser,
  audioContext,
  width = 300,
  height = 160,
  targetPreset = 'spotify',
  onPresetChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Rolling buffers for LUFS calculation
  const momentaryBufferRef = useRef<number[]>([]);
  const shortTermBufferRef = useRef<number[]>([]);
  const integratedSumRef = useRef<number>(0);
  const integratedCountRef = useRef<number>(0);
  const truePeakRef = useRef<number>(-Infinity);

  const [readings, setReadings] = useState<LufsReadings>({
    momentary: -Infinity,
    shortTerm: -Infinity,
    integrated: -Infinity,
    truePeak: -Infinity
  });

  // K-weighting approximation using the raw audio data
  // Note: True K-weighting requires biquad filters, this is a simplified version
  const calculateLoudness = useCallback((samples: Float32Array): number => {
    if (samples.length === 0) return -Infinity;

    // Calculate mean square (simplified - true LUFS requires K-weighting)
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    const meanSquare = sum / samples.length;

    if (meanSquare === 0) return -Infinity;

    // Convert to LUFS (approximately)
    // LUFS = -0.691 + 10 * log10(mean square) for K-weighted
    // Using simplified calculation
    const lufs = -0.691 + 10 * Math.log10(meanSquare);
    return lufs;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      animationFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    }

    // Clear canvas
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);

    const preset = LUFS_PRESETS[targetPreset];
    const meterHeight = height - 40;
    const meterY = 10;

    // LUFS scale: -60 to 0 LUFS
    const minLufs = -60;
    const maxLufs = 0;
    const lufsRange = maxLufs - minLufs;

    // Draw meter background with scale
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(10, meterY, width - 100, meterHeight);

    // Draw scale markers
    ctx.font = '9px monospace';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'right';

    const scaleMarks = [0, -6, -12, -18, -24, -30, -40, -50, -60];
    for (const mark of scaleMarks) {
      const y = meterY + ((maxLufs - mark) / lufsRange) * meterHeight;
      ctx.fillText(`${mark}`, width - 75, y + 3);

      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(width - 90, y);
      ctx.stroke();
    }

    // Draw target zone
    const targetY = meterY + ((maxLufs - preset.target) / lufsRange) * meterHeight;
    const toleranceY = (2 / lufsRange) * meterHeight; // ±2 LUFS tolerance

    ctx.fillStyle = preset.color + '33'; // 20% opacity
    ctx.fillRect(10, targetY - toleranceY, width - 100, toleranceY * 2);

    ctx.strokeStyle = preset.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(10, targetY);
    ctx.lineTo(width - 90, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (analyser && audioContext) {
      // Get audio data
      const bufferLength = analyser.fftSize;
      const dataArray = new Float32Array(bufferLength);
      analyser.getFloatTimeDomainData(dataArray);

      // Calculate current loudness
      const currentLoudness = calculateLoudness(dataArray);

      // Update true peak
      let currentPeak = -Infinity;
      for (let i = 0; i < bufferLength; i++) {
        const sample = Math.abs(dataArray[i]);
        if (sample > 0) {
          const peakDb = 20 * Math.log10(sample);
          currentPeak = Math.max(currentPeak, peakDb);
        }
      }
      if (currentPeak > truePeakRef.current) {
        truePeakRef.current = currentPeak;
      }

      // Update momentary buffer (400ms at 60fps ≈ 24 frames)
      momentaryBufferRef.current.push(currentLoudness);
      if (momentaryBufferRef.current.length > 24) {
        momentaryBufferRef.current.shift();
      }

      // Update short-term buffer (3s ≈ 180 frames)
      shortTermBufferRef.current.push(currentLoudness);
      if (shortTermBufferRef.current.length > 180) {
        shortTermBufferRef.current.shift();
      }

      // Update integrated loudness (gated)
      if (currentLoudness > -70) { // Absolute gate at -70 LUFS
        integratedSumRef.current += Math.pow(10, currentLoudness / 10);
        integratedCountRef.current++;
      }

      // Calculate averages
      const momentaryAvg = momentaryBufferRef.current.length > 0
        ? momentaryBufferRef.current.reduce((a, b) => a + Math.pow(10, b / 10), 0) / momentaryBufferRef.current.length
        : 0;
      const momentaryLufs = momentaryAvg > 0 ? 10 * Math.log10(momentaryAvg) : -Infinity;

      const shortTermAvg = shortTermBufferRef.current.length > 0
        ? shortTermBufferRef.current.reduce((a, b) => a + Math.pow(10, b / 10), 0) / shortTermBufferRef.current.length
        : 0;
      const shortTermLufs = shortTermAvg > 0 ? 10 * Math.log10(shortTermAvg) : -Infinity;

      const integratedAvg = integratedCountRef.current > 0
        ? integratedSumRef.current / integratedCountRef.current
        : 0;
      const integratedLufs = integratedAvg > 0 ? 10 * Math.log10(integratedAvg) : -Infinity;

      setReadings({
        momentary: momentaryLufs,
        shortTerm: shortTermLufs,
        integrated: integratedLufs,
        truePeak: truePeakRef.current
      });

      // Draw momentary meter bar
      const momentaryNorm = Math.max(0, Math.min(1, (momentaryLufs - minLufs) / lufsRange));
      const momentaryH = momentaryNorm * meterHeight;

      // Gradient based on level
      const gradient = ctx.createLinearGradient(0, meterY + meterHeight, 0, meterY);
      gradient.addColorStop(0, '#22c55e');
      gradient.addColorStop(0.4, '#22c55e');
      gradient.addColorStop(0.6, '#eab308');
      gradient.addColorStop(0.8, '#f97316');
      gradient.addColorStop(1, '#ef4444');

      ctx.fillStyle = gradient;
      ctx.fillRect(15, meterY + meterHeight - momentaryH, 40, momentaryH);

      // Draw short-term indicator
      const shortTermNorm = Math.max(0, Math.min(1, (shortTermLufs - minLufs) / lufsRange));
      const shortTermY = meterY + meterHeight - shortTermNorm * meterHeight;

      ctx.fillStyle = '#818cf8';
      ctx.fillRect(60, shortTermY - 2, 30, 4);

      // Draw integrated indicator
      const integratedNorm = Math.max(0, Math.min(1, (integratedLufs - minLufs) / lufsRange));
      const integratedY = meterY + meterHeight - integratedNorm * meterHeight;

      ctx.fillStyle = '#f472b6';
      ctx.fillRect(95, integratedY - 2, 30, 4);
    }

    // Draw labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('M', 35, height - 5);
    ctx.fillText('S', 75, height - 5);
    ctx.fillText('I', 110, height - 5);

    // Draw readings panel
    const panelX = width - 85;
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(panelX, meterY, 75, meterHeight);

    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#22c55e';
    ctx.fillText('Momentary', panelX + 5, meterY + 15);
    ctx.font = 'bold 16px monospace';
    ctx.fillText(readings.momentary > -100 ? readings.momentary.toFixed(1) : '-∞', panelX + 5, meterY + 32);

    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#818cf8';
    ctx.fillText('Short Term', panelX + 5, meterY + 50);
    ctx.font = 'bold 14px monospace';
    ctx.fillText(readings.shortTerm > -100 ? readings.shortTerm.toFixed(1) : '-∞', panelX + 5, meterY + 65);

    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#f472b6';
    ctx.fillText('Integrated', panelX + 5, meterY + 83);
    ctx.font = 'bold 14px monospace';
    ctx.fillText(readings.integrated > -100 ? readings.integrated.toFixed(1) : '-∞', panelX + 5, meterY + 98);

    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = readings.truePeak > preset.truePeakLimit ? '#ef4444' : '#6b7280';
    ctx.fillText('True Peak', panelX + 5, meterY + 116);
    ctx.font = 'bold 14px monospace';
    ctx.fillText(readings.truePeak > -100 ? readings.truePeak.toFixed(1) + ' dBTP' : '-∞', panelX + 5, meterY + 131);

    // Draw border
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    animationFrameRef.current = requestAnimationFrame(draw);
  }, [analyser, audioContext, width, height, targetPreset, readings, calculateLoudness]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [draw]);

  // Reset integrated measurement
  const resetIntegrated = () => {
    integratedSumRef.current = 0;
    integratedCountRef.current = 0;
    truePeakRef.current = -Infinity;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-indigo-300 font-bold uppercase tracking-wider">
          Loudness Meter (LUFS)
        </span>
        <div className="flex items-center gap-2">
          <select
            value={targetPreset}
            onChange={(e) => onPresetChange?.(e.target.value as LufsPreset)}
            className="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-300"
          >
            {Object.entries(LUFS_PRESETS).map(([key, config]) => (
              <option key={key} value={key}>
                {config.name} ({config.target} LUFS)
              </option>
            ))}
          </select>
          <button
            onClick={resetIntegrated}
            className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300"
          >
            Reset
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        style={{
          width: `${width}px`,
          height: `${height}px`
        }}
        className="rounded-md"
      />
    </div>
  );
};

export default LufsMeter;
