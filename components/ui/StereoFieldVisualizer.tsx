import React, { useEffect, useRef, useCallback, useState } from 'react';

interface StereoFieldVisualizerProps {
  analyserL: AnalyserNode | null;
  analyserR: AnalyserNode | null;
  width?: number;
  height?: number;
  mode?: 'goniometer' | 'correlation' | 'combined';
  showBalance?: boolean;
}

interface StereoReadings {
  correlation: number;  // -1 to +1
  balance: number;      // -1 (L) to +1 (R)
  width: number;        // 0 (mono) to 1+ (wide/out of phase)
}

const StereoFieldVisualizer: React.FC<StereoFieldVisualizerProps> = ({
  analyserL,
  analyserR,
  width = 200,
  height = 200,
  mode = 'combined',
  showBalance = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const historyRef = useRef<{ x: number; y: number; age: number }[]>([]);

  const [readings, setReadings] = useState<StereoReadings>({
    correlation: 1,
    balance: 0,
    width: 0
  });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      animationFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(width, height);

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    }

    // Clear with slight fade for phosphor effect
    ctx.fillStyle = 'rgba(17, 24, 39, 0.3)'; // gray-900 with alpha
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    // Draw goniometer background
    if (mode === 'goniometer' || mode === 'combined') {
      // Draw circle
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw inner circles
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.66, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.33, 0, Math.PI * 2);
      ctx.stroke();

      // Draw crosshairs (rotated 45 degrees for L/R display)
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 1;

      // Vertical (M - mono/sum)
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - radius);
      ctx.lineTo(centerX, centerY + radius);
      ctx.stroke();

      // Horizontal (S - side/difference)
      ctx.beginPath();
      ctx.moveTo(centerX - radius, centerY);
      ctx.lineTo(centerX + radius, centerY);
      ctx.stroke();

      // Diagonal L/R markers
      const diagOffset = radius * 0.707; // cos(45°)

      // L marker (top-left)
      ctx.fillStyle = '#9ca3af';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('L', centerX - diagOffset - 10, centerY - diagOffset - 5);

      // R marker (top-right)
      ctx.fillText('R', centerX + diagOffset + 10, centerY - diagOffset - 5);

      // M marker (top)
      ctx.fillText('M', centerX, centerY - radius - 5);

      // S marker (right)
      ctx.fillText('S', centerX + radius + 10, centerY + 4);
    }

    if (analyserL && analyserR) {
      const bufferLength = analyserL.fftSize;
      const dataL = new Float32Array(bufferLength);
      const dataR = new Float32Array(bufferLength);

      analyserL.getFloatTimeDomainData(dataL);
      analyserR.getFloatTimeDomainData(dataR);

      // Calculate stereo metrics
      let sumLR = 0;
      let sumL2 = 0;
      let sumR2 = 0;
      let sumL = 0;
      let sumR = 0;

      for (let i = 0; i < bufferLength; i++) {
        const l = dataL[i];
        const r = dataR[i];
        sumLR += l * r;
        sumL2 += l * l;
        sumR2 += r * r;
        sumL += Math.abs(l);
        sumR += Math.abs(r);
      }

      // Correlation: -1 (out of phase) to +1 (mono/in phase)
      const denominator = Math.sqrt(sumL2 * sumR2);
      const correlation = denominator > 0 ? sumLR / denominator : 1;

      // Balance: -1 (full left) to +1 (full right)
      const totalLevel = sumL + sumR;
      const balance = totalLevel > 0 ? (sumR - sumL) / totalLevel : 0;

      // Width: based on M/S ratio
      const mid = Math.sqrt(sumL2 + sumR2 + 2 * sumLR) / 2;
      const side = Math.sqrt(sumL2 + sumR2 - 2 * sumLR) / 2;
      const stereoWidth = mid > 0 ? side / mid : 0;

      setReadings({
        correlation: correlation,
        balance: balance,
        width: stereoWidth
      });

      // Draw Lissajous pattern (goniometer)
      if (mode === 'goniometer' || mode === 'combined') {
        // Add new points to history
        const step = Math.max(1, Math.floor(bufferLength / 512));
        for (let i = 0; i < bufferLength; i += step) {
          const l = dataL[i];
          const r = dataR[i];

          // M/S encoding: X = L-R (side), Y = L+R (mid)
          const x = (l - r) * radius * 0.7;
          const y = -(l + r) * radius * 0.7; // Negative for correct orientation

          historyRef.current.push({
            x: centerX + x,
            y: centerY + y,
            age: 0
          });
        }

        // Limit history size
        if (historyRef.current.length > 2000) {
          historyRef.current = historyRef.current.slice(-1500);
        }

        // Draw points with age-based fading
        for (let i = 0; i < historyRef.current.length; i++) {
          const point = historyRef.current[i];
          point.age++;

          const alpha = Math.max(0, 1 - point.age / 60);
          if (alpha <= 0) continue;

          // Color based on position (stereo field)
          const distFromCenter = Math.sqrt(
            Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2)
          );
          const normalizedDist = Math.min(1, distFromCenter / radius);

          // Green for centered, yellow for wide, red for very wide
          let r_col, g, b;
          if (normalizedDist < 0.5) {
            r_col = Math.floor(34 + normalizedDist * 2 * 200);
            g = 197;
            b = 94;
          } else {
            r_col = 234;
            g = Math.floor(179 - (normalizedDist - 0.5) * 2 * 100);
            b = 8;
          }

          ctx.fillStyle = `rgba(${r_col}, ${g}, ${b}, ${alpha})`;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Remove old points
        historyRef.current = historyRef.current.filter(p => p.age < 60);
      }
    }

    // Draw correlation meter bar (at bottom for combined mode)
    if (mode === 'correlation' || mode === 'combined') {
      const meterY = mode === 'combined' ? height - 25 : height / 2 - 10;
      const meterWidth = width - 40;
      const meterX = 20;

      // Background
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(meterX, meterY, meterWidth, 20);

      // Scale markers
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 1;
      const markers = [-1, -0.5, 0, 0.5, 1];
      ctx.font = '9px monospace';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'center';

      for (const marker of markers) {
        const x = meterX + ((marker + 1) / 2) * meterWidth;
        ctx.beginPath();
        ctx.moveTo(x, meterY);
        ctx.lineTo(x, meterY + 20);
        ctx.stroke();
        ctx.fillText(marker.toString(), x, meterY + 30);
      }

      // Draw zones
      // Red zone (out of phase)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.fillRect(meterX, meterY, meterWidth * 0.25, 20);

      // Yellow zone (weak correlation)
      ctx.fillStyle = 'rgba(234, 179, 8, 0.2)';
      ctx.fillRect(meterX + meterWidth * 0.25, meterY, meterWidth * 0.25, 20);

      // Green zone (good correlation)
      ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
      ctx.fillRect(meterX + meterWidth * 0.5, meterY, meterWidth * 0.5, 20);

      // Draw correlation indicator
      const corrX = meterX + ((readings.correlation + 1) / 2) * meterWidth;
      const corrColor = readings.correlation < 0 ? '#ef4444' :
        readings.correlation < 0.5 ? '#eab308' : '#22c55e';

      ctx.fillStyle = corrColor;
      ctx.fillRect(corrX - 3, meterY + 2, 6, 16);

      // Labels
      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Out', meterX, meterY - 3);
      ctx.textAlign = 'right';
      ctx.fillText('Mono', meterX + meterWidth, meterY - 3);
    }

    // Draw balance meter (if enabled)
    if (showBalance && (mode === 'goniometer' || mode === 'combined')) {
      const balY = mode === 'combined' ? height - 55 : height - 25;
      const balWidth = width - 40;
      const balX = 20;

      // Background
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(balX, balY, balWidth, 12);

      // Center line
      ctx.strokeStyle = '#4b5563';
      ctx.beginPath();
      ctx.moveTo(balX + balWidth / 2, balY);
      ctx.lineTo(balX + balWidth / 2, balY + 12);
      ctx.stroke();

      // Balance indicator
      const balPos = balX + ((readings.balance + 1) / 2) * balWidth;
      ctx.fillStyle = Math.abs(readings.balance) > 0.3 ? '#eab308' : '#22c55e';
      ctx.fillRect(balPos - 4, balY + 1, 8, 10);

      // Labels
      ctx.fillStyle = '#6b7280';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('L', balX - 12, balY + 9);
      ctx.textAlign = 'right';
      ctx.fillText('R', balX + balWidth + 12, balY + 9);
      ctx.textAlign = 'center';
      ctx.fillText('Balance', balX + balWidth / 2, balY - 3);
    }

    // Draw border
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    animationFrameRef.current = requestAnimationFrame(draw);
  }, [analyserL, analyserR, width, height, mode, showBalance, readings]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      historyRef.current = [];
    };
  }, [draw]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-indigo-300 font-bold uppercase tracking-wider">
          Stereo Field
        </span>
        <div className="flex items-center gap-3 text-xs">
          <span className={`font-mono ${readings.correlation < 0 ? 'text-red-400' : readings.correlation < 0.5 ? 'text-yellow-400' : 'text-green-400'}`}>
            Corr: {readings.correlation.toFixed(2)}
          </span>
          <span className="text-gray-400 font-mono">
            Width: {(readings.width * 100).toFixed(0)}%
          </span>
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

export default StereoFieldVisualizer;
