import React, { useEffect, useRef, useState, useCallback } from 'react';

// Icons for controls
const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const PauseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const VolumeUpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M20 4v16m-7-12v8m-4-6v4m-4-2v2" /></svg>;
const VolumeOffIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2" /></svg>;


interface WaveformPlayerProps {
  audioUrl: string;
}

const WaveformPlayer: React.FC<WaveformPlayerProps> = ({ audioUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  // FIX: Provided initial value `null` to useRef and updated type to `number | null` to fix missing argument error.
  const animationFrameRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [lastVolume, setLastVolume] = useState(1);
  
  const formatTime = (time: number) => {
      if (!isFinite(time)) return '0:00';
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const drawWaveform = useCallback((buffer: AudioBuffer) => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;
    const ctx = canvas.getContext('2d');
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
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.lineWidth = 1;
    ctx.strokeStyle = '#818cf8'; // Indigo-400
    ctx.fillStyle = 'rgba(129, 140, 248, 0.2)'; // Indigo-400 with opacity

    ctx.beginPath();
    ctx.moveTo(0, amp);
    
    for(let i=0; i < width; i++){
        let max = -1.0;
        for(let j=0; j < step; j++){
            const datum = data[(i * step) + j];
            if (datum > max) max = datum;
        }
        ctx.lineTo(i, amp - (max * amp));
    }

    for(let i=width-1; i >= 0; i--){
        let min = 1.0;
        for(let j=0; j < step; j++){
            const datum = data[(i * step) + j];
            if (datum < min) min = datum;
        }
        ctx.lineTo(i, amp - (min * amp));
    }
    
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }, []);

  const drawProgress = useCallback(() => {
    if (!audioRef.current || !canvasRef.current || !audioBufferRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { duration, currentTime } = audioRef.current;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    
    // Guard against division by zero if duration is not loaded yet
    const progress = isFinite(duration) && duration > 0 ? currentTime / duration : 0;

    // Redraw base waveform
    drawWaveform(audioBufferRef.current);
    
    // Draw progress overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(0, 0, width * progress, height);
    
    // Draw playhead
    ctx.fillStyle = '#facc15'; // yellow-400
    ctx.fillRect(width * progress, 0, 2, height);

  }, [drawWaveform]);

  const animate = useCallback(() => {
    if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
        drawProgress();
        animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [drawProgress]);

  useEffect(() => {
    if (!audioUrl) return;
    let audioContext: AudioContext | null = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    fetch(audioUrl)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => audioContext?.decodeAudioData(arrayBuffer))
      .then(decodedBuffer => {
        if (decodedBuffer) {
          audioBufferRef.current = decodedBuffer;
          drawWaveform(decodedBuffer);
          if (audioRef.current) {
              setDuration(decodedBuffer.duration);
          }
        }
      })
      .catch(error => console.error("Error loading audio for waveform:", error));
    
    return () => {
      audioContext?.close().catch(e => console.error(e));
      audioContext = null;
    };
  }, [audioUrl, drawWaveform]);
  
   useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
        setDuration(audio.duration);
        setCurrentTime(audio.currentTime);
    }

    const handlePlay = () => {
        setIsPlaying(true);
        animationFrameRef.current = requestAnimationFrame(animate);
    };
    const handlePause = () => {
        setIsPlaying(false);
        if(animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
    };
    const handleEnd = () => {
        setIsPlaying(false);
        audio.currentTime = 0; // Reset to beginning
        if(animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        drawProgress(); // Redraw at the start
    };

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnd);
    
    return () => {
        audio.removeEventListener('loadedmetadata', setAudioData);
        audio.removeEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('ended', handleEnd);
        if(animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    }
  }, [animate, drawProgress, duration]);
  
  const togglePlayPause = () => {
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play().catch(e => console.error("Playback failed:", e));
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
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || !isFinite(audio.duration)) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = canvas.offsetWidth;
    const clickedTime = (x / width) * audio.duration;
    
    audio.currentTime = clickedTime;
    setCurrentTime(clickedTime);
    drawProgress();
  };

  return (
    <div className="w-full mt-2 bg-gray-700/50 rounded-lg p-3">
        {/* We keep the audio element for functionality but hide it */}
        <audio ref={audioRef} src={audioUrl} preload="metadata"></audio>

        <canvas 
            ref={canvasRef} 
            className="w-full h-24 rounded-md mb-2 cursor-pointer" 
            style={{ height: '96px' }}
            onClick={handleCanvasClick}
            aria-label="Audio waveform, click to seek"
        ></canvas>

        <div className="flex items-center justify-between text-gray-300">
            <button onClick={togglePlayPause} className="hover:text-white transition-colors" aria-label={isPlaying ? 'Pause audio' : 'Play audio'}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <div className="text-xs font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            <div className="flex items-center gap-2">
                <button onClick={toggleMute} className="hover:text-white transition-colors" aria-label={isMuted ? 'Unmute' : 'Mute'}>
                    {volume === 0 || isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
                </button>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                    aria-label="Volume control"
                />
            </div>
        </div>
    </div>
  );
};

export default WaveformPlayer;