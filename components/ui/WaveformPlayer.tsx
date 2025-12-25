import React, { useEffect, useRef, useState, useCallback } from "react";

// Icons for controls
const PlayIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);
const PauseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);
const VolumeUpIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15.536 8.464a5 5 0 010 7.072M20 4v16m-7-12v8m-4-6v4m-4-2v2"
    />
  </svg>
);
const VolumeOffIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      clipRule="evenodd"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2"
    />
  </svg>
);
const ZoomInIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
    />
  </svg>
);
const ZoomOutIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
    />
  </svg>
);
const ZoomResetIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

interface WaveformPlayerProps {
  audioUrl: string;
}

const WaveformPlayer: React.FC<WaveformPlayerProps> = ({ audioUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [lastVolume, setLastVolume] = useState(1);

  // Zoom and scroll state
  const [zoom, setZoom] = useState(1); // 1 = full view, 2 = 2x zoom, etc.
  const [scrollPosition, setScrollPosition] = useState(0); // 0 to 1 (normalized)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartScroll, setDragStartScroll] = useState(0);

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 16;

  const formatTime = (time: number) => {
    if (!isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Calculate visible range based on zoom and scroll
  const getVisibleRange = useCallback(() => {
    const visibleWidth = 1 / zoom; // Fraction of total that's visible
    const maxScroll = 1 - visibleWidth;
    const clampedScroll = Math.max(0, Math.min(maxScroll, scrollPosition));

    return {
      start: clampedScroll,
      end: clampedScroll + visibleWidth,
      visibleWidth,
      maxScroll,
    };
  }, [zoom, scrollPosition]);

  const drawWaveform = useCallback(
    (
      buffer: AudioBuffer,
      targetCanvas?: HTMLCanvasElement,
      isFullView = false,
    ) => {
      const canvas = targetCanvas || canvasRef.current;
      if (!canvas || !buffer) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;

      ctx.clearRect(0, 0, width, height);

      const data = buffer.getChannelData(0);
      const totalSamples = data.length;

      // For zoomed view, only draw visible portion
      const { start, end } = isFullView
        ? { start: 0, end: 1 }
        : getVisibleRange();
      const startSample = Math.floor(totalSamples * start);
      const endSample = Math.floor(totalSamples * end);
      const visibleSamples = endSample - startSample;

      const step = Math.max(1, Math.ceil(visibleSamples / width));
      const amp = height / 2;

      ctx.lineWidth = 1;
      ctx.strokeStyle = isFullView ? "#6366f1" : "#818cf8"; // Indigo-500 for minimap, Indigo-400 for main
      ctx.fillStyle = isFullView
        ? "rgba(99, 102, 241, 0.3)"
        : "rgba(129, 140, 248, 0.2)";

      ctx.beginPath();
      ctx.moveTo(0, amp);

      for (let i = 0; i < width; i++) {
        let max = -1.0;
        const sampleStart =
          startSample + Math.floor((i / width) * visibleSamples);
        for (let j = 0; j < step; j++) {
          const sampleIndex = sampleStart + j;
          if (sampleIndex < totalSamples) {
            const datum = data[sampleIndex];
            if (datum > max) max = datum;
          }
        }
        ctx.lineTo(i, amp - max * amp);
      }

      for (let i = width - 1; i >= 0; i--) {
        let min = 1.0;
        const sampleStart =
          startSample + Math.floor((i / width) * visibleSamples);
        for (let j = 0; j < step; j++) {
          const sampleIndex = sampleStart + j;
          if (sampleIndex < totalSamples) {
            const datum = data[sampleIndex];
            if (datum < min) min = datum;
          }
        }
        ctx.lineTo(i, amp - min * amp);
      }

      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    },
    [getVisibleRange],
  );

  const drawMinimap = useCallback(() => {
    const canvas = minimapRef.current;
    const buffer = audioBufferRef.current;
    if (!canvas || !buffer) return;

    // Draw full waveform
    drawWaveform(buffer, canvas, true);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const { start, visibleWidth } = getVisibleRange();

    // Draw viewport indicator
    if (zoom > 1) {
      ctx.fillStyle = "rgba(250, 204, 21, 0.2)"; // Yellow with opacity
      ctx.strokeStyle = "#facc15"; // Yellow-400
      ctx.lineWidth = 1;

      const viewportX = start * width;
      const viewportWidth = visibleWidth * width;

      ctx.fillRect(viewportX, 0, viewportWidth, height);
      ctx.strokeRect(viewportX, 0, viewportWidth, height);
    }

    // Draw current time indicator
    if (audioRef.current && isFinite(duration) && duration > 0) {
      const timePosition = (currentTime / duration) * width;
      ctx.fillStyle = "#facc15";
      ctx.fillRect(timePosition - 1, 0, 2, height);
    }
  }, [drawWaveform, getVisibleRange, zoom, currentTime, duration]);

  const drawProgress = useCallback(() => {
    if (!audioRef.current || !canvasRef.current || !audioBufferRef.current)
      return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { duration: audioDuration, currentTime: audioCurrentTime } =
      audioRef.current;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const { start, end } = getVisibleRange();

    // Redraw base waveform
    drawWaveform(audioBufferRef.current);

    // Guard against division by zero
    if (!isFinite(audioDuration) || audioDuration <= 0) return;

    const progress = audioCurrentTime / audioDuration;

    // Only draw progress if it's within visible range
    if (progress >= start && progress <= end) {
      const visibleProgress = (progress - start) / (end - start);

      // Draw progress overlay
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.fillRect(0, 0, width * visibleProgress, height);

      // Draw playhead
      ctx.fillStyle = "#facc15"; // yellow-400
      ctx.fillRect(width * visibleProgress, 0, 2, height);
    }

    // Update minimap
    drawMinimap();
  }, [drawWaveform, getVisibleRange, drawMinimap]);

  const animate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      drawProgress();
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [drawProgress]);

  // Auto-scroll to follow playhead when zoomed
  useEffect(() => {
    if (!isPlaying || zoom <= 1 || !duration) return;

    const progress = currentTime / duration;
    const { start, end, visibleWidth, maxScroll } = getVisibleRange();

    // If playhead is near the edge of visible area, scroll to follow
    const edgeThreshold = visibleWidth * 0.1;
    if (progress > end - edgeThreshold && scrollPosition < maxScroll) {
      // Scroll to keep playhead in view
      setScrollPosition(Math.min(maxScroll, progress - visibleWidth * 0.5));
    }
  }, [currentTime, duration, zoom, isPlaying, getVisibleRange, scrollPosition]);

  useEffect(() => {
    if (!audioUrl) return;

    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn("AudioContext not supported in this browser");
      return;
    }

    let audioContext: AudioContext | null = null;
    let isCancelled = false;

    const loadAudio = async () => {
      try {
        audioContext = new AudioContextClass();
        const response = await fetch(audioUrl);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch audio: ${response.status} ${response.statusText}`,
          );
        }

        const arrayBuffer = await response.arrayBuffer();

        if (isCancelled || !audioContext) return;

        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

        if (isCancelled) return;

        audioBufferRef.current = decodedBuffer;
        drawWaveform(decodedBuffer);
        drawMinimap();
        if (audioRef.current) {
          setDuration(decodedBuffer.duration);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Error loading audio for waveform:", error);
        }
      }
    };

    loadAudio();

    return () => {
      isCancelled = true;
      if (audioContext) {
        audioContext.close().catch(() => {});
        audioContext = null;
      }
    };
  }, [audioUrl, drawWaveform, drawMinimap]);

  // Redraw when zoom/scroll changes
  useEffect(() => {
    if (audioBufferRef.current) {
      drawWaveform(audioBufferRef.current);
      drawProgress();
    }
  }, [zoom, scrollPosition, drawWaveform, drawProgress]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    const handlePause = () => {
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
    const handleEnd = () => {
      setIsPlaying(false);
      audio.currentTime = 0;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      drawProgress();
    };

    audio.addEventListener("loadedmetadata", setAudioData);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnd);

    return () => {
      audio.removeEventListener("loadedmetadata", setAudioData);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnd);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animate, drawProgress, duration]);

  const togglePlayPause = () => {
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current
        ?.play()
        .catch((e) => console.error("Playback failed:", e));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setVolume(newVolume);
    if (newVolume > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setVolume(lastVolume);
      if (audioRef.current) audioRef.current.volume = lastVolume;
      setIsMuted(false);
    } else {
      setLastVolume(volume);
      setVolume(0);
      if (audioRef.current) audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return; // Don't seek if we were dragging

    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || !isFinite(audio.duration)) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = canvas.offsetWidth;

    const { start, end } = getVisibleRange();
    const visibleDuration = end - start;
    const clickedNormalized = start + (x / width) * visibleDuration;
    const clickedTime = clickedNormalized * audio.duration;

    audio.currentTime = Math.max(0, Math.min(audio.duration, clickedTime));
    setCurrentTime(audio.currentTime);
    drawProgress();
  };

  const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = minimapRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || !isFinite(audio.duration)) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = canvas.offsetWidth;
    const clickedTime = (x / width) * audio.duration;

    audio.currentTime = Math.max(0, Math.min(audio.duration, clickedTime));
    setCurrentTime(audio.currentTime);

    // Also center the view on clicked position when zoomed
    if (zoom > 1) {
      const { visibleWidth, maxScroll } = getVisibleRange();
      const newScroll = Math.max(
        0,
        Math.min(maxScroll, x / width - visibleWidth / 2),
      );
      setScrollPosition(newScroll);
    }

    drawProgress();
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const width = canvas.offsetWidth;

    // Calculate the position where we want to zoom (in normalized coordinates)
    const { start, visibleWidth } = getVisibleRange();
    const mousePosition = start + (mouseX / width) * visibleWidth;

    // Determine zoom direction
    const zoomDelta = e.deltaY < 0 ? 1.2 : 0.8;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * zoomDelta));

    if (newZoom !== zoom) {
      // Calculate new visible width
      const newVisibleWidth = 1 / newZoom;

      // Adjust scroll to keep mouse position stable
      const newMaxScroll = Math.max(0, 1 - newVisibleWidth);
      const newStart = mousePosition - (mouseX / width) * newVisibleWidth;
      const newScroll = Math.max(0, Math.min(newMaxScroll, newStart));

      setZoom(newZoom);
      setScrollPosition(newScroll);
    }
  };

  // Drag to scroll
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (zoom <= 1) return;

    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartScroll(scrollPosition);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const width = canvas.offsetWidth;
      const deltaX = e.clientX - dragStartX;

      const { visibleWidth, maxScroll } = getVisibleRange();
      const scrollDelta = -(deltaX / width) * visibleWidth;
      const newScroll = Math.max(
        0,
        Math.min(maxScroll, dragStartScroll + scrollDelta),
      );

      setScrollPosition(newScroll);
    },
    [isDragging, dragStartX, dragStartScroll, getVisibleRange],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Zoom controls
  const handleZoomIn = () => {
    const newZoom = Math.min(MAX_ZOOM, zoom * 1.5);
    setZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(MIN_ZOOM, zoom / 1.5);
    setZoom(newZoom);
    // Adjust scroll if needed
    const newVisibleWidth = 1 / newZoom;
    const newMaxScroll = Math.max(0, 1 - newVisibleWidth);
    if (scrollPosition > newMaxScroll) {
      setScrollPosition(newMaxScroll);
    }
  };

  const handleZoomReset = () => {
    setZoom(1);
    setScrollPosition(0);
  };

  return (
    <div
      className="w-full mt-2 bg-gray-700/50 rounded-lg p-3"
      ref={containerRef}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata"></audio>

      {/* Main Waveform Canvas */}
      <canvas
        ref={canvasRef}
        className={`w-full h-24 rounded-md mb-2 ${zoom > 1 ? "cursor-grab" : "cursor-pointer"} ${isDragging ? "cursor-grabbing" : ""}`}
        style={{ height: "96px" }}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        aria-label="Audio waveform, click to seek, scroll to zoom"
      ></canvas>

      {/* Minimap (shown when zoomed) */}
      {zoom > 1 && (
        <canvas
          ref={minimapRef}
          className="w-full h-8 rounded-md mb-2 cursor-pointer bg-gray-800/50"
          style={{ height: "32px" }}
          onClick={handleMinimapClick}
          aria-label="Waveform overview, click to navigate"
        ></canvas>
      )}

      <div className="flex items-center justify-between text-gray-300">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlayPause}
            className="hover:text-white transition-colors"
            aria-label={isPlaying ? "Pause audio" : "Play audio"}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <div className="text-xs font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className={`p-1 rounded ${zoom <= MIN_ZOOM ? "text-gray-600" : "hover:text-white hover:bg-gray-600"} transition-colors`}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOutIcon />
          </button>
          <span className="text-xs font-mono w-10 text-center">
            {zoom.toFixed(1)}x
          </span>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className={`p-1 rounded ${zoom >= MAX_ZOOM ? "text-gray-600" : "hover:text-white hover:bg-gray-600"} transition-colors`}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomInIcon />
          </button>
          <button
            onClick={handleZoomReset}
            disabled={zoom === 1}
            className={`p-1 rounded ${zoom === 1 ? "text-gray-600" : "hover:text-white hover:bg-gray-600"} transition-colors`}
            aria-label="Reset zoom"
            title="Reset zoom (1x)"
          >
            <ZoomResetIcon />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="hover:text-white transition-colors"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {volume === 0 || isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-400"
            aria-label="Volume control"
          />
        </div>
      </div>

      {/* Zoom hint */}
      {zoom === 1 && (
        <p className="text-[10px] text-gray-500 text-center mt-1">
          Use mouse wheel to zoom • Drag to scroll when zoomed
        </p>
      )}
    </div>
  );
};

export default WaveformPlayer;
