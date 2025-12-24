import React, { useEffect, useRef, useCallback } from 'react';

interface VuMeterProps {
  analyser: AnalyserNode | null;
  label?: string;
  orientation?: 'vertical' | 'horizontal';
  width?: number;
  height?: number;
  showPeak?: boolean;
  showDb?: boolean;
}

const VuMeter: React.FC<VuMeterProps> = ({
  analyser,
  label,
  orientation = 'horizontal',
  width = orientation === 'horizontal' ? 120 : 24,
  height = orientation === 'horizontal' ? 24 : 80,
  showPeak = true,
  showDb = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const peakRef = useRef<number>(0);
  const peakHoldRef = useRef<number>(0);
  const lastPeakTimeRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) {
      animationFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = width;
    const displayHeight = height;

    // Set canvas size with device pixel ratio
    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      ctx.scale(dpr, dpr);
    }

    // Get audio data
    const bufferLength = analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(dataArray);

    // Calculate RMS (Root Mean Square) for more accurate level
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < bufferLength; i++) {
      const sample = dataArray[i];
      sum += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
    }
    const rms = Math.sqrt(sum / bufferLength);

    // Convert to dB
    const minDb = -48;
    const maxDb = 0;
    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : minDb;
    const peakDb = peak > 0 ? 20 * Math.log10(peak) : minDb;

    // Normalize to 0-1 range
    const normalizedRms = Math.max(0, Math.min(1, (rmsDb - minDb) / (maxDb - minDb)));
    const normalizedPeak = Math.max(0, Math.min(1, (peakDb - minDb) / (maxDb - minDb)));

    // Peak hold logic
    const now = Date.now();
    if (normalizedPeak > peakHoldRef.current) {
      peakHoldRef.current = normalizedPeak;
      lastPeakTimeRef.current = now;
    } else if (now - lastPeakTimeRef.current > 1000) {
      // Decay peak after 1 second hold
      peakHoldRef.current *= 0.95;
    }

    // Smooth the current peak
    peakRef.current = Math.max(peakRef.current * 0.9, normalizedRms);

    // Clear canvas
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Draw background
    ctx.fillStyle = '#1f2937'; // gray-800
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Create gradient for meter
    const isHorizontal = orientation === 'horizontal';
    const gradient = isHorizontal
      ? ctx.createLinearGradient(0, 0, displayWidth, 0)
      : ctx.createLinearGradient(0, displayHeight, 0, 0);

    // Green to yellow to red gradient
    gradient.addColorStop(0, '#22c55e');    // green-500 (low level)
    gradient.addColorStop(0.6, '#22c55e');  // green-500
    gradient.addColorStop(0.75, '#eab308'); // yellow-500 (medium level)
    gradient.addColorStop(0.9, '#ef4444');  // red-500 (high level)
    gradient.addColorStop(1, '#dc2626');    // red-600 (clipping)

    // Draw meter fill
    ctx.fillStyle = gradient;
    if (isHorizontal) {
      const meterWidth = displayWidth * peakRef.current;
      ctx.fillRect(0, 0, meterWidth, displayHeight);
    } else {
      const meterHeight = displayHeight * peakRef.current;
      ctx.fillRect(0, displayHeight - meterHeight, displayWidth, meterHeight);
    }

    // Draw peak hold indicator
    if (showPeak && peakHoldRef.current > 0.01) {
      const peakPosition = peakHoldRef.current;
      ctx.fillStyle = peakHoldRef.current > 0.9 ? '#ef4444' : '#facc15'; // red or yellow

      if (isHorizontal) {
        const peakX = displayWidth * peakPosition;
        ctx.fillRect(peakX - 2, 0, 3, displayHeight);
      } else {
        const peakY = displayHeight - (displayHeight * peakPosition);
        ctx.fillRect(0, peakY - 1, displayWidth, 3);
      }
    }

    // Draw segment lines
    ctx.strokeStyle = '#374151'; // gray-700
    ctx.lineWidth = 1;
    const segments = 8;
    for (let i = 1; i < segments; i++) {
      const pos = i / segments;
      ctx.beginPath();
      if (isHorizontal) {
        ctx.moveTo(displayWidth * pos, 0);
        ctx.lineTo(displayWidth * pos, displayHeight);
      } else {
        ctx.moveTo(0, displayHeight * pos);
        ctx.lineTo(displayWidth, displayHeight * pos);
      }
      ctx.stroke();
    }

    // Draw border
    ctx.strokeStyle = '#4b5563'; // gray-600
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, displayWidth - 1, displayHeight - 1);

    // Request next frame
    animationFrameRef.current = requestAnimationFrame(draw);
  }, [analyser, width, height, orientation, showPeak]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [draw]);

  // Calculate dB display value
  const getCurrentDb = () => {
    if (!analyser) return -Infinity;
    const bufferLength = analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  };

  return (
    <div className={`flex ${orientation === 'horizontal' ? 'flex-col' : 'flex-row-reverse'} items-center gap-1`}>
      <canvas
        ref={canvasRef}
        style={{
          width: `${width}px`,
          height: `${height}px`
        }}
        className="rounded-sm"
      />
      {label && (
        <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
          {label}
        </span>
      )}
      {showDb && (
        <span className="text-xs text-gray-600 font-mono min-w-[32px] text-right">
          {analyser ? `${Math.max(-48, Math.round(getCurrentDb()))}` : '--'}
          <span className="text-gray-700">dB</span>
        </span>
      )}
    </div>
  );
};

export default VuMeter;
